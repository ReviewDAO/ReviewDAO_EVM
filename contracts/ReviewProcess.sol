// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./paperNFT.sol";

/**
 * @title ReviewProcess
 * @dev 处理学术论文的投稿和审稿流程
 */
contract ReviewProcess {
    
    // 论文状态枚举
    enum SubmissionStatus {
        Submitted,      // 已投稿
        UnderReview,   // 审核中
        Rejected,      // 已拒绝
        RevisionRequired, // 需要修改
        Accepted,      // 已接受
        Published      // 已发表
    }
    
    // 审稿意见类型
    enum ReviewDecision {
        None,           // 未决定
        Accept,         // 接受
        MinorRevision,  // 小修改
        MajorRevision,  // 大修改
        Reject          // 拒绝
    }
    
    // 投稿信息结构
    struct Submission {
        uint256 paperId;         // 论文NFT ID
        address author;          // 作者地址
        uint256 journalId;       // 期刊ID
        SubmissionStatus status;  // 投稿状态
        uint256 submissionTime;  // 投稿时间
        uint256 lastUpdateTime;  // 最后更新时间
        address[] reviewers;     // 审稿人列表
        uint256 revisionCount;   // 修改次数
        string metadataURI;      // 元数据URI（包含标题、摘要等）
    }
    
    // 审稿意见结构
    struct Review {
        address reviewer;        // 审稿人地址
        uint256 submissionId;    // 投稿ID
        ReviewDecision decision;  // 审稿决定
        string commentsHash;     // 审稿意见的IPFS哈希
        uint256 reviewTime;      // 审稿时间
        bool isCompleted;        // 是否完成
        uint256 reward;          // 审稿奖励
    }
    
    // 计数器
    uint256 private _submissionIdCounter;
    uint256 private _reviewIdCounter;
    
    // 存储映射
    mapping(uint256 => Submission) public submissions;
    mapping(uint256 => Review) public reviews;
    mapping(uint256 => uint256[]) public submissionReviews; // 投稿ID => 审稿ID列表
    mapping(address => uint256[]) public authorSubmissions; // 作者地址 => 投稿ID列表
    mapping(address => uint256[]) public reviewerAssignments; // 审稿人地址 => 投稿ID列表
    mapping(uint256 => uint256) public paperToSubmission; // 论文ID => 投稿ID
    
    // 事件
    event SubmissionCreated(uint256 submissionId, address author, uint256 paperId, uint256 journalId);
    event ReviewerAssigned(uint256 submissionId, address reviewer);
    event ReviewSubmitted(uint256 reviewId, address reviewer, uint256 submissionId, ReviewDecision decision);
    event SubmissionStatusUpdated(uint256 submissionId, SubmissionStatus newStatus);
    event PaperPublished(uint256 submissionId, uint256 paperId, address author);
    
    // 合约引用
    PaperNFT public paperNFT;
    address public journalManagerAddress;
    
    // 修饰器
    modifier onlyJournalManager() {
        require(msg.sender == journalManagerAddress, "Only journal manager can call this function");
        _;
    }
    
    modifier onlyAssignedReviewer(uint256 submissionId) {
        bool isAssigned = false;
        for (uint i = 0; i < submissions[submissionId].reviewers.length; i++) {
            if (submissions[submissionId].reviewers[i] == msg.sender) {
                isAssigned = true;
                break;
            }
        }
        require(isAssigned, "Only assigned reviewers can call this function");
        _;
    }
    
    modifier onlySubmissionAuthor(uint256 submissionId) {
        require(submissions[submissionId].author == msg.sender, "Only submission author can call this function");
        _;
    }
    
    // 构造函数
    constructor(address _paperNFTAddress, address _journalManagerAddress) {
        paperNFT = PaperNFT(_paperNFTAddress);
        journalManagerAddress = _journalManagerAddress;
    }
    
    /**
     * @dev 创建新投稿
     * @param _paperId 论文NFT ID
     * @param _journalId 期刊ID
     * @param _metadataURI 元数据URI
     */
    function createSubmission(uint256 _paperId, uint256 _journalId, string calldata _metadataURI) external {
        require(paperNFT.ownerOf(_paperId) == msg.sender, "Only paper owner can submit");
        
        uint256 submissionId = _submissionIdCounter;
        _submissionIdCounter++;
        
        Submission storage submission = submissions[submissionId];
        submission.paperId = _paperId;
        submission.author = msg.sender;
        submission.journalId = _journalId;
        submission.status = SubmissionStatus.Submitted;
        submission.submissionTime = block.timestamp;
        submission.lastUpdateTime = block.timestamp;
        submission.metadataURI = _metadataURI;
        
        authorSubmissions[msg.sender].push(submissionId);
        paperToSubmission[_paperId] = submissionId;
        
        emit SubmissionCreated(submissionId, msg.sender, _paperId, _journalId);
    }
    
    /**
     * @dev 分配审稿人
     * @param _submissionId 投稿ID
     * @param _reviewer 审稿人地址
     */
    function assignReviewer(uint256 _submissionId, address _reviewer) external onlyJournalManager {
        Submission storage submission = submissions[_submissionId];
        require(submission.status == SubmissionStatus.Submitted || submission.status == SubmissionStatus.UnderReview, "Invalid submission status");
        
        // 检查审稿人是否已分配
        for (uint i = 0; i < submission.reviewers.length; i++) {
            require(submission.reviewers[i] != _reviewer, "Reviewer already assigned");
        }
        
        submission.reviewers.push(_reviewer);
        if (submission.status == SubmissionStatus.Submitted) {
            submission.status = SubmissionStatus.UnderReview;
            emit SubmissionStatusUpdated(_submissionId, SubmissionStatus.UnderReview);
        }
        submission.lastUpdateTime = block.timestamp;
        
        reviewerAssignments[_reviewer].push(_submissionId);
        
        emit ReviewerAssigned(_submissionId, _reviewer);
    }
    
    /**
     * @dev 提交审稿意见
     * @param _submissionId 投稿ID
     * @param _decision 审稿决定
     * @param _commentsHash 审稿意见的IPFS哈希
     */
    function submitReview(uint256 _submissionId, ReviewDecision _decision, string calldata _commentsHash) 
        external 
        onlyAssignedReviewer(_submissionId) 
    {
        require(_decision != ReviewDecision.None, "Invalid review decision");
        
        uint256 reviewId = _reviewIdCounter;
        _reviewIdCounter++;
        
        Review storage review = reviews[reviewId];
        review.reviewer = msg.sender;
        review.submissionId = _submissionId;
        review.decision = _decision;
        review.commentsHash = _commentsHash;
        review.reviewTime = block.timestamp;
        review.isCompleted = true;
        
        submissionReviews[_submissionId].push(reviewId);
        
        emit ReviewSubmitted(reviewId, msg.sender, _submissionId, _decision);
        
        // 检查是否所有审稿人都已提交意见，如果是则更新投稿状态
        _updateSubmissionStatus(_submissionId);
    }
    
    /**
     * @dev 更新投稿状态
     * @param _submissionId 投稿ID
     */
    function _updateSubmissionStatus(uint256 _submissionId) internal {
        Submission storage submission = submissions[_submissionId];
        uint256[] memory reviewIds = submissionReviews[_submissionId];
        
        // 如果没有审稿意见，不更新状态
        if (reviewIds.length == 0) return;
        
        // 检查是否所有审稿人都已提交意见
        bool allReviewsCompleted = true;
        for (uint i = 0; i < submission.reviewers.length; i++) {
            bool reviewerSubmitted = false;
            for (uint j = 0; j < reviewIds.length; j++) {
                if (reviews[reviewIds[j]].reviewer == submission.reviewers[i]) {
                    reviewerSubmitted = true;
                    break;
                }
            }
            if (!reviewerSubmitted) {
                allReviewsCompleted = false;
                break;
            }
        }
        
        if (!allReviewsCompleted) return;
        
        // 统计审稿决定
        uint acceptCount = 0;
        uint minorRevisionCount = 0;
        uint majorRevisionCount = 0;
        uint rejectCount = 0;
        
        for (uint i = 0; i < reviewIds.length; i++) {
            ReviewDecision decision = reviews[reviewIds[i]].decision;
            if (decision == ReviewDecision.Accept) acceptCount++;
            else if (decision == ReviewDecision.MinorRevision) minorRevisionCount++;
            else if (decision == ReviewDecision.MajorRevision) majorRevisionCount++;
            else if (decision == ReviewDecision.Reject) rejectCount++;
        }
        
        // 根据多数决定更新状态
        SubmissionStatus newStatus;
        if (rejectCount > reviewIds.length / 2) {
            newStatus = SubmissionStatus.Rejected;
        } else if (majorRevisionCount > reviewIds.length / 2) {
            newStatus = SubmissionStatus.RevisionRequired;
        } else if (minorRevisionCount > reviewIds.length / 2) {
            newStatus = SubmissionStatus.RevisionRequired;
        } else if (acceptCount > reviewIds.length / 2) {
            newStatus = SubmissionStatus.Accepted;
        } else {
            // 如果没有明确多数，则需要期刊编辑决定
            return;
        }
        
        submission.status = newStatus;
        submission.lastUpdateTime = block.timestamp;
        
        emit SubmissionStatusUpdated(_submissionId, newStatus);
    }
    
    /**
     * @dev 编辑手动更新投稿状态
     * @param _submissionId 投稿ID
     * @param _newStatus 新状态
     */
    function updateSubmissionStatus(uint256 _submissionId, SubmissionStatus _newStatus) 
        external 
        onlyJournalManager 
    {
        Submission storage submission = submissions[_submissionId];
        submission.status = _newStatus;
        submission.lastUpdateTime = block.timestamp;
        
        emit SubmissionStatusUpdated(_submissionId, _newStatus);
    }
    
    /**
     * @dev 提交修改版本
     * @param _submissionId 投稿ID
     * @param _newIpfsHash 新的IPFS哈希
     * @param _newMetadataURI 新的元数据URI
     */
    function submitRevision(uint256 _submissionId, string calldata _newIpfsHash, string calldata _newMetadataURI) 
        external 
        onlySubmissionAuthor(_submissionId) 
    {
        Submission storage submission = submissions[_submissionId];
        require(submission.status == SubmissionStatus.RevisionRequired, "Submission must require revision");
        
        uint256 paperId = submission.paperId;
        
        // 更新论文内容
        paperNFT.updateDataItem(paperId, _newIpfsHash, _newMetadataURI);
        
        // 更新投稿信息
        submission.revisionCount++;
        submission.status = SubmissionStatus.UnderReview;
        submission.lastUpdateTime = block.timestamp;
        submission.metadataURI = _newMetadataURI;
        
        emit SubmissionStatusUpdated(_submissionId, SubmissionStatus.UnderReview);
    }
    
    /**
     * @dev 发表论文
     * @param _submissionId 投稿ID
     */
    function publishPaper(uint256 _submissionId) external onlyJournalManager {
        Submission storage submission = submissions[_submissionId];
        require(submission.status == SubmissionStatus.Accepted, "Submission must be accepted");
        
        submission.status = SubmissionStatus.Published;
        submission.lastUpdateTime = block.timestamp;
        
        // 冻结论文数据，防止后续修改
        paperNFT.freezeData(submission.paperId, true);
        
        emit SubmissionStatusUpdated(_submissionId, SubmissionStatus.Published);
        emit PaperPublished(_submissionId, submission.paperId, submission.author);
    }
    
    /**
     * @dev 获取投稿的审稿意见列表
     * @param _submissionId 投稿ID
     */
    function getSubmissionReviews(uint256 _submissionId) external view returns (uint256[] memory) {
        return submissionReviews[_submissionId];
    }
    
    /**
     * @dev 获取作者的投稿列表
     * @param _author 作者地址
     */
    function getAuthorSubmissions(address _author) external view returns (uint256[] memory) {
        return authorSubmissions[_author];
    }
    
    /**
     * @dev 获取审稿人的分配列表
     * @param _reviewer 审稿人地址
     */
    function getReviewerAssignments(address _reviewer) external view returns (uint256[] memory) {
        return reviewerAssignments[_reviewer];
    }
}