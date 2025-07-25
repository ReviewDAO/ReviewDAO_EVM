// 简化版期刊管理功能脚本
const hre = require("hardhat");
require('dotenv').config();

// 使用已部署的合约地址
const CONTRACT_ADDRESSES = {
  reviewerDAO: "0x7373064A3A00EBe5c91bD5Ba537253aA7eD7ded4",
  journalManager: "0x670830D6ee36eE813131c80d5C147C5663322CF5"
};

// 合约实例
let reviewerDAO;
let journalManager;

// 初始化合约实例
async function initContracts() {
  console.log("初始化合约实例...");
  
  const ReviewerDAO = await hre.ethers.getContractFactory("ReviewerDAO");
  const JournalManager = await hre.ethers.getContractFactory("JournalManager");

  reviewerDAO = ReviewerDAO.attach(CONTRACT_ADDRESSES.reviewerDAO);
  journalManager = JournalManager.attach(CONTRACT_ADDRESSES.journalManager);

  console.log("合约实例初始化完成\n");
}

// 期刊状态枚举
const JournalStatus = {
  Active: 0,
  Suspended: 1,
  Closed: 2
};

// 审稿人等级枚举
const ReviewerTier = {
  Junior: 0,
  Senior: 1,
  Expert: 2
};

// 获取期刊状态名称
function getJournalStatusName(status) {
  const statusNames = ['活跃', '暂停', '关闭'];
  return statusNames[status] || '未知';
}

// 获取审稿人等级名称
function getReviewerTierName(tier) {
  const tierNames = ['初级', '高级', '专家'];
  return tierNames[tier] || '未知';
}

// 创建新期刊
async function createJournal(name, description, chiefEditor, submissionFee = "0.01") {
  console.log(`\n=== 创建新期刊 ===`);
  console.log(`期刊名称: ${name}`);
  console.log(`主编: ${chiefEditor}`);
  console.log(`投稿费用: ${submissionFee} ETH`);
  
  try {
    const [deployer] = await hre.ethers.getSigners();
    
    const metadataURI = `ipfs://journal/${name.toLowerCase().replace(/\s+/g, '-')}`;
    const categories = ["Computer Science", "Blockchain Technology"];
    const fee = hre.ethers.parseEther(submissionFee);
    
    const tx = await journalManager.connect(deployer).createJournal(
      name,
      description,
      metadataURI,
      chiefEditor,
      fee,
      categories,
      ReviewerTier.Junior, // 最低审稿人等级
      2  // 所需审稿人数量
    );
    
    const receipt = await tx.wait();
    console.log(`期刊创建成功，交易哈希: ${receipt.hash}`);
    
    return receipt;
  } catch (error) {
    console.error(`创建期刊失败: ${error.message}`);
    throw error;
  }
}

// 查询单个期刊信息
async function queryJournalInfo(journalId) {
  console.log(`\n=== 查询期刊 #${journalId} 信息 ===`);
  
  try {
    const journal = await journalManager.getJournalInfo(journalId);
    
    console.log(`期刊 #${journalId}:`);
    console.log(`  名称: ${journal.name}`);
    console.log(`  描述: ${journal.description}`);
    console.log(`  所有者: ${journal.owner}`);
    console.log(`  状态: ${getJournalStatusName(journal.status)}`);
    console.log(`  创建时间: ${new Date(Number(journal.createdTime) * 1000).toLocaleString()}`);
    console.log(`  投稿费用: ${hre.ethers.formatEther(journal.submissionFee)} ETH`);
    console.log(`  总投稿数: ${journal.totalSubmissions}`);
    console.log(`  总发表数: ${journal.totalPublished}`);
    console.log(`  最低审稿人等级: ${getReviewerTierName(journal.minReviewerTier)}`);
    console.log(`  所需审稿人数: ${journal.requiredReviewers}`);
    console.log(`  学科分类: ${journal.categories.join(', ')}`);
    
    return journal;
  } catch (error) {
    console.error(`查询期刊 #${journalId} 信息失败: ${error.message}`);
    throw error;
  }
}

