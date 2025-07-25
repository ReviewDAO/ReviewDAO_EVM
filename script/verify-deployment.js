const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

const DEPLOYMENT_FILE = path.join(__dirname, "inj-testnet-deployments.json");

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

// 验证合约功能
async function verifyContractFunctions(contractName, address, abi) {
    try {
        const contract = await ethers.getContractAt(contractName, address);
        
        // 基本功能测试
        switch (contractName) {
            case "ReviewerDAO":
                const name = await contract.name();
                const symbol = await contract.symbol();
                console.log(`  ✓ ReviewerDAO - Name: ${name}, Symbol: ${symbol}`);
                break;
                
            case "JournalManager":
                const adminRole = await contract.ADMIN_ROLE();
                const editorRole = await contract.EDITOR_ROLE();
                console.log(`  ✓ JournalManager - Admin Role: ${adminRole.slice(0,10)}..., Editor Role: ${editorRole.slice(0,10)}...`);
                break;
                
            case "ResearchDataNFT":
                const rdtName = await contract.name();
                const rdtSymbol = await contract.symbol();
                console.log(`  ✓ ResearchDataNFT - Name: ${rdtName}, Symbol: ${rdtSymbol}`);
                break;
                
            case "PaperNFT":
                const paperName = await contract.name();
                const paperSymbol = await contract.symbol();
                const baseFee = await contract.baseCitationFee();
                console.log(`  ✓ PaperNFT - Name: ${paperName}, Symbol: ${paperSymbol}, Base Fee: ${ethers.formatEther(baseFee)} INJ`);
                break;
                
            case "ReviewProcess":
                // 检查是否有基本的状态变量
                console.log(`  ✓ ReviewProcess - 合约已部署并可访问`);
                break;
        }
        return true;
    } catch (error) {
        console.log(`  ✗ ${contractName} - 功能验证失败: ${error.message}`);
        return false;
    }
}

async function main() {
    console.log("🔍 开始验证 Injective Testnet 部署状态...");
    
    // 检查部署文件是否存在
    if (!fs.existsSync(DEPLOYMENT_FILE)) {
        console.log("❌ 部署文件不存在:", DEPLOYMENT_FILE);
        return;
    }
    
    // 读取部署信息
    const deployments = JSON.parse(fs.readFileSync(DEPLOYMENT_FILE, 'utf8'));
    console.log("\n📋 部署信息:");
    console.log(`网络: ${deployments.network}`);
    console.log(`部署时间: ${deployments.deployedAt}`);
    
    const [deployer] = await ethers.getSigners();
    console.log(`\n👤 验证账户: ${deployer.address}`);
    
    const balance = await ethers.provider.getBalance(deployer.address);
    console.log(`💰 账户余额: ${ethers.formatEther(balance)} INJ`);
    
    console.log("\n🔍 验证合约部署状态:");
    
    const contracts = [
        { name: "ReviewerDAO", address: deployments.ReviewerDAO },
        { name: "JournalManager", address: deployments.JournalManager },
        { name: "ResearchDataNFT", address: deployments.ResearchDataNFT },
        { name: "PaperNFT", address: deployments.PaperNFT },
        { name: "ReviewProcess", address: deployments.ReviewProcess }
    ];
    
    let allDeployed = true;
    let allFunctional = true;
    
    for (const contract of contracts) {
        console.log(`\n📦 ${contract.name}:`);
        console.log(`  地址: ${contract.address}`);
        
        // 验证部署状态
        const isDeployed = await isContractDeployed(contract.address);
        if (isDeployed) {
            console.log(`  ✅ 已部署`);
            
            // 验证功能
            const isFunctional = await verifyContractFunctions(contract.name, contract.address, null);
            if (!isFunctional) {
                allFunctional = false;
            }
        } else {
            console.log(`  ❌ 未部署或无效`);
            allDeployed = false;
            allFunctional = false;
        }
        
        // 生成区块浏览器链接
        const explorerUrl = `https://testnet.explorer.injective.network/account/${contract.address}`;
        console.log(`  🔗 浏览器: ${explorerUrl}`);
    }
    
    console.log("\n📊 验证总结:");
    console.log(`✅ 部署状态: ${allDeployed ? '全部成功' : '部分失败'}`);
    console.log(`🔧 功能状态: ${allFunctional ? '全部正常' : '部分异常'}`);
    
    if (allDeployed && allFunctional) {
        console.log("\n🎉 所有合约部署成功且功能正常！");

    } else {
        console.log("\n⚠️ 部分合约存在问题，请检查并重新部署");
    }
    
    console.log("\n💡 有用链接:");
    console.log(`📊 Injective Testnet Explorer: https://testnet.explorer.injective.network/`);
    console.log(`🚰 获取测试代币: https://testnet.faucet.injective.network/`);
    console.log(`📖 Injective 文档: https://docs.injective.network/`);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("验证失败:", error);
        process.exit(1);
    });