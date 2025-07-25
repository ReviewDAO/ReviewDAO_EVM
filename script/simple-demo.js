const { ethers } = require("hardhat");

// 简化的演示脚本，避免复杂的查询操作
async function main() {
  console.log("=== 链上学术评价体系简化演示 ===");
  
  // 获取签名者
  const [admin, chiefEditor, editor, author, reviewer1, reviewer2] = await ethers.getSigners();
  
  console.log("管理员:", admin.address);
  console.log("主编:", chiefEditor.address);
  console.log("编辑:", editor.address);
  console.log("作者:", author.address);
  console.log("审稿人1:", reviewer1.address);
  console.log("审稿人2:", reviewer2.address);
  
  try {
    // 1. 部署合约
    console.log("\n=== 部署合约 ===");
    
    // 部署ResearchDataNFT
    const ResearchDataNFT = await ethers.getContractFactory("ResearchDataNFT");
    const researchDataNFT = await ResearchDataNFT.deploy();
    await researchDataNFT.waitForDeployment();
    console.log("ResearchDataNFT 部署地址:", await researchDataNFT.getAddress());
    
    // 部署PaperNFT
    const PaperNFT = await ethers.getContractFactory("PaperNFT");
    const paperNFT = await PaperNFT.deploy();
    await paperNFT.waitForDeployment();
    console.log("PaperNFT 部署地址:", await paperNFT.getAddress());
    
    // 部署ReviewerDAO
    const ReviewerDAO = await ethers.getContractFactory("ReviewerDAO");
    const reviewerDAO = await ReviewerDAO.deploy("ReviewerDAO Token", "RDT");
    await reviewerDAO.waitForDeployment();
    console.log("ReviewerDAO 部署地址:", await reviewerDAO.getAddress());
    
    // 部署JournalManager
    const JournalManager = await ethers.getContractFactory("JournalManager");
    const journalManager = await JournalManager.deploy();
    await journalManager.waitForDeployment();
    console.log("JournalManager 部署地址:", await journalManager.getAddress());
    
    // 部署ReviewProcess
    const ReviewProcess = await ethers.getContractFactory("ReviewProcess");
    const reviewProcess = await ReviewProcess.deploy(
      await paperNFT.getAddress(),
      await journalManager.getAddress()
    );
    await reviewProcess.waitForDeployment();
    console.log("ReviewProcess 部署地址:", await reviewProcess.getAddress());
    
    // 2. 设置合约关联
    console.log("\n=== 设置合约关联 ===");
    
    await journalManager.setContractAddresses(
      await reviewProcess.getAddress(),
      await reviewerDAO.getAddress()
    );
    console.log("JournalManager 合约关联设置完成");
    
    // ReviewProcess在构造函数中已设置JournalManager地址
    console.log("ReviewProcess 合约关联已在构造函数中完成");
    
    // 3. 权限设置
    console.log("\n=== 权限设置 ===");
    
    const EDITOR_ROLE = await journalManager.EDITOR_ROLE();
    await reviewerDAO.grantRole(EDITOR_ROLE, await journalManager.getAddress());
    console.log("JournalManager 获得 ReviewerDAO 的 EDITOR_ROLE 权限");
    
    // 4. 创建期刊
    console.log("\n=== 创建期刊 ===");
    
    const categories = ["Blockchain", "Computer Science"];
    await journalManager.createJournal(
      "Blockchain Research Journal",
      "A journal dedicated to blockchain technology research",
      "https://ipfs.io/ipfs/journal-metadata",
      chiefEditor.address,
      ethers.parseEther("0.1"),
      categories,
      0, // ReviewerDAO.ReviewerTier.Junior
      3  // 需要3个审稿人
    );
    console.log("期刊创建成功");
    
    // 5. 注册审稿人
    console.log("\n=== 注册审稿人 ===");
    
    await reviewerDAO.connect(reviewer1).registerAsReviewer(
      "https://ipfs.io/ipfs/reviewer1-metadata"
    );
    console.log("审稿人1注册成功");
    
    await reviewerDAO.connect(reviewer2).registerAsReviewer(
      "https://ipfs.io/ipfs/reviewer2-metadata"
    );
    console.log("审稿人2注册成功");
    
    // 6. 创建论文NFT
    console.log("\n=== 创建论文NFT ===");
    
    await paperNFT.connect(author).createPaperItem(
      "QmPaperHash123",
      "10.1234/blockchain.2023.001",
      "https://ipfs.io/ipfs/paper-metadata"
    );
    console.log("论文NFT创建成功");
    
    // 7. 投稿
    console.log("\n=== 投稿 ===");
    
    await reviewProcess.connect(author).createSubmission(
      0, // 论文ID
      0, // 期刊ID
      "https://ipfs.io/ipfs/submission-metadata"
    );
    console.log("投稿成功");
    
    // 8. 添加编辑
    console.log("\n=== 添加编辑 ===");
    
    await journalManager.connect(chiefEditor).addEditor(0, editor.address);
    console.log("编辑添加成功");
    
    // 9. 分配审稿人
    console.log("\n=== 分配审稿人 ===");
    
    try {
      await journalManager.connect(editor).assignReviewer(0, reviewer1.address);
      console.log("审稿人1分配成功");
    } catch (error) {
      console.log("审稿人1分配失败:", error.message);
    }
    
    try {
      await journalManager.connect(editor).assignReviewer(0, reviewer2.address);
      console.log("审稿人2分配成功");
    } catch (error) {
      console.log("审稿人2分配失败:", error.message);
    }
    
    // 10. 提交审稿意见
    console.log("\n=== 提交审稿意见 ===");
    
    try {
      await reviewProcess.connect(reviewer1).submitReview(
        0, // 投稿ID
        1, // 决定: Accept
        "QmReviewHash123"
      );
      console.log("审稿人1提交审稿意见成功");
    } catch (error) {
      console.log("审稿人1提交审稿意见失败:", error.message);
    }
    
    try {
      await reviewProcess.connect(reviewer2).submitReview(
        0, // 投稿ID
        1, // 决定: Accept
        "QmReviewHash456"
      );
      console.log("审稿人2提交审稿意见成功");
    } catch (error) {
      console.log("审稿人2提交审稿意见失败:", error.message);
    }
    
    console.log("\n=== 演示完成 ===");
    console.log("所有基本功能已演示完成！");
    
  } catch (error) {
    console.error("演示过程中出现错误:", error.message);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });