// 向已部署的合约写入测试数据的脚本
const hre = require("hardhat");

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

  console.log("合约实例初始化完成");
  console.log("合约地址:");
  console.log("- PaperNFT:", CONTRACT_ADDRESSES.paperNFT);
  console.log("- ReviewProcess:", CONTRACT_ADDRESSES.reviewProcess);
  console.log("- ReviewerDAO:", CONTRACT_ADDRESSES.reviewerDAO);
  console.log("- JournalManager:", CONTRACT_ADDRESSES.journalManager);
  console.log("- ResearchDataNFT:", CONTRACT_ADDRESSES.researchDataNFT);
}

// 创建研究数据NFT
async function createResearchData(authorAddress, ipfsHash, price, isPublic, metadataURI) {
  const author = await hre.ethers.getSigner(authorAddress);
  
  console.log(`\n创建研究数据NFT...`);
  console.log(`作者: ${authorAddress}`);
  console.log(`IPFS哈希: ${ipfsHash}`);
  console.log(`价格: ${hre.ethers.formatEther(price)} ETH`);
  console.log(`是否公开: ${isPublic}`);
  
  try {
    const tx = await researchDataNFT.connect(author).createDataItem(
      ipfsHash,
      price,
      isPublic,
      metadataURI
    );
    
    const receipt = await tx.wait();
    console.log(`研究数据NFT创建成功，交易哈希: ${receipt.hash}`);
    
    return receipt;
  } catch (error) {
    console.error(`创建研究数据NFT失败: ${error.message}`);
    throw error;
  }
}

// 创建论文NFT
async function createPaper(authorAddress, ipfsHash, doi, metadataURI) {
  const author = await hre.ethers.getSigner(authorAddress);
  
  console.log(`\n创建论文NFT...`);
  console.log(`作者: ${authorAddress}`);
  console.log(`IPFS哈希: ${ipfsHash}`);
  console.log(`DOI: ${doi}`);
  
  try {
    const tx = await paperNFT.connect(author).createPaperItem(
      ipfsHash,
      doi,
      metadataURI
    );
    
    const receipt = await tx.wait();
    console.log(`论文NFT创建成功，交易哈希: ${receipt.hash}`);
    
    return receipt;
  } catch (error) {
    console.error(`创建论文NFT失败: ${error.message}`);
    throw error;
  }
}

// 创建期刊
async function createJournal(adminAddress, name, description, chiefEditor) {
  const admin = await hre.ethers.getSigner(adminAddress);
  
  console.log(`\n创建期刊...`);
  console.log(`期刊名称: ${name}`);
  console.log(`主编: ${chiefEditor}`);
  
  try {
    const metadataURI = `ipfs://journal/${name.toLowerCase().replace(/\s+/g, '-')}`;
    const categories = ["Computer Science", "Blockchain Technology"];
    const submissionFee = hre.ethers.parseEther("0.01"); // 0.01 ETH
    
    const tx = await journalManager.connect(admin).createJournal(
      name,
      description,
      metadataURI,
      chiefEditor,
      submissionFee,
      categories,
      0, // Junior tier
      2  // 需要2个审稿人
    );
    
    const receipt = await tx.wait();
    console.log(`期刊创建成功，交易哈希: ${receipt.hash}`);
    
    return receipt;
  } catch (error) {
    console.error(`创建期刊失败: ${error.message}`);
    throw error;
  }
}

// 注册审稿人
async function registerReviewer(reviewerAddress, metadataURI) {
  const reviewer = await hre.ethers.getSigner(reviewerAddress);
  
  console.log(`\n注册审稿人...`);
  console.log(`审稿人地址: ${reviewerAddress}`);
  
  try {
    const tx = await reviewerDAO.connect(reviewer).registerAsReviewer(metadataURI);
    const receipt = await tx.wait();
    console.log(`审稿人注册成功，交易哈希: ${receipt.hash}`);
    
    return receipt;
  } catch (error) {
    if (error.message.includes('Already registered')) {
      console.log(`审稿人已注册，跳过注册步骤`);
      return null;
    } else {
      console.error(`注册审稿人失败: ${error.message}`);
      throw error;
    }
  }
}

// 投稿论文
async function submitPaper(authorAddress, paperId, journalId, metadataURI) {
  const author = await hre.ethers.getSigner(authorAddress);
  
  console.log(`\n投稿论文...`);
  console.log(`论文ID: ${paperId}`);
  console.log(`期刊ID: ${journalId}`);
  
  try {
    const tx = await reviewProcess.connect(author).createSubmission(
      paperId,
      journalId,
      metadataURI
    );
    
    const receipt = await tx.wait();
    console.log(`投稿成功，交易哈希: ${receipt.hash}`);
    
    return receipt;
  } catch (error) {
    console.error(`投稿失败: ${error.message}`);
    throw error;
  }
}

// 主函数 - 写入测试数据
async function main() {
  console.log("=== 开始写入测试数据 ===");
  
  await initContracts();
  
  const signers = await hre.ethers.getSigners();
  const deployer = signers[0];
  
  // 如果只有一个账户，就用同一个账户扮演所有角色
  const author1 = signers[1] || deployer;
  const author2 = signers[2] || deployer;
  const chiefEditor = signers[3] || deployer;
  const reviewer1 = signers[4] || deployer;
  const reviewer2 = signers[5] || deployer;
  
  console.log("\n账户信息:");
  console.log(`部署者: ${deployer.address}`);
  console.log(`作者1: ${author1.address}`);
  console.log(`作者2: ${author2.address}`);
  console.log(`主编: ${chiefEditor.address}`);
  console.log(`审稿人1: ${reviewer1.address}`);
  console.log(`审稿人2: ${reviewer2.address}`);
  
  if (signers.length === 1) {
    console.log("\n注意: 只检测到一个账户，将使用同一账户扮演所有角色");
  }
  
  try {
    // 1. 创建研究数据NFT
    console.log("\n=== 步骤1: 创建研究数据NFT ===");
    await createResearchData(
      author1.address,
      "QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG",
      hre.ethers.parseEther("0.01"), // 0.01 ETH
      true, // 公开数据
      "ipfs://research-data/dataset1"
    );
    
    await createResearchData(
      author2.address,
      "QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdH",
      hre.ethers.parseEther("0.02"), // 0.02 ETH
      false, // 私有数据
      "ipfs://research-data/dataset2"
    );
    
    // 2. 创建论文NFT
    console.log("\n=== 步骤2: 创建论文NFT ===");
    await createPaper(
      author1.address,
      "QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG",
      "10.1000/blockchain.2024.001",
      "ipfs://paper/metadata1"
    );
    
    await createPaper(
      author2.address,
      "QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdH",
      "10.1000/blockchain.2024.002",
      "ipfs://paper/metadata2"
    );
    
    // 3. 创建期刊
    console.log("\n=== 步骤3: 创建期刊 ===");
    await createJournal(
      deployer.address,
      "区块链技术研究期刊",
      "专注于区块链技术和去中心化应用研究的学术期刊",
      chiefEditor.address
    );
    
    await createJournal(
      deployer.address,
      "人工智能与机器学习期刊",
      "人工智能、机器学习和深度学习领域的前沿研究",
      chiefEditor.address
    );
    
    // 4. 注册审稿人
    console.log("\n=== 步骤4: 注册审稿人 ===");
    await registerReviewer(
      reviewer1.address,
      "ipfs://reviewer/profile1"
    );
    
    await registerReviewer(
      reviewer2.address,
      "ipfs://reviewer/profile2"
    );
    
    // 5. 投稿论文
    console.log("\n=== 步骤5: 投稿论文 ===");
    await submitPaper(
      author1.address,
      0, // 第一个论文NFT的ID
      0, // 第一个期刊的ID
      "ipfs://submission/metadata1"
    );
    
    await submitPaper(
      author2.address,
      1, // 第二个论文NFT的ID
      1, // 第二个期刊的ID
      "ipfs://submission/metadata2"
    );
    
    console.log("\n=== 测试数据写入完成 ===");
    console.log("\n已创建的测试数据:");
    console.log("- 2个研究数据NFT");
    console.log("- 2个论文NFT");
    console.log("- 2个期刊");
    console.log("- 2个注册审稿人");
    console.log("- 2个论文投稿");
    
  } catch (error) {
    console.error("\n写入测试数据时发生错误:", error.message);
    throw error;
  }
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