// 更新投稿费用
async function updateSubmissionFee(journalId, newFee) {
  console.log(`\n=== 更新投稿费用 ===`);
  console.log(`期刊ID: ${journalId}`);
  console.log(`新费用: ${newFee} ETH`);
  
  try {
    const [deployer] = await hre.ethers.getSigners();
    
    const fee = hre.ethers.parseEther(newFee);
    const tx = await journalManager.connect(deployer).updateSubmissionFee(journalId, fee);
    const receipt = await tx.wait();
    
    console.log(`投稿费用更新成功，交易哈希: ${receipt.hash}`);
    return receipt;
  } catch (error) {
    console.error(`更新投稿费用失败: ${error.message}`);
    throw error;
  }
}

// 更新期刊状态
async function updateJournalStatus(journalId, newStatus) {
  console.log(`\n=== 更新期刊状态 ===`);
  console.log(`期刊ID: ${journalId}`);
  console.log(`新状态: ${getJournalStatusName(newStatus)}`);
  
  try {
    const [deployer] = await hre.ethers.getSigners();
    
    const tx = await journalManager.connect(deployer).updateJournalStatus(journalId, newStatus);
    const receipt = await tx.wait();
    
    console.log(`期刊状态更新成功，交易哈希: ${receipt.hash}`);
    return receipt;
  } catch (error) {
    console.error(`更新期刊状态失败: ${error.message}`);
    throw error;
  }
}

// 更新期刊审稿要求
async function updateJournalRequirements(journalId, minReviewerTier, requiredReviewers) {
  console.log(`\n=== 更新期刊审稿要求 ===`);
  console.log(`期刊ID: ${journalId}`);
  console.log(`最低审稿人等级: ${getReviewerTierName(minReviewerTier)}`);
  console.log(`所需审稿人数: ${requiredReviewers}`);
  
  try {
    const [deployer] = await hre.ethers.getSigners();
    
    const tx = await journalManager.connect(deployer).updateJournalRequirements(
      journalId,
      minReviewerTier,
      requiredReviewers
    );
    const receipt = await tx.wait();
    
    console.log(`期刊审稿要求更新成功，交易哈希: ${receipt.hash}`);
    return receipt;
  } catch (error) {
    console.error(`更新期刊审稿要求失败: ${error.message}`);
    throw error;
  }
}

// 添加期刊编辑
async function addJournalEditor(journalId, editorAddress) {
  console.log(`\n=== 添加期刊编辑 ===`);
  console.log(`期刊ID: ${journalId}`);
  console.log(`编辑地址: ${editorAddress}`);
  
  try {
    const [deployer] = await hre.ethers.getSigners();
    
    const tx = await journalManager.connect(deployer).addEditor(journalId, editorAddress);
    const receipt = await tx.wait();
    
    console.log(`编辑添加成功，交易哈希: ${receipt.hash}`);
    return receipt;
  } catch (error) {
    console.error(`添加编辑失败: ${error.message}`);
    throw error;
  }
}

// 查询期刊编辑列表
async function queryJournalEditors(journalId) {
  console.log(`\n=== 查询期刊 #${journalId} 编辑列表 ===`);
  
  try {
    const editors = await journalManager.getJournalEditors(journalId);
    console.log(`编辑数量: ${editors.length}`);
    
    if (editors.length > 0) {
      console.log(`编辑列表:`);
      editors.forEach((editor, index) => {
        console.log(`  ${index + 1}. ${editor}`);
      });
    } else {
      console.log(`该期刊暂无编辑`);
    }
    
    return editors;
  } catch (error) {
    console.error(`查询期刊编辑列表失败: ${error.message}`);
    throw error;
  }
}

