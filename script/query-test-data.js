// 查询已写入的测试数据的脚本
const hre = require("hardhat");
require('dotenv').config();

// 使用已部署的合约地址
const CONTRACT_ADDRESSES = {
  researchDataNFT: "0xaDdb7A35aA2212cD58a2ef0e4105D7B65Ce61D69",
  paperNFT: "0x945BD6d2367367c7b503Cb739B11c5A5cd7e92DD",
  reviewProcess: "0xB23dD3dA569f1A55e3eE2bC5d473b81aE1B23927",
  reviewerDAO: "0x7373064A3A00EBe5c91bD5Ba537253aA7eD7ded4",
  journalManager: "0x670830D6ee36eE813131c80d5C147C5663322CF5"
};

// 合约实例
let paperNFT;
let reviewProcess;
let reviewerDAO;
let journalManager;
let researchDataNFT;

// 初始化合约实例
async function initContracts() {
  console.log("初始化合约实例...");
  
  // 获取合约工厂
  const PaperNFT = await hre.ethers.getContractFactory("PaperNFT");
  const ReviewProcess = await hre.ethers.getContractFactory("ReviewProcess");
  const ReviewerDAO = await hre.ethers.getContractFactory("ReviewerDAO");
  const JournalManager = await hre.ethers.getContractFactory("JournalManager");
  const ResearchDataNFT = await hre.ethers.getContractFactory("ResearchDataNFT");

  // 连接到已部署的合约
  paperNFT = PaperNFT.attach(CONTRACT_ADDRESSES.paperNFT);
  reviewProcess = ReviewProcess.attach(CONTRACT_ADDRESSES.reviewProcess);
  reviewerDAO = ReviewerDAO.attach(CONTRACT_ADDRESSES.reviewerDAO);
  journalManager = JournalManager.attach(CONTRACT_ADDRESSES.journalManager);
  researchDataNFT = ResearchDataNFT.attach(CONTRACT_ADDRESSES.researchDataNFT);

  console.log("合约实例初始化完成\n");
}

// 查询研究数据NFT
async function queryResearchData() {
  console.log("=== 查询研究数据NFT ===");
  
  try {
    const totalSupply = await researchDataNFT.totalSupply();
    console.log(`研究数据NFT总数: ${totalSupply}`);
    
    for (let i = 0; i < totalSupply; i++) {
      const tokenId = await researchDataNFT.tokenByIndex(i);
      const dataItem = await researchDataNFT.dataItems(tokenId);
      const owner = await researchDataNFT.ownerOf(tokenId);
      
      console.log(`\n研究数据NFT #${tokenId}:`);
      console.log(`  所有者: ${owner}`);
      console.log(`  IPFS哈希: ${dataItem.ipfsHash}`);
      console.log(`  价格: ${hre.ethers.formatEther(dataItem.price)} ETH`);
      console.log(`  是否公开: ${dataItem.isPublic}`);
      console.log(`  总收入: ${hre.ethers.formatEther(dataItem.totalEarned)} ETH`);
      console.log(`  创建时间: ${new Date(Number(dataItem.createdAt) * 1000).toLocaleString()}`);
      console.log(`  元数据URI: ${dataItem.metadataURI}`);
    }
  } catch (error) {
    console.error(`查询研究数据NFT失败: ${error.message}`);
  }
}

// 查询论文NFT
async function queryPaperNFTs() {
  console.log("\n=== 查询论文NFT ===");
  
  try {
    const totalSupply = await paperNFT.totalSupply();
    console.log(`论文NFT总数: ${totalSupply}`);
    
    for (let i = 0; i < totalSupply; i++) {
      const tokenId = await paperNFT.tokenByIndex(i);
      const dataItem = await paperNFT.dataItems(tokenId); // 使用继承的dataItems
      const doi = await paperNFT.paperDOIs(tokenId); // 使用paperDOIs获取DOI
      const owner = await paperNFT.ownerOf(tokenId);
      
      console.log(`\n论文NFT #${tokenId}:`);
      console.log(`  所有者: ${owner}`);
      console.log(`  IPFS哈希: ${dataItem.ipfsHash}`);
      console.log(`  DOI: ${doi}`);
      console.log(`  创建时间: ${new Date(Number(dataItem.createdAt) * 1000).toLocaleString()}`);
      console.log(`  元数据URI: ${dataItem.metadataURI}`);
    }
  } catch (error) {
    console.error(`查询论文NFT失败: ${error.message}`);
  }
}

