// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./ReviewProcess.sol";
import "./ReviewerDAO.sol";

/**
 * @title JournalManager
 * @dev 管理期刊的合约，包含编辑角色管理
 */
contract JournalManager is AccessControl, ReentrancyGuard {
    
    // 角色定义
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant EDITOR_ROLE = keccak256("EDITOR_ROLE");
    
    // 期刊状态
    enum JournalStatus {
        Active,     // 活跃
        Suspended,  // 暂停
        Closed      // 关闭
    }
    
    // 期刊信息结构
    struct Journal {
        uint256 id;              // 期刊ID
        string name;             // 期刊名称
        string description;      // 期刊描述
        string metadataURI;      // 元数据URI
        address owner;           // 期刊所有者
        uint256 submissionFee;   // 投稿费用
        uint256 createdTime;     // 创建时间
        JournalStatus status;    // 期刊状态
        string[] categories;     // 学科分类
        uint256 totalSubmissions; // 总投稿数
        uint256 totalPublished;   // 总发表数
        ReviewerDAO.ReviewerTier minReviewerTier; // 最低审稿人等级要求
        uint256 requiredReviewers; // 所需审稿人数量
    }
    
    // 期刊统计信息
    struct JournalStats {
        uint256 acceptanceRate;  // 接受率 (x100)
        uint256 averageReviewTime; // 平均审稿时间
        uint256 impactScore;     // 影响力分数
        uint256 totalCitations;  // 总引用数
    }
    
    // 存储映射
    mapping(uint256 => Journal) public journals;
    mapping(uint256 => JournalStats) public journalStats;
    mapping(address => uint256[]) public ownerJournals; // 所有者 => 期刊ID列表
    mapping(string => bool) public journalNameExists; // 期刊名称是否存在
    mapping(uint256 => mapping(address => bool)) public submissionReviewers; // 投稿ID => 审稿人 => 是否已分配
    mapping(uint256 => address[]) public journalEditors; // 期刊ID => 编辑列表
    mapping(address => uint256) public editorJournalCount; // 编辑 => 担任编辑的期刊数量
    
    // 计数器
    uint256 private _journalIdCounter;
    
    // 合约引用
    ReviewProcess public reviewProcess;
    ReviewerDAO public reviewerDAO;
    
    // 事件
    event JournalCreated(uint256 indexed journalId, string name, address indexed owner);
    event JournalStatusChanged(uint256 indexed journalId, JournalStatus newStatus);
    event SubmissionFeeUpdated(uint256 indexed journalId, uint256 newFee);
    event ReviewerAssigned(uint256 indexed submissionId, address indexed reviewer);
    event ReviewRewardDistributed(address indexed reviewer, uint256 indexed reviewId, uint256 amount);
    event PaperPublished(uint256 indexed submissionId, uint256 indexed journalId, string volumeInfo);
    event JournalRequirementsUpdated(uint256 indexed journalId, ReviewerDAO.ReviewerTier minTier, uint256 requiredReviewers);
    event EditorAdded(uint256 indexed journalId, address indexed editor);
    event EditorRemoved(uint256 indexed journalId, address indexed editor);
    
    /**
     * @dev 构造函数
     */
    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
    }
    
    /**
     * @dev 设置合约地址
     * @param _reviewProcessAddress ReviewProcess合约地址
     * @param _reviewerDAOAddress ReviewerDAO合约地址
     */
    function setContractAddresses(address _reviewProcessAddress, address _reviewerDAOAddress) external onlyRole(ADMIN_ROLE) {
        reviewProcess = ReviewProcess(_reviewProcessAddress);
        reviewerDAO = ReviewerDAO(_reviewerDAOAddress);
    }
    
    /**
     * @dev 创建期刊
     * @param _name 期刊名称
     * @param _description 期刊描述
     * @param _metadataURI 元数据URI
     * @param _owner 期刊所有者
     * @param _submissionFee 投稿费用
     * @param _categories 学科分类
     * @param _minReviewerTier 最低审稿人等级要求
     * @param _requiredReviewers 所需审稿人数量
     */
    function createJournal(
        string calldata _name,
        string calldata _description,
        string calldata _metadataURI,
        address _owner,
        uint256 _submissionFee,
        string[] calldata _categories,
        ReviewerDAO.ReviewerTier _minReviewerTier,
        uint256 _requiredReviewers
    ) external onlyRole(ADMIN_ROLE) {
        require(!journalNameExists[_name], "Journal name already exists");
        require(_owner != address(0), "Invalid owner address");
        require(bytes(_name).length > 0, "Journal name cannot be empty");
        require(_requiredReviewers > 0 && _requiredReviewers <= 10, "Invalid reviewer count");
        
        uint256 journalId = _journalIdCounter;
        _journalIdCounter++;
        
        Journal storage journal = journals[journalId];
        journal.id = journalId;
        journal.name = _name;
        journal.description = _description;
        journal.metadataURI = _metadataURI;
        journal.owner = _owner;
        journal.submissionFee = _submissionFee;
        journal.createdTime = block.timestamp;
        journal.status = JournalStatus.Active;
        journal.categories = _categories;
        journal.minReviewerTier = _minReviewerTier;
        journal.requiredReviewers = _requiredReviewers;
        
        ownerJournals[_owner].push(journalId);
        journalNameExists[_name] = true;
        
        emit JournalCreated(journalId, _name, _owner);
    }
    
    /**
     * @dev 添加期刊编辑
     * @param _journalId 期刊ID
     * @param _editor 编辑地址
     */
    function addEditor(uint256 _journalId, address _editor) external {
        require(_isJournalOwner(_journalId, msg.sender) || hasRole(ADMIN_ROLE, msg.sender), "Not authorized");
        require(_editor != address(0), "Invalid editor address");
        
        // 检查编辑是否已经在该期刊中
        require(!_isJournalEditor(_journalId, _editor), "Editor already exists in this journal");
        
        // 授予编辑角色（如果还没有的话）
        if (!hasRole(EDITOR_ROLE, _editor)) {
            _grantRole(EDITOR_ROLE, _editor);
        }
        
        // 添加到期刊编辑列表
        journalEditors[_journalId].push(_editor);
        
        // 增加编辑的期刊计数
        editorJournalCount[_editor]++;
        
        emit EditorAdded(_journalId, _editor);
    }
    
    /**
     * @dev 移除期刊编辑
     * @param _journalId 期刊ID
     * @param _editor 编辑地址
     */
    function removeEditor(uint256 _journalId, address _editor) external {
        require(_isJournalOwner(_journalId, msg.sender) || hasRole(ADMIN_ROLE, msg.sender), "Not authorized");
        require(_isJournalEditor(_journalId, _editor), "Editor not found in this journal");
        
        // 从期刊编辑列表中移除
        address[] storage editors = journalEditors[_journalId];
        for (uint256 i = 0; i < editors.length; i++) {
            if (editors[i] == _editor) {
                editors[i] = editors[editors.length - 1];
                editors.pop();
                break;
            }
        }
        
        // 减少编辑的期刊计数
        editorJournalCount[_editor]--;
        
        // 如果不再是任何期刊的编辑，撤销编辑角色
        if (editorJournalCount[_editor] == 0) {
            _revokeRole(EDITOR_ROLE, _editor);
        }
        
        emit EditorRemoved(_journalId, _editor);
    }
    
    /**
     * @dev 分配审稿人到投稿（编辑操作）
     * @param _submissionId 投稿ID
     * @param _reviewer 审稿人地址
     */
    function assignReviewer(uint256 _submissionId, address _reviewer) external {
        // 获取投稿信息
        (, , uint256 journalId, , , , , ) = reviewProcess.submissions(_submissionId);
        require(
            _isJournalOwner(journalId, msg.sender) || 
            hasRole(ADMIN_ROLE, msg.sender) || 
            (_isJournalEditor(journalId, msg.sender) && hasRole(EDITOR_ROLE, msg.sender)),
            "Not authorized"
        );
        require(reviewerDAO.hasRole(reviewerDAO.REVIEWER_ROLE(), _reviewer), "Not a registered reviewer");
        require(!submissionReviewers[_submissionId][_reviewer], "Reviewer already assigned");
        
        // 检查审稿人等级是否符合要求
        (ReviewerDAO.ReviewerTier tier, , , , , bool isActive) = reviewerDAO.getReviewerInfo(_reviewer);
        require(isActive, "Reviewer not active");
        require(tier >= journals[journalId].minReviewerTier, "Reviewer tier too low");
        
        // 调用ReviewProcess合约分配审稿人
        reviewProcess.assignReviewer(_submissionId, _reviewer);
        submissionReviewers[_submissionId][_reviewer] = true;
        
        emit ReviewerAssigned(_submissionId, _reviewer);
    }
    
    /**
     * @dev 分配审稿奖励
     * @param _reviewId 审稿ID
     * @param _submissionId 投稿ID
     * @param _qualityScore 质量评分 (0-100)
     * @param _timelyCompletion 是否及时完成
     */
    function distributeReviewReward(
        uint256 _reviewId,
        uint256 _submissionId,
        uint256 _qualityScore,
        bool _timelyCompletion
    ) external nonReentrant {
        require(_qualityScore <= 100, "Quality score must be <= 100");
        
        // 获取审稿信息
        (address reviewer, , , , , bool isCompleted, ) = reviewProcess.reviews(_reviewId);
        require(isCompleted, "Review not completed");
        require(reviewer != address(0), "Invalid reviewer");
        
        // 获取投稿信息
        (, , uint256 journalId, , , , , ) = reviewProcess.submissions(_submissionId);
        require(
            _isJournalOwner(journalId, msg.sender) || 
            hasRole(ADMIN_ROLE, msg.sender) ||
            (_isJournalEditor(journalId, msg.sender) && hasRole(EDITOR_ROLE, msg.sender)),
            "Not authorized"
        );
        
        // 计算奖励
        uint256 reward = _calculateReward(reviewer, _qualityScore, _timelyCompletion);
        
        // 分发奖励
        reviewerDAO.distributeReward(reviewer, _reviewId, reward);
        
        // 更新审稿人声誉
        int256 reputationChange = _calculateReputationChange(_qualityScore, _timelyCompletion);
        reviewerDAO.updateReviewerReputation(reviewer, reputationChange);
        
        emit ReviewRewardDistributed(reviewer, _reviewId, reward);
    }
    
    /**
     * @dev 更新投稿状态
     * @param _submissionId 投稿ID
     * @param _newStatus 新状态
     */
    function updateSubmissionStatus(uint256 _submissionId, ReviewProcess.SubmissionStatus _newStatus) external {
        // 获取投稿信息
        (, , uint256 journalId, , , , , ) = reviewProcess.submissions(_submissionId);
        require(
            _isJournalOwner(journalId, msg.sender) || 
            hasRole(ADMIN_ROLE, msg.sender) ||
            (_isJournalEditor(journalId, msg.sender) && hasRole(EDITOR_ROLE, msg.sender)),
            "Not authorized"
        );
        
        // 调用ReviewProcess合约更新状态
        reviewProcess.updateSubmissionStatus(_submissionId, _newStatus);
    }
    
    /**
     * @dev 发表论文
     * @param _submissionId 投稿ID
     * @param _volumeInfo 卷期信息
     */
    function publishPaper(uint256 _submissionId, string calldata _volumeInfo) external {
        // 获取投稿信息
        (, , uint256 journalId, , , , , ) = reviewProcess.submissions(_submissionId);
        require(
            _isJournalOwner(journalId, msg.sender) || 
            hasRole(ADMIN_ROLE, msg.sender) ||
            (_isJournalEditor(journalId, msg.sender) && hasRole(EDITOR_ROLE, msg.sender)),
            "Not authorized"
        );
        
        // 更新投稿状态为已发表
        reviewProcess.updateSubmissionStatus(_submissionId, ReviewProcess.SubmissionStatus.Published);
        
        // 更新期刊统计
        journals[journalId].totalPublished++;
        
        emit PaperPublished(_submissionId, journalId, _volumeInfo);
    }
    
    /**
     * @dev 更新期刊状态
     * @param _journalId 期刊ID
     * @param _newStatus 新状态
     */
    function updateJournalStatus(uint256 _journalId, JournalStatus _newStatus) external {
        require(_isJournalOwner(_journalId, msg.sender) || hasRole(ADMIN_ROLE, msg.sender), "Not authorized");
        
        journals[_journalId].status = _newStatus;
        
        emit JournalStatusChanged(_journalId, _newStatus);
    }
    
    /**
     * @dev 更新投稿费用
     * @param _journalId 期刊ID
     * @param _newFee 新费用
     */
    function updateSubmissionFee(uint256 _journalId, uint256 _newFee) external {
        require(_isJournalOwner(_journalId, msg.sender) || hasRole(ADMIN_ROLE, msg.sender), "Not authorized");
        
        journals[_journalId].submissionFee = _newFee;
        
        emit SubmissionFeeUpdated(_journalId, _newFee);
    }
    
    /**
     * @dev 更新期刊审稿要求
     * @param _journalId 期刊ID
     * @param _minReviewerTier 最低审稿人等级
     * @param _requiredReviewers 所需审稿人数量
     */
    function updateJournalRequirements(
        uint256 _journalId,
        ReviewerDAO.ReviewerTier _minReviewerTier,
        uint256 _requiredReviewers
    ) external {
        require(_isJournalOwner(_journalId, msg.sender) || hasRole(ADMIN_ROLE, msg.sender), "Not authorized");
        require(_requiredReviewers > 0 && _requiredReviewers <= 10, "Invalid reviewer count");
        
        journals[_journalId].minReviewerTier = _minReviewerTier;
        journals[_journalId].requiredReviewers = _requiredReviewers;
        
        emit JournalRequirementsUpdated(_journalId, _minReviewerTier, _requiredReviewers);
    }
    
    /**
     * @dev 获取所有者管理的期刊列表
     * @param _owner 所有者地址
     * @return 期刊ID列表
     */
    function getOwnerJournals(address _owner) external view returns (uint256[] memory) {
        return ownerJournals[_owner];
    }
    
    /**
     * @dev 获取期刊信息
     * @param _journalId 期刊ID
     * @return 期刊信息
     */
    function getJournalInfo(uint256 _journalId) external view returns (Journal memory) {
        return journals[_journalId];
    }
    
    /**
     * @dev 获取期刊统计信息
     * @param _journalId 期刊ID
     * @return 统计信息
     */
    function getJournalStats(uint256 _journalId) external view returns (JournalStats memory) {
        return journalStats[_journalId];
    }
    
    /**
     * @dev 获取期刊编辑列表
     * @param _journalId 期刊ID
     * @return 编辑地址数组
     */
    function getJournalEditors(uint256 _journalId) external view returns (address[] memory) {
        return journalEditors[_journalId];
    }

    /**
     * @dev 获取期刊总数
     * @return 期刊总数
     */
    function getJournalCount() external view returns (uint256) {
        return _journalIdCounter;
    }
    
    /**
     * @dev 检查是否为期刊所有者
     * @param _journalId 期刊ID
     * @param _owner 所有者地址
     * @return 是否为所有者
     */
    function _isJournalOwner(uint256 _journalId, address _owner) internal view returns (bool) {
        return journals[_journalId].owner == _owner;
    }
    
    /**
     * @dev 检查是否为期刊编辑
     * @param _journalId 期刊ID
     * @param _editor 编辑地址
     * @return 是否为编辑
     */
    function _isJournalEditor(uint256 _journalId, address _editor) internal view returns (bool) {
        address[] memory editors = journalEditors[_journalId];
        for (uint256 i = 0; i < editors.length; i++) {
            if (editors[i] == _editor) {
                return true;
            }
        }
        return false;
    }
    
    /**
     * @dev 计算审稿奖励
     * @param _reviewer 审稿人地址
     * @param _qualityScore 质量评分
     * @param _timelyCompletion 是否及时完成
     * @return 奖励金额
     */
    function _calculateReward(address _reviewer, uint256 _qualityScore, bool _timelyCompletion) internal view returns (uint256) {
        (uint256 baseReward, uint256 juniorMultiplier, uint256 seniorMultiplier, uint256 expertMultiplier, uint256 qualityBonus, uint256 speedBonus) = reviewerDAO.rewardParams();
        (, ReviewerDAO.ReviewerTier tier, , , , , ) = reviewerDAO.reviewers(_reviewer);
        
        uint256 multiplier = juniorMultiplier;
        
        if (tier == ReviewerDAO.ReviewerTier.Senior) {
            multiplier = seniorMultiplier;
        } else if (tier == ReviewerDAO.ReviewerTier.Expert) {
            multiplier = expertMultiplier;
        }
        
        uint256 reward = (baseReward * multiplier) / 100;
        
        // 质量奖励
        if (_qualityScore >= 80) {
            reward += qualityBonus;
        }
        
        // 速度奖励
        if (_timelyCompletion) {
            reward += speedBonus;
        }
        
        return reward;
    }
    
    /**
     * @dev 计算声誉变化
     * @param _qualityScore 质量评分
     * @param _timelyCompletion 是否及时完成
     * @return 声誉变化
     */
    function _calculateReputationChange(uint256 _qualityScore, bool _timelyCompletion) internal pure returns (int256) {
        int256 change = 0;
        
        if (_qualityScore >= 90) {
            change += 10;
        } else if (_qualityScore >= 80) {
            change += 5;
        } else if (_qualityScore >= 70) {
            change += 2;
        } else if (_qualityScore < 50) {
            change -= 5;
        }
        
        if (_timelyCompletion) {
            change += 2;
        }
        
        return change;
    }
}