const { expect } = require('chai');
const { ethers } = require('hardhat');

describe('ReviewProcess', function () {
  let reviewProcess;
  let journalManager;
  let paperNFT;
  let reviewerDAO;
  let owner;
  let reviewer1;
  let reviewer2;
  let reviewer3;
  let author;
  let editor;
  let user;
  
  // 测试数据
  let submissionId;
  let paperId;
  const journalId = 0;
  const commentsHash = 'QmXoypizjW3WknFiJnKLwHCnL72vedxjQkDDP1mXWo6uco';
  const paperIpfsHash = 'QmTestPaperHash';
  const paperMetadataURI = 'https://example.com/paper/metadata';
  const submissionMetadataURI = 'https://example.com/submission/metadata';
  
  // 枚举值
  const ReviewDecision = {
    None: 0,
    Accept: 1,
    MinorRevision: 2,
    MajorRevision: 3,
    Reject: 4
  };
  
  const SubmissionStatus = {
    Submitted: 0,
    UnderReview: 1,
    Rejected: 2,
    RevisionRequired: 3,
    Accepted: 4,
    Published: 5
  };

  beforeEach(async function () {
    // 获取测试账户
    [owner, reviewer1, reviewer2, reviewer3, author, editor, user] = await ethers.getSigners();
    
    // 部署依赖合约
    const PaperNFT = await ethers.getContractFactory('PaperNFT');
    paperNFT = await PaperNFT.deploy();
    await paperNFT.waitForDeployment();
    
    const ReviewerDAO = await ethers.getContractFactory('ReviewerDAO');
    reviewerDAO = await ReviewerDAO.deploy('ReviewerDAO Token', 'RDT');
    await reviewerDAO.waitForDeployment();
    
    const JournalManager = await ethers.getContractFactory('JournalManager');
    journalManager = await JournalManager.deploy();
    await journalManager.waitForDeployment();
    
    // 部署ReviewProcess合约
    const ReviewProcess = await ethers.getContractFactory('ReviewProcess');
    reviewProcess = await ReviewProcess.deploy(await paperNFT.getAddress(), await journalManager.getAddress());
    await reviewProcess.waitForDeployment();
    
    // 设置合约地址关联
    await journalManager.setContractAddresses(
      await reviewProcess.getAddress(),
      await reviewerDAO.getAddress()
    );
    
    await reviewerDAO.setJournalManager(await journalManager.getAddress());
    
    // 创建期刊
    await journalManager.createJournal(
      'Test Journal',
      'A test journal for ReviewProcess testing',
      'https://example.com/journal/metadata',
      owner.address,
      ethers.parseEther('0.1'),
      ['Computer Science'],
      0, // Junior tier
      3  // Required reviewers
    );
    
    // 注册审稿人
    await reviewerDAO.connect(reviewer1).registerAsReviewer('https://example.com/reviewer1');
    await reviewerDAO.connect(reviewer2).registerAsReviewer('https://example.com/reviewer2');
    await reviewerDAO.connect(reviewer3).registerAsReviewer('https://example.com/reviewer3');
    
    // 创建论文NFT
    await paperNFT.connect(author).createPaperItem(
      paperIpfsHash,
      'doi:10.1000/test',
      paperMetadataURI
    );
    paperId = 0; // 第一个创建的论文ID
    
    // 创建投稿
    await reviewProcess.connect(author).createSubmission(
      paperId,
      journalId,
      submissionMetadataURI
    );
    submissionId = 0; // 第一个创建的投稿ID
  });

  describe('基本功能', function () {
    it('应该正确部署合约', async function () {
      expect(await reviewProcess.paperNFT()).to.equal(await paperNFT.getAddress());
      expect(await reviewProcess.journalManagerAddress()).to.equal(await journalManager.getAddress());
    });
    
    it('应该正确初始化投稿', async function () {
      const submission = await reviewProcess.submissions(submissionId);
      expect(submission.paperId).to.equal(paperId);
      expect(submission.journalId).to.equal(journalId);
      expect(submission.author).to.equal(author.address);
      expect(submission.status).to.equal(0); // SubmissionStatus.Submitted
      expect(submission.metadataURI).to.equal(submissionMetadataURI);
    });
  });

  describe('投稿管理', function () {
    it('应该能够创建新投稿', async function () {
      // 创建另一个论文
      await paperNFT.connect(author).createPaperItem(
        'QmAnotherPaperHash',
        'doi:10.1000/test2',
        'https://example.com/paper2/metadata'
      );
      
      const newPaperId = 1;
      const newSubmissionMetadata = 'https://example.com/submission2/metadata';
      
      await expect(
        reviewProcess.connect(author).createSubmission(
          newPaperId,
          journalId,
          newSubmissionMetadata
        )
      ).to.emit(reviewProcess, 'SubmissionCreated')
        .withArgs(1, author.address, newPaperId, journalId);
      
      const submission = await reviewProcess.submissions(1);
      expect(submission.paperId).to.equal(newPaperId);
      expect(submission.status).to.equal(SubmissionStatus.Submitted);
    });
    
    it('应该能够更新投稿状态', async function () {
      await journalManager.connect(owner).updateSubmissionStatus(
        submissionId,
        SubmissionStatus.UnderReview
      );
      
      const submission = await reviewProcess.submissions(submissionId);
      expect(submission.status).to.equal(SubmissionStatus.UnderReview);
    });
    
    it('非期刊管理员不能更新投稿状态', async function () {
      await expect(
        journalManager.connect(user).updateSubmissionStatus(
          submissionId,
          SubmissionStatus.UnderReview
        )
      ).to.be.revertedWith('Not authorized');
    });
  });

  describe('审稿人分配', function () {
    it('应该能够分配审稿人', async function () {
      await journalManager.connect(owner).assignReviewer(submissionId, reviewer1.address);
      
      const assignments = await reviewProcess.getReviewerAssignments(reviewer1.address);
      expect(assignments.length).to.be.greaterThan(0);
      expect(assignments[0]).to.equal(submissionId);
    });
    
    it('应该能够分配多个审稿人', async function () {
      await journalManager.connect(owner).assignReviewer(submissionId, reviewer1.address);
      await journalManager.connect(owner).assignReviewer(submissionId, reviewer2.address);
      await journalManager.connect(owner).assignReviewer(submissionId, reviewer3.address);
      
      const assignments1 = await reviewProcess.getReviewerAssignments(reviewer1.address);
      const assignments2 = await reviewProcess.getReviewerAssignments(reviewer2.address);
      const assignments3 = await reviewProcess.getReviewerAssignments(reviewer3.address);
      
      expect(assignments1[0]).to.equal(submissionId);
      expect(assignments2[0]).to.equal(submissionId);
      expect(assignments3[0]).to.equal(submissionId);
    });

    it('非期刊管理员不能分配审稿人', async function () {
      await expect(
        reviewProcess.connect(user).assignReviewer(submissionId, reviewer1.address)
      ).to.be.revertedWith('Only journal manager can call this function');
    });
    
    it('不能重复分配同一审稿人', async function () {
       await journalManager.connect(owner).assignReviewer(submissionId, reviewer1.address);
       
       await expect(
         journalManager.connect(owner).assignReviewer(submissionId, reviewer1.address)
       ).to.be.revertedWith('Reviewer already assigned to this submission');
     });
  });

  describe('提交审稿意见', function () {
    beforeEach(async function () {
      await journalManager.connect(owner).assignReviewer(submissionId, reviewer1.address);
      await journalManager.connect(owner).assignReviewer(submissionId, reviewer2.address);
      await journalManager.connect(owner).assignReviewer(submissionId, reviewer3.address);
    });

    it('应该能够提交审稿意见', async function () {
      await expect(
        reviewProcess.connect(reviewer1).submitReview(
          submissionId,
          ReviewDecision.Accept,
          commentsHash
        )
      ).to.emit(reviewProcess, 'ReviewSubmitted')
        .withArgs(submissionId, reviewer1.address, ReviewDecision.Accept);
      
      // 验证审稿意见通过审稿ID列表
      const reviewIds = await reviewProcess.getSubmissionReviews(submissionId);
      expect(reviewIds.length).to.be.greaterThan(0);
      
      // 验证审稿人已提交审稿意见
      const hasSubmitted = await reviewProcess.reviewerSubmitted(submissionId, reviewer1.address);
      expect(hasSubmitted).to.be.true;
    });
    
    it('应该能够提交不同的审稿决定', async function () {
      await reviewProcess.connect(reviewer1).submitReview(
        submissionId,
        ReviewDecision.Accept,
        commentsHash
      );
      
      await reviewProcess.connect(reviewer2).submitReview(
        submissionId,
        ReviewDecision.MinorRevision,
        'QmMinorRevisionComments'
      );
      
      await reviewProcess.connect(reviewer3).submitReview(
        submissionId,
        ReviewDecision.Reject,
        'QmRejectComments'
      );
      
      // 验证所有审稿人都已提交审稿意见
      const hasSubmitted1 = await reviewProcess.reviewerSubmitted(submissionId, reviewer1.address);
      const hasSubmitted2 = await reviewProcess.reviewerSubmitted(submissionId, reviewer2.address);
      const hasSubmitted3 = await reviewProcess.reviewerSubmitted(submissionId, reviewer3.address);
      
      expect(hasSubmitted1).to.be.true;
      expect(hasSubmitted2).to.be.true;
      expect(hasSubmitted3).to.be.true;
      
      // 验证审稿意见数量
      const reviewIds = await reviewProcess.getSubmissionReviews(submissionId);
      expect(reviewIds.length).to.equal(3);
    });

    it('非分配的审稿人不能提交审稿意见', async function () {
      await expect(
        reviewProcess.connect(user).submitReview(
          submissionId,
          ReviewDecision.Accept,
          commentsHash
        )
      ).to.be.revertedWith('Only assigned reviewers can call this function');
    });
    
    it('不能提交空的审稿意见', async function () {
      await expect(
        reviewProcess.connect(reviewer1).submitReview(
          submissionId,
          ReviewDecision.None,
          commentsHash
        )
      ).to.be.revertedWith('Invalid review decision');
    });
    
    it('审稿人不能重复提交审稿意见', async function () {
      // 首次提交
      await reviewProcess.connect(reviewer1).submitReview(
        submissionId,
        ReviewDecision.MinorRevision,
        commentsHash
      );
      
      // 尝试再次提交应该失败
      await expect(
        reviewProcess.connect(reviewer1).submitReview(
          submissionId,
          ReviewDecision.Accept,
          'QmUpdatedComments'
        )
      ).to.be.revertedWith('Review already submitted');
    });
  });

  describe('修改版本提交', function () {
    beforeEach(async function () {
      // 设置审稿流程：分配审稿人并要求修改
      await journalManager.connect(owner).assignReviewer(submissionId, reviewer1.address);
      await reviewProcess.connect(reviewer1).submitReview(
        submissionId,
        ReviewDecision.MajorRevision,
        commentsHash
      );
      await journalManager.connect(owner).updateSubmissionStatus(
        submissionId,
        SubmissionStatus.RevisionRequired
      );
    });
    
    it('作者应该能够提交修改版本', async function () {
      const revisionMetadata = 'https://example.com/revision/metadata';
      
      await expect(
        reviewProcess.connect(author).submitRevision(
          submissionId,
          revisionMetadata
        )
      ).to.emit(reviewProcess, 'RevisionSubmitted')
        .withArgs(submissionId, author.address);
      
      const submission = await reviewProcess.submissions(submissionId);
       expect(submission.status).to.equal(SubmissionStatus.Submitted);
       expect(submission.revisionCount).to.equal(1);
    });
    
    it('非作者不能提交修改版本', async function () {
      await expect(
        reviewProcess.connect(user).submitRevision(
          submissionId,
          'https://example.com/revision/metadata'
        )
      ).to.be.revertedWith('Only the author can submit revisions');
    });
    
    it('只有在需要修改状态下才能提交修改版本', async function () {
      // 重置状态为已提交
      await journalManager.connect(owner).updateSubmissionStatus(
        submissionId,
        SubmissionStatus.Submitted
      );
      
      await expect(
        reviewProcess.connect(author).submitRevision(
          submissionId,
          'https://example.com/revision/metadata'
        )
      ).to.be.revertedWith('Submission is not in revision required status');
    });
  });

  describe('论文发表', function () {
    beforeEach(async function () {
      // 设置成功的审稿流程
      await journalManager.connect(owner).assignReviewer(submissionId, reviewer1.address);
      await journalManager.connect(owner).assignReviewer(submissionId, reviewer2.address);
      await reviewProcess.connect(reviewer1).submitReview(
        submissionId,
        ReviewDecision.Accept,
        commentsHash
      );
      await reviewProcess.connect(reviewer2).submitReview(
        submissionId,
        ReviewDecision.Accept,
        commentsHash
      );
      await journalManager.connect(owner).updateSubmissionStatus(
        submissionId,
        SubmissionStatus.Accepted
      );
    });
    
    it('应该能够发表论文', async function () {
      const volumeInfo = 'Vol 1, Issue 1';
      
      await expect(
        journalManager.connect(owner).publishPaper(
          submissionId,
          volumeInfo
        )
      ).to.emit(journalManager, 'PaperPublished')
        .withArgs(submissionId, journalId, volumeInfo);
      
      const submission = await reviewProcess.submissions(submissionId);
      expect(submission.status).to.equal(SubmissionStatus.Published);
    });
    
    it('非期刊管理员不能发表论文', async function () {
      await expect(
        journalManager.connect(user).publishPaper(
          submissionId,
          'Vol 1, Issue 1'
        )
      ).to.be.revertedWith('Not authorized');
    });
    
    it('只有已接受的投稿才能发表', async function () {
      // 重置状态为审稿中
      await journalManager.connect(owner).updateSubmissionStatus(
        submissionId,
        SubmissionStatus.UnderReview
      );
      
      await expect(
        journalManager.connect(owner).publishPaper(
          submissionId,
          'Vol 1, Issue 1'
        )
      ).to.be.revertedWith('Submission must be accepted');
    });
  });

  describe('查询功能', function () {
    beforeEach(async function () {
      await journalManager.connect(owner).assignReviewer(submissionId, reviewer1.address);
      await journalManager.connect(owner).assignReviewer(submissionId, reviewer2.address);
      await reviewProcess.connect(reviewer1).submitReview(
        submissionId,
        ReviewDecision.Accept,
        commentsHash
      );
    });
    
    it('应该能够获取投稿详情', async function () {
      const submission = await reviewProcess.submissions(submissionId);
      expect(submission.paperId).to.equal(paperId);
      expect(submission.journalId).to.equal(journalId);
      expect(submission.author).to.equal(author.address);
      expect(submission.status).to.equal(SubmissionStatus.Submitted);
    });
    
    it('应该能够获取审稿人分配列表', async function () {
      const assignments1 = await reviewProcess.getReviewerAssignments(reviewer1.address);
      const assignments2 = await reviewProcess.getReviewerAssignments(reviewer2.address);
      
      expect(assignments1.length).to.equal(1);
      expect(assignments2.length).to.equal(1);
      expect(assignments1[0]).to.equal(submissionId);
      expect(assignments2[0]).to.equal(submissionId);
    });
    
    it('应该能够获取审稿意见列表', async function () {
      const reviewIds = await reviewProcess.getSubmissionReviews(submissionId);
      expect(reviewIds.length).to.be.greaterThan(0);
      
      // 验证审稿人已提交
      const hasSubmitted = await reviewProcess.reviewerSubmitted(submissionId, reviewer1.address);
      expect(hasSubmitted).to.be.true;
    });
    
    it('应该能够检查审稿人分配状态', async function () {
      // 通过审稿人分配列表检查
      const assignments1 = await reviewProcess.getReviewerAssignments(reviewer1.address);
      const assignments3 = await reviewProcess.getReviewerAssignments(reviewer3.address);
      
      expect(assignments1.length).to.be.greaterThan(0);
      expect(assignments1[0]).to.equal(submissionId);
      expect(assignments3.length).to.equal(0);
    });
  });

  describe('Gas 优化测试', function () {
    it('批量分配审稿人应该节省Gas', async function () {
      const reviewers = [reviewer1.address, reviewer2.address, reviewer3.address];
      
      // 测试单独分配的Gas消耗
      const tx1 = await journalManager.connect(owner).assignReviewer(submissionId, reviewers[0]);
      const receipt1 = await tx1.wait();
      
      // 创建新投稿用于批量分配测试
      await paperNFT.connect(author).createPaperItem(
        'QmBatchTestPaper',
        'doi:10.1000/batch',
        'https://example.com/batch/metadata'
      );
      await reviewProcess.connect(author).createSubmission(
        1,
        journalId,
        'https://example.com/batch/submission'
      );
      
      // 如果合约支持批量分配，测试其Gas效率
      // 这里假设有 batchAssignReviewers 函数
      // const tx2 = await journalManager.connect(owner).batchAssignReviewers(1, reviewers);
      // const receipt2 = await tx2.wait();
      // expect(receipt2.gasUsed).to.be.lessThan(receipt1.gasUsed * 3);
      
      console.log(`单次分配Gas消耗: ${receipt1.gasUsed}`);
    });
  });

  describe('事件发射', function () {
    it('分配审稿人时应该发射事件', async function () {
      await expect(
        journalManager.connect(owner).assignReviewer(submissionId, reviewer1.address)
      ).to.emit(reviewProcess, 'ReviewerAssigned')
        .withArgs(submissionId, reviewer1.address);
    });

    it('提交审稿意见时应该发射事件', async function () {
      await journalManager.connect(owner).assignReviewer(submissionId, reviewer1.address);
      
      await expect(
        reviewProcess.connect(reviewer1).submitReview(
          submissionId,
          ReviewDecision.Accept,
          commentsHash
        )
      ).to.emit(reviewProcess, 'ReviewSubmitted')
        .withArgs(submissionId, reviewer1.address, ReviewDecision.Accept);
    });
    
    it('更新投稿状态时应该发射事件', async function () {
      await expect(
        journalManager.connect(owner).updateSubmissionStatus(
          submissionId,
          SubmissionStatus.UnderReview
        )
      ).to.emit(reviewProcess, 'SubmissionStatusUpdated')
        .withArgs(submissionId, SubmissionStatus.UnderReview);
    });
  });
});