// 查询期刊统计信息
async function queryJournalStats(journalId) {
  console.log(`\n=== 查询期刊 #${journalId} 统计信息 ===`);
  
  try {
    const stats = await journalManager.getJournalStats(journalId);
    
    console.log(`统计信息:`);
    console.log(`  接受率: ${stats.acceptanceRate / 100}%`);
    console.log(`  平均审稿时间: ${stats.averageReviewTime} 天`);
    console.log(`  影响力分数: ${stats.impactScore}`);
    console.log(`  总引用数: ${stats.totalCitations}`);
    
    return stats;
  } catch (error) {
    console.error(`查询期刊统计信息失败: ${error.message}`);
    throw error;
  }
}

// 主函数 - 演示期刊管理功能
async function main() {
  console.log("=== 期刊管理功能演示 ===");
  
  await initContracts();
  
  const [deployer] = await hre.ethers.getSigners();
  console.log(`当前账户: ${deployer.address}`);
  
  try {
    // 1. 创建一个新期刊
    console.log(`\n=== 步骤1: 创建新期刊 ===`);
    
    try {
      await createJournal(
        "区块链技术研究期刊",
        "专注于区块链技术创新与应用的学术期刊",
        deployer.address,
        "0.008"
      );
    } catch (error) {
      console.log(`创建期刊跳过（可能已存在）: ${error.message}`);
    }
    
    // 2. 查询期刊信息（假设期刊ID为0和1）
    console.log(`\n=== 步骤2: 查询期刊信息 ===`);
    
    const journalIds = [0, 1, 2]; // 尝试查询前几个期刊
    
    for (const journalId of journalIds) {
      try {
        await queryJournalInfo(journalId);
        
        // 查询编辑列表
        await queryJournalEditors(journalId);
        
        // 查询统计信息
        await queryJournalStats(journalId);
        
      } catch (error) {
        console.log(`期刊 #${journalId} 不存在或查询失败: ${error.message}`);
      }
    }
    
    // 3. 演示期刊管理功能（使用期刊ID 0）
    console.log(`\n=== 步骤3: 演示期刊管理功能 ===`);
    
    const targetJournalId = 0;
    
    try {
      // 添加编辑
      await addJournalEditor(targetJournalId, deployer.address);
    } catch (error) {
      console.log(`添加编辑跳过: ${error.message}`);
    }
    
    try {
      // 更新投稿费用
      await updateSubmissionFee(targetJournalId, "0.012");
    } catch (error) {
      console.log(`更新投稿费用失败: ${error.message}`);
    }
    
    try {
      // 更新审稿要求
      await updateJournalRequirements(targetJournalId, ReviewerTier.Senior, 3);
    } catch (error) {
      console.log(`更新审稿要求失败: ${error.message}`);
    }
    
    // 4. 查看更新后的期刊信息
    console.log(`\n=== 步骤4: 查看更新后的期刊信息 ===`);
    
    try {
      await queryJournalInfo(targetJournalId);
      await queryJournalEditors(targetJournalId);
      await queryJournalStats(targetJournalId);
    } catch (error) {
      console.log(`查询更新后信息失败: ${error.message}`);
    }
    
    console.log(`\n=== 期刊管理功能演示完成 ===`);
    
  } catch (error) {
    console.error("演示过程中发生错误:", error.message);
    throw error;
  }
}

// 执行主函数
if (require.main === module) {
  main()
    .then(() => {
      console.log("\n脚本执行完成");
      process.exit(0);
    })
    .catch((error) => {
      console.error("\n脚本执行失败:", error);
      process.exit(1);
    });
}

// 导出函数供其他脚本使用
module.exports = {
  initContracts,
  createJournal,
  queryJournalInfo,
  updateSubmissionFee,
  updateJournalStatus,
  updateJournalRequirements,
  addJournalEditor,
  queryJournalEditors,
  queryJournalStats,
  JournalStatus,
  ReviewerTier
};