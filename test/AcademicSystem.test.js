const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Academic System", function () {
  let researchDataNFT;
  let paperNFT;
  let reviewProcess;
  let reviewerDAO;
  let journalManager;
  let admin, chiefEditor, author, reviewer1, reviewer2, reader;

  beforeEach(async function () {
    // 获取签名者
    [admin, chiefEditor, author, reviewer1, reviewer2, reader] = await ethers.getSigners();

    // 部署 ResearchDataNFT
    const ResearchDataNFT = await ethers.getContractFactory("ResearchDataNFT");
    researchDataNFT = await ResearchDataNFT.deploy();
    await researchDataNFT.waitForDeployment();

    // 部署 PaperNFT
    const PaperNFT = await ethers.getContractFactory("PaperNFT");
    paperNFT = await PaperNFT.deploy();
    await paperNFT.waitForDeployment();

    // 部署 JournalManager
    const JournalManager = await ethers.getContractFactory("JournalManager");
    journalManager = await JournalManager.deploy();
    await journalManager.waitForDeployment();

    // 部署 ReviewerDAO
    const ReviewerDAO = await ethers.getContractFactory("ReviewerDAO");
    reviewerDAO = await ReviewerDAO.deploy("Academic Review Token", "ART");
    await reviewerDAO.waitForDeployment();

    // 部署 ReviewProcess
    const ReviewProcess = await ethers.getContractFactory("ReviewProcess");
    reviewProcess = await ReviewProcess.deploy(
      await paperNFT.getAddress(),
      await journalManager.getAddress()
    );
    await reviewProcess.waitForDeployment();

    // 设置合约之间的关联
    await reviewerDAO.setReviewProcess(await reviewProcess.getAddress());
    await journalManager.setContractAddresses(
      await reviewProcess.getAddress(),
      await reviewerDAO.getAddress()
    );
  });

  describe("部署", function () {
    it("应该正确部署所有合约", async function () {
      expect(await researchDataNFT.getAddress()).to.not.equal(ethers.ZeroAddress);
      expect(await paperNFT.getAddress()).to.not.equal(ethers.ZeroAddress);
      expect(await reviewProcess.getAddress()).to.not.equal(ethers.ZeroAddress);
      expect(await reviewerDAO.getAddress()).to.not.equal(ethers.ZeroAddress);
      expect(await journalManager.getAddress()).to.not.equal(ethers.ZeroAddress);
    });

    it("应该正确设置管理员角色", async function () {
      const adminRole = await reviewerDAO.ADMIN_ROLE();
      expect(await reviewerDAO.hasRole(adminRole, admin.address)).to.be.true;
      
      const journalAdminRole = await journalManager.ADMIN_ROLE();
      expect(await journalManager.hasRole(journalAdminRole, admin.address)).to.be.true;
    });
  });

  describe("期刊管理", function () {
    it("应该能够创建期刊", async function () {
      const tx = await journalManager.createJournal(
        "Blockchain Research Journal",
        "A journal for blockchain research",
        "ipfs://journal-metadata",
        chiefEditor.address,
        ethers.parseEther("0.1"),
        ["Computer Science", "Blockchain"],
        1, // ReviewerTier.Junior
        3  // requiredReviewers
      );

      await expect(tx)
        .to.emit(journalManager, "JournalCreated")
        .withArgs(0, "Blockchain Research Journal", chiefEditor.address);

      const journal = await journalManager.getJournalInfo(0);
      expect(journal.name).to.equal("Blockchain Research Journal");
      expect(journal.owner).to.equal(chiefEditor.address);
    });

    it("应该能够添加编辑", async function () {
      // 先创建期刊
      await journalManager.createJournal(
        "Test Journal",
        "Test Description",
        "ipfs://test",
        chiefEditor.address,
        ethers.parseEther("0.1"),
        ["Test"],
        1, // ReviewerTier.Junior
        2  // requiredReviewers
      );

      // 添加编辑
      await journalManager.connect(chiefEditor).addEditor(0, author.address);

      const editors = await journalManager.getJournalEditors(0);
      expect(editors).to.include(author.address);
    });
  });

  describe("审稿人DAO", function () {
    it("应该能够注册审稿人", async function () {
      const tx = await reviewerDAO.connect(reviewer1).registerAsReviewer("ipfs://reviewer1-profile");

      await expect(tx)
        .to.emit(reviewerDAO, "ReviewerRegistered")
        .withArgs(reviewer1.address, 1); // Junior tier

      const reviewerInfo = await reviewerDAO.getReviewerInfo(reviewer1.address);
      expect(reviewerInfo.tier).to.equal(1); // Junior
      expect(reviewerInfo.reputation).to.equal(100);
      expect(reviewerInfo.isActive).to.be.true;
    });

    it("应该给新审稿人分配初始代币", async function () {
      await reviewerDAO.connect(reviewer1).registerAsReviewer("ipfs://reviewer1-profile");
      
      const balance = await reviewerDAO.balanceOf(reviewer1.address);
      expect(balance).to.equal(ethers.parseEther("10"));
    });

    it("应该能够创建提案", async function () {
      // 先注册审稿人
      await reviewerDAO.connect(reviewer1).registerAsReviewer("ipfs://reviewer1-profile");
      
      // 给审稿人更多代币以满足提案门槛
      await reviewerDAO.connect(admin).mint(reviewer1.address, ethers.parseEther("100"));
      
      const proposalData = ethers.AbiCoder.defaultAbiCoder().encode(
        ["address", "string"],
        [reviewer2.address, "ipfs://reviewer2-profile"]
      );

      const tx = await reviewerDAO.connect(reviewer1).createProposal(
        1, // AddReviewer
        "Add new reviewer",
        proposalData
      );

      await expect(tx)
        .to.emit(reviewerDAO, "ProposalCreated")
        .withArgs(0, reviewer1.address, 1);
    });
  });

  describe("论文NFT", function () {
    it("应该能够创建论文NFT", async function () {
      const tx = await paperNFT.connect(author).createPaperItem(
        "ipfs://paper-content",
        "10.1234/test.2023.001",
        "ipfs://paper-metadata"
      );

      await expect(tx)
        .to.emit(paperNFT, "DataItemCreated")
        .withArgs(0, author.address, "ipfs://paper-content");

      expect(await paperNFT.ownerOf(0)).to.equal(author.address);
      
      const paperInfo = await paperNFT.dataItems(0);
      expect(paperInfo.ipfsHash).to.equal("ipfs://paper-content");
      const doi = await paperNFT.paperDOIs(0);
      expect(doi).to.equal("10.1234/test.2023.001");
    });

    it("应该能够添加引用", async function () {
      // 创建两篇论文
      await paperNFT.connect(author).createPaperItem(
        "ipfs://paper1",
        "10.1234/paper1",
        "ipfs://metadata1"
      );
      
      await paperNFT.connect(author).createPaperItem(
        "ipfs://paper2",
        "10.1234/paper2",
        "ipfs://metadata2"
      );

      // 论文2引用论文1
      await paperNFT.connect(author).citePaper(0, { value: ethers.parseEther("0.1") });

      const citationsCount = await paperNFT.citations(0, 0);
      expect(citationsCount.citer).to.equal(author.address);
    });
  });

  describe("投稿和审稿流程", function () {
    let journalId, paperId;

    beforeEach(async function () {
      // 给chiefEditor分配编辑角色
      const editorRole = await journalManager.EDITOR_ROLE();
      await journalManager.connect(admin).grantRole(editorRole, chiefEditor.address);
      
      // 给JournalManager合约分配ReviewerDAO的编辑角色
      const reviewerDAOEditorRole = await reviewerDAO.EDITOR_ROLE();
      await reviewerDAO.connect(admin).grantRole(reviewerDAOEditorRole, await journalManager.getAddress());
      
      // 创建期刊
      await journalManager.createJournal(
        "Test Journal",
        "Test Description",
        "ipfs://journal",
        chiefEditor.address,
        ethers.parseEther("0.1"),
        ["Computer Science"],
        1, // ReviewerTier.Junior
        2  // requiredReviewers
      );
      journalId = 0;

      // 创建论文
      await paperNFT.connect(author).createPaperItem(
        "ipfs://paper",
        "10.1234/test.2023.001",
        "ipfs://metadata"
      );
      paperId = 0;

      // 注册审稿人
      await reviewerDAO.connect(reviewer1).registerAsReviewer("ipfs://reviewer1");
      await reviewerDAO.connect(reviewer2).registerAsReviewer("ipfs://reviewer2");
    });

    it("应该能够投稿", async function () {
      const tx = await reviewProcess.connect(author).createSubmission(
        paperId,
        journalId,
        "ipfs://submission-metadata"
      );

      await expect(tx)
        .to.emit(reviewProcess, "SubmissionCreated")
        .withArgs(0, author.address, paperId, journalId);

      const submission = await reviewProcess.submissions(0);
      expect(submission.author).to.equal(author.address);
      expect(submission.paperId).to.equal(paperId);
      expect(submission.status).to.equal(0); // Submitted
    });

    it("应该能够分配审稿人", async function () {
      // 投稿
      await reviewProcess.connect(author).createSubmission(
        paperId,
        journalId,
        "ipfs://submission-metadata"
      );
      const submissionId = 0;

      // 分配审稿人
      const tx = await journalManager.connect(chiefEditor).assignReviewer(
        submissionId,
        reviewer1.address
      );

      await expect(tx)
        .to.emit(reviewProcess, "ReviewerAssigned")
        .withArgs(submissionId, reviewer1.address);

      const submission = await reviewProcess.submissions(submissionId);
      expect(submission.status).to.equal(1); // UnderReview
    });

    it("应该能够提交审稿意见", async function () {
      // 投稿
      await reviewProcess.connect(author).createSubmission(
        paperId,
        journalId,
        "ipfs://submission-metadata"
      );
      const submissionId = 0;

      // 分配审稿人
      await journalManager.connect(chiefEditor).assignReviewer(
        submissionId,
        reviewer1.address
      );

      // 提交审稿意见
      const tx = await reviewProcess.connect(reviewer1).submitReview(
        submissionId,
        1, // Accept
        "ipfs://review-comments"
      );

      await expect(tx)
        .to.emit(reviewProcess, "ReviewSubmitted")
        .withArgs(0, reviewer1.address, submissionId, 1);

      const review = await reviewProcess.reviews(0);
      expect(review.reviewer).to.equal(reviewer1.address);
      expect(review.decision).to.equal(1); // Accept
    });

    it("应该能够发表论文", async function () {
      // 投稿
      await reviewProcess.connect(author).createSubmission(
        paperId,
        journalId,
        "ipfs://submission-metadata"
      );
      const submissionId = 0;

      // 分配审稿人并提交审稿意见以自动更新状态
      await journalManager.connect(chiefEditor).assignReviewer(
        submissionId,
        reviewer1.address
      );
      
      await reviewProcess.connect(reviewer1).submitReview(
        submissionId,
        1, // Accept
        "ipfs://review-comments"
      );

      // 发表论文
      const tx = await journalManager.connect(chiefEditor).publishPaper(
        submissionId,
        "Volume 1, Issue 1, 2023"
      );

      await expect(tx)
        .to.emit(journalManager, "PaperPublished")
        .withArgs(submissionId, journalId, "Volume 1, Issue 1, 2023");

      const submission = await reviewProcess.submissions(submissionId);
      expect(submission.status).to.equal(5); // Published
    });
  });

  describe("奖励分配", function () {
    let journalId, paperId, submissionId, reviewId;

    beforeEach(async function () {
      // 给chiefEditor分配编辑角色
      const editorRole = await journalManager.EDITOR_ROLE();
      await journalManager.connect(admin).grantRole(editorRole, chiefEditor.address);
      
      // 给JournalManager合约分配ReviewerDAO的EDITOR_ROLE权限
      const reviewerDAOEditorRole = await reviewerDAO.EDITOR_ROLE();
      await reviewerDAO.connect(admin).grantRole(reviewerDAOEditorRole, journalManager.target);
      
      // 设置完整的投稿和审稿流程
      await journalManager.createJournal(
        "Test Journal",
        "Test Description",
        "ipfs://journal",
        chiefEditor.address,
        ethers.parseEther("0.1"),
        ["Computer Science"],
        1, // ReviewerTier.Junior
        2  // requiredReviewers
      );
      journalId = 0;

      await paperNFT.connect(author).createPaperItem(
        "ipfs://paper",
        "10.1234/test.2023.001",
        "ipfs://metadata"
      );
      paperId = 0;

      await reviewerDAO.connect(reviewer1).registerAsReviewer("ipfs://reviewer1");

      await reviewProcess.connect(author).createSubmission(
        paperId,
        journalId,
        "ipfs://submission-metadata"
      );
      submissionId = 0;

      await journalManager.connect(chiefEditor).assignReviewer(
        submissionId,
        reviewer1.address
      );

      await reviewProcess.connect(reviewer1).submitReview(
        submissionId,
        1, // Accept
        "ipfs://review-comments"
      );
      reviewId = 0;
    });

    it("应该能够分配审稿奖励", async function () {
      const initialBalance = await reviewerDAO.balanceOf(reviewer1.address);

      const tx = await journalManager.connect(chiefEditor).distributeReviewReward(
        reviewId,
        submissionId,
        90, // 质量评分
        true // 及时完成
      );

      await expect(tx)
        .to.emit(journalManager, "ReviewRewardDistributed");

      const finalBalance = await reviewerDAO.balanceOf(reviewer1.address);
      expect(finalBalance).to.be.gt(initialBalance);
    });

    it("应该更新审稿人声誉", async function () {
      const initialInfo = await reviewerDAO.getReviewerInfo(reviewer1.address);
      const initialReputation = initialInfo.reputation;

      await journalManager.connect(chiefEditor).distributeReviewReward(
        reviewId,
        submissionId,
        90, // 高质量评分
        true // 及时完成
      );

      const finalInfo = await reviewerDAO.getReviewerInfo(reviewer1.address);
      expect(finalInfo.reputation).to.be.gt(initialReputation);
    });
  });

  describe("数据访问控制", function () {
    let dataId;

    beforeEach(async function () {
      await researchDataNFT.connect(author).createDataItem(
        "ipfs://research-data",
        ethers.parseEther("0.01"), // price
        false, // isPublic
        "ipfs://data-metadata"
      );
      dataId = 0;
    });

    it("应该能够请求数据访问", async function () {
      const price = ethers.parseEther("0.01");
      const tx = await researchDataNFT.connect(reader).requestAccess(
        dataId,
        { value: price }
      );

      await expect(tx)
        .to.emit(researchDataNFT, "DataAccessed")
        .withArgs(dataId, reader.address, price);
    });

    it("应该能够授予数据访问权限", async function () {
      const price = ethers.parseEther("0.01");
      await researchDataNFT.connect(reader).requestAccess(
        dataId,
        { value: price }
      );

      const tx = await researchDataNFT.connect(author).grantAccess(
        dataId,
        reader.address,
        1 // AccessLevel.READ
      );

      await expect(tx)
        .to.emit(researchDataNFT, "AccessGranted")
        .withArgs(dataId, reader.address, 1);

      const accessLevel = await researchDataNFT.checkAccessLevel(dataId, reader.address);
      expect(accessLevel).to.equal(1); // AccessLevel.READ
    });
  });
});