// 查询期刊信息
async function queryJournals() {
  console.log("\n=== 查询期刊信息 ===");
  
  try {
    const journalCount = await journalManager.getJournalCount();
    console.log(`期刊总数: ${journalCount}`);
    
    if (journalCount == 0) {
      console.log("没有找到任何期刊，可能期刊创建失败或期刊ID从1开始");
      
      // 尝试查询期刊ID 1和2
      for (let i = 1; i <= 2; i++) {
        try {
          const journal = await journalManager.getJournalInfo(i);
          console.log(`\n期刊 #${i} (直接查询):`);
          console.log(`  名称: ${journal.name}`);
          console.log(`  描述: ${journal.description}`);
          console.log(`  所有者: ${journal.owner}`);
          console.log(`  状态: ${getJournalStatusName(journal.status)}`);
          console.log(`  创建时间: ${new Date(Number(journal.createdTime) * 1000).toLocaleString()}`);
          console.log(`  投稿费用: ${hre.ethers.formatEther(journal.submissionFee)} ETH`);
        } catch (error) {
          console.log(`期刊 #${i}: 不存在或查询失败 - ${error.message}`);
        }
      }
      return;
    }
    
    // 期刊ID从0开始
    for (let i = 0; i < journalCount; i++) {
      try {
        const journal = await journalManager.getJournalInfo(i);
        
        console.log(`\n期刊 #${i}:`);
        console.log(`  名称: ${journal.name}`);
        console.log(`  描述: ${journal.description}`);
        console.log(`  所有者: ${journal.owner}`);
        console.log(`  状态: ${getJournalStatusName(journal.status)}`);
        console.log(`  创建时间: ${new Date(Number(journal.createdTime) * 1000).toLocaleString()}`);
        console.log(`  投稿费用: ${hre.ethers.formatEther(journal.submissionFee)} ETH`);
        console.log(`  总投稿数: ${journal.totalSubmissions}`);
        console.log(`  总发表数: ${journal.totalPublished}`);
        console.log(`  最低审稿人等级: ${journal.minReviewerTier}`);
        console.log(`  所需审稿人数: ${journal.requiredReviewers}`);
        
        // 查询期刊编辑
        try {
          const editors = await journalManager.getJournalEditors(i);
          console.log(`  编辑: ${editors.length > 0 ? editors.join(', ') : '无'}`);
        } catch (error) {
          console.log(`  编辑: 查询失败 - ${error.message}`);
        }
      } catch (error) {
        console.log(`\n期刊 #${i}: 查询失败 - ${error.message}`);
      }
    }
  } catch (error) {
    console.error(`查询期刊信息失败: ${error.message}`);
  }
}

