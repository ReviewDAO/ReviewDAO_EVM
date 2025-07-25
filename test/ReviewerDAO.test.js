const { expect } = require('chai');
const { ethers } = require('hardhat');

describe('ReviewerDAO', function () {
  let reviewerDAO;
  let owner;
  let reviewer1;
  let reviewer2;
  let reviewer3;
  let user1;
  let user2;
  let user3;
  
  // 测试数据
  const proposalDescription = 'Proposal to update review criteria';
  const votingDuration = 7 * 24 * 60 * 60; // 7 days in seconds
  const minStakeAmount = ethers.parseEther('1.0');
  const reputationThreshold = 100;
  
  // ProposalType 枚举值
  const ProposalType = {
    GENERAL: 0,
    REVIEWER_ADDITION: 1,
    REVIEWER_REMOVAL: 2,
    PARAMETER_CHANGE: 3
  };
  
  // ProposalStatus 枚举值
  const ProposalStatus = {
    ACTIVE: 0,
    PASSED: 1,
    REJECTED: 2,
    EXECUTED: 3
  };
  
  // VoteType 枚举值
  const VoteType = {
    AGAINST: 0,
    FOR: 1,
    ABSTAIN: 2
  };

  beforeEach(async function () {
    // 获取测试账户
    [owner, reviewer1, reviewer2, reviewer3, user1, user2, user3] = await ethers.getSigners();
    
    // 部署ReviewerDAO合约
    const ReviewerDAO = await ethers.getContractFactory('ReviewerDAO');
    reviewerDAO = await ReviewerDAO.deploy("ReviewerDAO Token", "RDT");
    await reviewerDAO.waitForDeployment();
    
    // 为owner授予EDITOR_ROLE权限以便测试
    const EDITOR_ROLE = await reviewerDAO.EDITOR_ROLE();
    await reviewerDAO.grantRole(EDITOR_ROLE, owner.address);
  });

  describe('基本功能', function () {
    it('应该正确初始化合约', async function () {
      expect(await reviewerDAO.hasRole(await reviewerDAO.DEFAULT_ADMIN_ROLE(), owner.address)).to.be.true;
      expect(await reviewerDAO.name()).to.equal("ReviewerDAO Token");
      expect(await reviewerDAO.symbol()).to.equal("RDT");
    });
  });

  describe('审稿人注册', function () {
    it('应该允许用户注册为审稿人', async function () {
      await reviewerDAO.connect(reviewer1).registerAsReviewer("https://example.com/metadata1");
      
      const reviewerInfo = await reviewerDAO.reviewers(reviewer1.address);
      expect(reviewerInfo.isActive).to.equal(true);
      expect(reviewerInfo.reputation).to.equal(100);
      expect(reviewerInfo.completedReviews).to.equal(0);
      expect(reviewerInfo.tier).to.equal(1); // Junior
    });
    
    it('应该拒绝重复注册', async function () {
      await reviewerDAO.connect(reviewer1).registerAsReviewer("https://example.com/metadata1");
      
      await expect(
        reviewerDAO.connect(reviewer1).registerAsReviewer("https://example.com/metadata1")
      ).to.be.revertedWith('Already registered as reviewer');
    });
    
    it('应该允许更新审稿人元数据', async function () {
      await reviewerDAO.connect(reviewer1).registerAsReviewer("https://example.com/metadata1");
      
      await reviewerDAO.connect(reviewer1).updateReviewerMetadata("https://example.com/metadata2");
      
      const reviewerInfo = await reviewerDAO.reviewers(reviewer1.address);
      expect(reviewerInfo.metadataURI).to.equal("https://example.com/metadata2");
    });
  });

  describe('声誉管理', function () {
    beforeEach(async function () {
      // 注册审稿人
      await reviewerDAO.connect(reviewer1).registerAsReviewer("https://example.com/metadata1");
      await reviewerDAO.connect(reviewer2).registerAsReviewer("https://example.com/metadata2");
    });
    
    it('应该允许管理员更新审稿人声誉', async function () {
      const reputationIncrease = 50;
      
      await reviewerDAO.updateReviewerReputation(reviewer1.address, reputationIncrease);
      
      const reviewerInfo = await reviewerDAO.reviewers(reviewer1.address);
      expect(reviewerInfo.reputation).to.equal(150); // 100 + 50
    });
    
    it('应该允许减少审稿人声誉', async function () {
      // 减少声誉
      const reputationDecrease = -30;
      await reviewerDAO.updateReviewerReputation(reviewer1.address, reputationDecrease);
      
      const reviewerInfo = await reviewerDAO.reviewers(reviewer1.address);
      expect(reviewerInfo.reputation).to.equal(70); // 100 - 30
    });
    
    it('应该拒绝非管理员更新声誉', async function () {
      await expect(
        reviewerDAO.connect(user1).updateReviewerReputation(reviewer1.address, 50)
      ).to.be.revertedWithCustomError(reviewerDAO, 'AccessControlUnauthorizedAccount');
    });
    
    it('应该允许管理员更新审稿人等级', async function () {
      await reviewerDAO.updateReviewerTier(reviewer1.address, 2); // Senior
      
      const reviewerInfo = await reviewerDAO.reviewers(reviewer1.address);
      expect(reviewerInfo.tier).to.equal(2);
    });
  });

  describe('奖励分发', function () {
    beforeEach(async function () {
      // 注册审稿人
      await reviewerDAO.connect(reviewer1).registerAsReviewer("https://example.com/metadata1");
    });
    
    it('应该允许编辑角色分发奖励', async function () {
      const reviewId = 1;
      const rewardAmount = ethers.parseEther("5");
      
      await reviewerDAO.distributeReward(reviewer1.address, reviewId, rewardAmount);
      
      const reviewerInfo = await reviewerDAO.reviewers(reviewer1.address);
      expect(reviewerInfo.completedReviews).to.equal(1);
      
      const reward = await reviewerDAO.reviewRewards(reviewId, reviewer1.address);
      expect(reward).to.equal(rewardAmount);
    });
    
    it('应该拒绝重复分发奖励', async function () {
      const reviewId = 1;
      const rewardAmount = ethers.parseEther("5");
      
      await reviewerDAO.distributeReward(reviewer1.address, reviewId, rewardAmount);
      
      await expect(
        reviewerDAO.distributeReward(reviewer1.address, reviewId, rewardAmount)
      ).to.be.revertedWith('Reward already distributed');
    });
  });

  describe('代币功能', function () {
    beforeEach(async function () {
      // 注册审稿人
      await reviewerDAO.connect(reviewer1).registerAsReviewer("https://example.com/metadata1");
    });
    
    it('应该在注册时铸造初始代币', async function () {
      const balance = await reviewerDAO.balanceOf(reviewer1.address);
      expect(balance).to.equal(ethers.parseEther("10")); // 10 tokens
    });
    
    it('应该正确显示代币名称和符号', async function () {
      expect(await reviewerDAO.name()).to.equal("ReviewerDAO Token");
      expect(await reviewerDAO.symbol()).to.equal("RDT");
    });
  });

});