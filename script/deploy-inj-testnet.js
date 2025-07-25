const { ethers } = require("hardhat");
const fs = require('fs');
const path = require('path');

// 部署状态文件路径
const DEPLOYMENT_FILE = path.join(__dirname, 'inj-testnet-deployments.json');

// 读取部署状态
function loadDeployments() {
    if (fs.existsSync(DEPLOYMENT_FILE)) {
        return JSON.parse(fs.readFileSync(DEPLOYMENT_FILE, 'utf8'));
    }
    return {};
}

// 保存部署状态
function saveDeployments(deployments) {
    fs.writeFileSync(DEPLOYMENT_FILE, JSON.stringify(deployments, null, 2));
}

// 验证合约是否已部署且有效
async function isContractDeployed(address) {
    if (!address) return false;
    try {
        const code = await ethers.provider.getCode(address);
        return code !== '0x';
    } catch (error) {
        return false;
    }
}

// 重试部署函数
async function deployWithRetry(contractFactory, args = [], maxRetries = 5) {
    for (let i = 0; i < maxRetries; i++) {
        try {
            console.log(`尝试部署 (${i + 1}/${maxRetries})...`);
            let contract;
            if (args.length === 0) {
                contract = await contractFactory.deploy();
            } else {
                contract = await contractFactory.deploy(...args);
            }
            await contract.waitForDeployment();
            return contract;
        } catch (error) {
            console.log(`部署失败 (${i + 1}/${maxRetries}):`, error.message);
            if (i === maxRetries - 1) throw error;
            
            // 等待一段时间后重试，使用指数退避
            const waitTime = Math.min((i + 1) * 30000, 120000); // 30秒, 60秒, 90秒, 120秒, 120秒
            console.log(`等待 ${waitTime/1000} 秒后重试...`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
        }
    }
}

async function main() {
    console.log("开始增量部署到 Injective Testnet...");
    
    const [deployer] = await ethers.getSigners();
    console.log("部署账户:", deployer.address);
    
    const balance = await ethers.provider.getBalance(deployer.address);
    console.log("账户余额:", ethers.formatEther(balance), "INJ");
    
    // 加载现有部署状态
    let deployments = loadDeployments();
    console.log("\n当前部署状态:", deployments);
    
    // 1. 部署 ReviewerDAO (如果未部署)
    let reviewerDAO;
    if (await isContractDeployed(deployments.ReviewerDAO)) {
        console.log("\n✓ ReviewerDAO 已部署，地址:", deployments.ReviewerDAO);
        reviewerDAO = await ethers.getContractAt("ReviewerDAO", deployments.ReviewerDAO);
    } else {
        console.log("\n📦 部署 ReviewerDAO...");
        const ReviewerDAO = await ethers.getContractFactory("ReviewerDAO");
        reviewerDAO = await deployWithRetry(ReviewerDAO, ["ReviewerDAO Token", "RDT"]);
        deployments.ReviewerDAO = await reviewerDAO.getAddress();
        console.log("✅ ReviewerDAO 部署完成:", deployments.ReviewerDAO);
        saveDeployments(deployments);
    }
    
    // 2. 部署 JournalManager (如果未部署)
    let journalManager;
    if (await isContractDeployed(deployments.JournalManager)) {
        console.log("\n✓ JournalManager 已部署，地址:", deployments.JournalManager);
        journalManager = await ethers.getContractAt("JournalManager", deployments.JournalManager);
    } else {
        console.log("\n📦 部署 JournalManager...");
        const JournalManager = await ethers.getContractFactory("JournalManager");
        journalManager = await deployWithRetry(JournalManager, []);
        deployments.JournalManager = await journalManager.getAddress();
        console.log("✅ JournalManager 部署完成:", deployments.JournalManager);
        saveDeployments(deployments);
    }
    
    // 3. 部署 ResearchDataNFT (如果未部署)
    let researchDataNFT;
    if (await isContractDeployed(deployments.ResearchDataNFT)) {
        console.log("\n✓ ResearchDataNFT 已部署，地址:", deployments.ResearchDataNFT);
        researchDataNFT = await ethers.getContractAt("ResearchDataNFT", deployments.ResearchDataNFT);
    } else {
        console.log("\n📦 部署 ResearchDataNFT...");
        const ResearchDataNFT = await ethers.getContractFactory("ResearchDataNFT");
        researchDataNFT = await deployWithRetry(ResearchDataNFT, []);
        deployments.ResearchDataNFT = await researchDataNFT.getAddress();
        console.log("✅ ResearchDataNFT 部署完成:", deployments.ResearchDataNFT);
        saveDeployments(deployments);
    }
    
    // 4. 部署 PaperNFT (如果未部署)
    let paperNFT;
    if (await isContractDeployed(deployments.PaperNFT)) {
        console.log("\n✓ PaperNFT 已部署，地址:", deployments.PaperNFT);
        paperNFT = await ethers.getContractAt("PaperNFT", deployments.PaperNFT);
    } else {
        console.log("\n📦 部署 PaperNFT...");
        const PaperNFT = await ethers.getContractFactory("PaperNFT");
        paperNFT = await deployWithRetry(PaperNFT, []);
        deployments.PaperNFT = await paperNFT.getAddress();
        console.log("✅ PaperNFT 部署完成:", deployments.PaperNFT);
        saveDeployments(deployments);
    }
    
    // 5. 部署 ReviewProcess (如果未部署)
    let reviewProcess;
    if (await isContractDeployed(deployments.ReviewProcess)) {
        console.log("\n✓ ReviewProcess 已部署，地址:", deployments.ReviewProcess);
        reviewProcess = await ethers.getContractAt("ReviewProcess", deployments.ReviewProcess);
    } else {
        console.log("\n📦 部署 ReviewProcess...");
        const ReviewProcess = await ethers.getContractFactory("ReviewProcess");
        reviewProcess = await deployWithRetry(ReviewProcess, [
            await paperNFT.getAddress(),
            await journalManager.getAddress()
        ]);
        deployments.ReviewProcess = await reviewProcess.getAddress();
        console.log("✅ ReviewProcess 部署完成:", deployments.ReviewProcess);
        saveDeployments(deployments);
    }
    
    // 6. 设置合约关联 (检查是否已设置)
    console.log("\n🔗 检查合约关联设置...");
    
    try {
        // 检查 JournalManager 是否已设置合约地址
        const currentReviewProcess = await journalManager.reviewProcess();
        const currentReviewerDAO = await journalManager.reviewerDAO();
        
        if (currentReviewProcess === ethers.ZeroAddress || currentReviewerDAO === ethers.ZeroAddress) {
            console.log("📝 设置 JournalManager 合约地址...");
            await journalManager.setContractAddresses(
                await reviewProcess.getAddress(),
                await reviewerDAO.getAddress()
            );
            console.log("✅ JournalManager 合约地址设置完成");
        } else {
            console.log("✓ JournalManager 合约地址已设置");
        }
        
        // 检查 ReviewerDAO 是否已授予 JournalManager EDITOR_ROLE
        const EDITOR_ROLE = await reviewerDAO.EDITOR_ROLE();
        const hasEditorRole = await reviewerDAO.hasRole(EDITOR_ROLE, await journalManager.getAddress());
        if (!hasEditorRole) {
            console.log("📝 授予 JournalManager EDITOR_ROLE...");
            await reviewerDAO.grantRole(EDITOR_ROLE, await journalManager.getAddress());
            console.log("✅ JournalManager EDITOR_ROLE 授予完成");
        } else {
            console.log("✓ JournalManager EDITOR_ROLE 已授予");
        }
        
        // 检查 ReviewProcess 是否已设置 ReviewerDAO
        const processReviewerDAO = await reviewProcess.reviewerDAO();
        if (processReviewerDAO === ethers.ZeroAddress) {
            console.log("📝 设置 ReviewProcess -> ReviewerDAO 关联...");
            await reviewProcess.setReviewerDAO(await reviewerDAO.getAddress());
            console.log("✅ ReviewProcess -> ReviewerDAO 关联设置完成");
        } else {
            console.log("✓ ReviewProcess -> ReviewerDAO 关联已设置");
        }
        
    } catch (error) {
        console.log("⚠️ 合约关联设置过程中出现错误:", error.message);
    }
    
    // 最终保存部署状态
    deployments.deployedAt = new Date().toISOString();
    deployments.network = "inj-testnet";
    saveDeployments(deployments);
    
    console.log("\n🎉 增量部署完成!");
    console.log("\n📋 最终部署地址:");
    console.log("ReviewerDAO:", deployments.ReviewerDAO);
    console.log("JournalManager:", deployments.JournalManager);
    console.log("ResearchDataNFT:", deployments.ResearchDataNFT);
    console.log("PaperNFT:", deployments.PaperNFT);
    console.log("ReviewProcess:", deployments.ReviewProcess);
    
    const finalBalance = await ethers.provider.getBalance(deployer.address);
    const gasUsed = balance - finalBalance;
    console.log("\n💰 Gas 使用情况:");
    console.log("消耗 Gas:", ethers.formatEther(gasUsed), "INJ");
    console.log("剩余余额:", ethers.formatEther(finalBalance), "INJ");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("部署失败:", error);
        process.exit(1);
    });