// 查询审稿人信息
async function queryReviewers() {
  console.log("\n=== 查询审稿人信息 ===");
  
  try {
    const [deployer] = await hre.ethers.getSigners();
    const REVIEWER_ROLE = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("REVIEWER_ROLE"));
    
    // 检查部署者是否是审稿人
    const isReviewer = await reviewerDAO.hasRole(REVIEWER_ROLE, deployer.address);
    console.log(`地址 ${deployer.address} 是否为审稿人: ${isReviewer}`);
    
    if (isReviewer) {
      try {
        const reviewerInfo = await reviewerDAO.reviewers(deployer.address);
        console.log(`\n审稿人信息:`);
        console.log(`  地址: ${deployer.address}`);
        console.log(`  等级: ${reviewerInfo.tier}`);
        console.log(`  声誉: ${reviewerInfo.reputation}`);
        console.log(`  完成的审稿数: ${reviewerInfo.reviewsCompleted}`);
        console.log(`  注册时间: ${new Date(Number(reviewerInfo.registeredAt) * 1000).toLocaleString()}`);
        console.log(`  元数据URI: ${reviewerInfo.metadataURI}`);
      } catch (error) {
        console.log(`  查询审稿人详细信息失败: ${error.message}`);
      }
    }
    
    // 查询代币信息
    try {
      const tokenName = await reviewerDAO.name();
      const tokenSymbol = await reviewerDAO.symbol();
      const balance = await reviewerDAO.balanceOf(deployer.address);
      
      console.log(`\n审稿人代币信息:`);
      console.log(`  代币名称: ${tokenName}`);
      console.log(`  代币符号: ${tokenSymbol}`);
      console.log(`  ${deployer.address} 的余额: ${hre.ethers.formatEther(balance)} ${tokenSymbol}`);
    } catch (error) {
      console.log(`  查询代币信息失败: ${error.message}`);
    }
  } catch (error) {
    console.error(`查询审稿人信息失败: ${error.message}`);
  }
}

// 查询投稿信息
async function querySubmissions() {
  console.log("\n=== 查询投稿信息 ===");
  
  try {
    // 由于没有submissionCounter方法，我们尝试查询前几个投稿
    let submissionCount = 0;
    let maxCheck = 10; // 最多检查10个投稿
    
    console.log(`检查投稿信息...`);
    
    for (let i = 0; i < maxCheck; i++) {
      try {
        const submission = await reviewProcess.submissions(i);
        
        // 检查投稿是否存在（通过检查作者地址是否为零地址）
        if (submission.author === '0x0000000000000000000000000000000000000000') {
          break;
        }
        
        submissionCount++;
        
        console.log(`\n投稿 #${i}:`);
        console.log(`  作者: ${submission.author}`);
        console.log(`  论文ID: ${submission.paperId}`);
        console.log(`  期刊ID: ${submission.journalId}`);
        console.log(`  状态: ${getSubmissionStatusName(submission.status)}`);
        console.log(`  提交时间: ${new Date(Number(submission.submissionTime) * 1000).toLocaleString()}`);
        console.log(`  最后更新: ${new Date(Number(submission.lastUpdateTime) * 1000).toLocaleString()}`);
        console.log(`  修改次数: ${submission.revisionCount}`);
        console.log(`  元数据URI: ${submission.metadataURI}`);
        
        // 查询分配的审稿人
        console.log(`  分配的审稿人: ${submission.reviewers.join(', ')}`);
        
      } catch (error) {
        // 如果查询失败，说明没有更多投稿了
        break;
      }
    }
    
    console.log(`\n找到 ${submissionCount} 个投稿`);
    
  } catch (error) {
    console.error(`查询投稿信息失败: ${error.message}`);
  }
}

// 获取投稿状态名称
function getSubmissionStatusName(status) {
  const statusNames = {
    0: "已投稿",
    1: "审稿中",
    2: "已拒绝",
    3: "需要修改",
    4: "已接受",
    5: "已发表"
  };
  return statusNames[status] || `未知状态(${status})`;
}

// 获取期刊状态名称
function getJournalStatusName(status) {
  const statusNames = {
    0: "活跃",
    1: "暂停",
    2: "关闭"
  };
  return statusNames[status] || `未知状态(${status})`;
}

// 主函数
async function main() {
  console.log("=== 查询测试数据 ===");
  console.log(`查询时间: ${new Date().toLocaleString()}\n`);
  
  await initContracts();
  
  // 查询所有数据
  await queryResearchData();
  await queryPaperNFTs();
  await queryJournals();
  await queryReviewers();
  await querySubmissions();
  
  console.log("\n=== 查询完成 ===");
}

// 执行主函数
main()
  .then(() => {
    console.log("\n脚本执行完成");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n脚本执行失败:", error);
    process.exit(1);
  });