const { expect } = require('chai');
const { ethers } = require('hardhat');

describe('ReviewProcess', function () {
  let reviewProcess;
  let journalManager;
  let owner;
  let reviewer1;
  let reviewer2;
  let reviewer3;
  let author;
  let editor;
  let user;
  
  // 测试数据
  const submissionId = 0;
  const commentsHash = 'QmXoypizjW3WknFiJnKLwHCnL72vedxjQkDDP1mXWo6uco';
  
  // ReviewDecision 枚举值（对应合约中的枚举）
  const ReviewDecision = {
    None: 0,
    Accept: 1,
    MinorRevision: 2,
    MajorRevision: 3,
    Reject: 4
  };

  beforeEach(async function () {
    // 获取测试账户
    [owner, reviewer1, reviewer2, reviewer3, author, editor, user] = await ethers.getSigners();
    
    // 部署PaperNFT合约（ReviewProcess需要）
    const PaperNFT = await ethers.getContractFactory('PaperNFT');
    const paperNFT = await PaperNFT.deploy();
    await paperNFT.waitForDeployment();
    
    // 模拟JournalManager地址（在实际测试中应该部署真实的JournalManager）
    journalManager = owner; // 简化测试，使用owner作为journalManager
    
    // 部署ReviewProcess合约
    const ReviewProcess = await ethers.getContractFactory('ReviewProcess');
    reviewProcess = await ReviewProcess.deploy(await paperNFT.getAddress(), journalManager.address);
    await reviewProcess.waitForDeployment();
  });

  describe('基本功能', function () {
    it('应该正确初始化合约', async function () {
      expect(await reviewProcess.journalManagerAddress()).to.equal(journalManager.address);
    });
  });

  describe('审稿分配', function () {
    it('应该拒绝非JournalManager分配审稿人', async function () {
      await expect(
        reviewProcess.connect(user).assignReviewer(submissionId, reviewer1.address)
      ).to.be.revertedWith('Only journal manager can call this function');
    });
    
    it('应该拒绝重复分配同一审稿人', async function () {
      await reviewProcess.connect(journalManager).assignReviewer(submissionId, reviewer1.address);
      
      await expect(
        reviewProcess.connect(journalManager).assignReviewer(submissionId, reviewer1.address)
      ).to.be.revertedWith('Reviewer already assigned');
    });
  });

  describe('提交审稿意见', function () {
    beforeEach(async function () {
      // 分配审稿人
      await reviewProcess.connect(journalManager).assignReviewer(submissionId, reviewer1.address);
      await reviewProcess.connect(journalManager).assignReviewer(submissionId, reviewer2.address);
    });
    
    it('应该允许分配的审稿人提交审稿意见', async function () {
      await expect(
        reviewProcess.connect(reviewer1).submitReview(
          submissionId,
          ReviewDecision.Accept,
          commentsHash
        )
      ).to.not.be.reverted;
    });
    
    it('应该拒绝未分配的审稿人提交审稿意见', async function () {
      await expect(
        reviewProcess.connect(user).submitReview(
          submissionId,
          ReviewDecision.Accept,
          commentsHash
        )
      ).to.be.revertedWith('Only assigned reviewers can call this function');
    });
    
    it('应该拒绝无效的审稿决定', async function () {
      await expect(
        reviewProcess.connect(reviewer1).submitReview(
          submissionId,
          ReviewDecision.None,
          commentsHash
        )
      ).to.be.revertedWith('Invalid review decision');
    });
  });

  describe('事件发射', function () {
    it('应该在分配审稿人时发射事件', async function () {
      await expect(
        reviewProcess.connect(journalManager).assignReviewer(submissionId, reviewer1.address)
      ).to.emit(reviewProcess, 'ReviewerAssigned')
        .withArgs(submissionId, reviewer1.address);
    });
    
    it('应该在提交审稿意见时发射事件', async function () {
      await reviewProcess.connect(journalManager).assignReviewer(submissionId, reviewer1.address);
      
      await expect(
        reviewProcess.connect(reviewer1).submitReview(
          submissionId,
          ReviewDecision.Accept,
          commentsHash
        )
      ).to.emit(reviewProcess, 'ReviewSubmitted');
    });
  });
});