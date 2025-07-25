// 部署链上学术评价体系的脚本
const hre = require("hardhat");

async function main() {
  console.log("开始部署链上学术评价体系合约...");

  const [deployer] = await ethers.getSigners();
  console.log("部署账户:", deployer.address);

  // 延迟函数
  const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

  // 部署 ResearchDataNFT 合约
  console.log("部署 ResearchDataNFT 合约...");
  const ResearchDataNFT = await hre.ethers.getContractFactory("ResearchDataNFT");
  const researchDataNFT = await ResearchDataNFT.deploy();
  await researchDataNFT.waitForDeployment();
  console.log("ResearchDataNFT 已部署到:", await researchDataNFT.getAddress());
  await delay(5000); // 等待5秒

  // 部署 PaperNFT 合约
  console.log("部署 PaperNFT 合约...");
  const PaperNFT = await hre.ethers.getContractFactory("PaperNFT");
  const paperNFT = await PaperNFT.deploy();
  await paperNFT.waitForDeployment();
  console.log("PaperNFT 已部署到:", await paperNFT.getAddress());
  await delay(5000); // 等待5秒

  // 部署 JournalManager 合约
  console.log("部署 JournalManager 合约...");
  const JournalManager = await hre.ethers.getContractFactory("JournalManager");
  const journalManager = await JournalManager.deploy();
  await journalManager.waitForDeployment();
  console.log("JournalManager 已部署到:", await journalManager.getAddress());
  await delay(5000); // 等待5秒

  // 部署 ReviewerDAO 合约
  console.log("部署 ReviewerDAO 合约...");
  const ReviewerDAO = await hre.ethers.getContractFactory("ReviewerDAO");
  const reviewerDAO = await ReviewerDAO.deploy("Academic Review Token", "ART");
  await reviewerDAO.waitForDeployment();
  console.log("ReviewerDAO 已部署到:", await reviewerDAO.getAddress());
  await delay(5000); // 等待5秒

  // 部署 ReviewProcess 合约
  console.log("部署 ReviewProcess 合约...");
  const ReviewProcess = await hre.ethers.getContractFactory("ReviewProcess");
  const reviewProcess = await ReviewProcess.deploy(
    await paperNFT.getAddress(),
    await journalManager.getAddress()
  );
  await reviewProcess.waitForDeployment();
  console.log("ReviewProcess 已部署到:", await reviewProcess.getAddress());
  await delay(5000); // 等待5秒

  // 设置合约之间的关联关系
  console.log("设置合约之间的关联关系...");

  // 设置 ReviewerDAO 的 ReviewProcess 地址
  console.log("设置 ReviewerDAO 的 ReviewProcess 地址...");
  await reviewerDAO.setReviewProcess(await reviewProcess.getAddress());

  // 设置 JournalManager 的合约地址
  console.log("设置 JournalManager 的合约地址...");
  await journalManager.setContractAddresses(
    await reviewProcess.getAddress(),
    await reviewerDAO.getAddress()
  );

  // 授予 JournalManager 合约 EDITOR_ROLE 权限
  console.log("授予 JournalManager 合约 EDITOR_ROLE 权限...");
  await reviewerDAO.setJournalManager(await journalManager.getAddress());

  console.log("链上学术评价体系合约部署完成！");

  // 返回所有合约地址，方便后续使用
  return {
    researchDataNFT: await researchDataNFT.getAddress(),
    paperNFT: await paperNFT.getAddress(),
    reviewProcess: await reviewProcess.getAddress(),
    reviewerDAO: await reviewerDAO.getAddress(),
    journalManager: await journalManager.getAddress()
  };
}

// 执行部署
main()
  .then((addresses) => {
    console.log("所有合约地址:", addresses);
    process.exit(0);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });