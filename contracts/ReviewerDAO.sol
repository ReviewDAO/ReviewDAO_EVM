// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/access/extensions/AccessControlEnumerable.sol";
import "./ReviewProcess.sol";

/**
 * @title ReviewerDAO
 * @dev 管理审稿人DAO的治理和激励机制
 */
contract ReviewerDAO is ERC20, ERC20Burnable, AccessControlEnumerable {
    
    // 角色定义
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant EDITOR_ROLE = keccak256("EDITOR_ROLE");
    bytes32 public constant REVIEWER_ROLE = keccak256("REVIEWER_ROLE");
    
    // 审稿人等级
    enum ReviewerTier {
        None,       // 未注册
        Junior,     // 初级
        Senior,     // 高级
        Expert      // 专家
    }
    
    // 审稿人信息
    struct Reviewer {
        address addr;           // 地址
        ReviewerTier tier;      // 等级
        uint256 reputation;     // 声誉分数
        uint256 completedReviews; // 完成的审稿数量
        uint256 joinedTime;     // 加入时间
        string metadataURI;     // 元数据URI（包含专业领域、简历等）
        bool isActive;          // 是否活跃
    }
    
    // 提案类型
    enum ProposalType {
        None,
        AddReviewer,        // 添加审稿人
        RemoveReviewer,     // 移除审稿人
        UpgradeReviewer,    // 升级审稿人
        UpdateParameters,   // 更新参数
        FundAllocation      // 资金分配
    }
    
    // 提案状态
    enum ProposalStatus {
        Pending,    // 待处理
        Active,     // 活跃
        Passed,     // 通过
        Rejected,   // 拒绝
        Executed    // 已执行
    }
    
    // 提案结构
    struct Proposal {
        uint256 id;              // 提案ID
        address proposer;        // 提案人
        ProposalType proposalType; // 提案类型
        string description;      // 描述
        bytes data;              // 提案数据
        uint256 startTime;       // 开始时间
        uint256 endTime;         // 结束时间
        uint256 forVotes;        // 赞成票
        uint256 againstVotes;    // 反对票
        ProposalStatus status;   // 状态
        mapping(address => bool) hasVoted; // 投票记录
    }
    
    // 审稿奖励参数
    struct RewardParameters {
        uint256 baseReward;      // 基础奖励
        uint256 juniorMultiplier; // 初级乘数 (x100)
        uint256 seniorMultiplier; // 高级乘数 (x100)
        uint256 expertMultiplier; // 专家乘数 (x100)
        uint256 qualityBonus;    // 质量奖励
        uint256 speedBonus;      // 速度奖励
    }
    
    // 存储
    mapping(address => Reviewer) public reviewers;
    mapping(uint256 => Proposal) private proposals;
    mapping(uint256 => mapping(address => uint256)) public reviewRewards; // 审稿ID => 审稿人 => 奖励
    
    // 计数器
    uint256 private _proposalIdCounter;
    
    // DAO参数
    uint256 public votingPeriod = 3 days;
    uint256 public quorum = 10; // 10%
    uint256 public proposalThreshold = 100 * 10**18; // 100 tokens
    RewardParameters public rewardParams;
    
    // 合约引用
    ReviewProcess public reviewProcess;
    
    // 事件
    event ReviewerRegistered(address indexed reviewer, ReviewerTier tier);
    event ReviewerTierChanged(address indexed reviewer, ReviewerTier newTier);
    event ReviewerReputationChanged(address indexed reviewer, uint256 newReputation);
    event ProposalCreated(uint256 indexed proposalId, address indexed proposer, ProposalType proposalType);
    event ProposalVoted(uint256 indexed proposalId, address indexed voter, bool support, uint256 weight);
    event ProposalExecuted(uint256 indexed proposalId);
    event RewardDistributed(address indexed reviewer, uint256 indexed reviewId, uint256 amount);
    
    /**
     * @dev 构造函数
     * @param _name 代币名称
     * @param _symbol 代币符号
     */
    constructor(string memory _name, string memory _symbol) ERC20(_name, _symbol) {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
        
        // 初始化奖励参数
        rewardParams = RewardParameters({
            baseReward: 10 * 10**18, // 10 tokens
            juniorMultiplier: 100,  // 1x
            seniorMultiplier: 150,  // 1.5x
            expertMultiplier: 200,  // 2x
            qualityBonus: 5 * 10**18, // 5 tokens
            speedBonus: 3 * 10**18   // 3 tokens
        });
    }
    
    /**
     * @dev 设置ReviewProcess合约地址
     * @param _reviewProcessAddress ReviewProcess合约地址
     */
    function setReviewProcess(address _reviewProcessAddress) external onlyRole(ADMIN_ROLE) {
        reviewProcess = ReviewProcess(_reviewProcessAddress);
    }
    
    /**
     * @dev 设置JournalManager合约地址并授予EDITOR_ROLE权限
     * @param _journalManagerAddress JournalManager合约地址
     */
    function setJournalManager(address _journalManagerAddress) external onlyRole(ADMIN_ROLE) {
        _grantRole(EDITOR_ROLE, _journalManagerAddress);
    }
    
    /**
     * @dev 注册为审稿人
     * @param _metadataURI 元数据URI
     */
    function registerAsReviewer(string calldata _metadataURI) external {
        require(!hasRole(REVIEWER_ROLE, msg.sender), "Already registered as reviewer");
        
        _grantRole(REVIEWER_ROLE, msg.sender);
        
        Reviewer storage reviewer = reviewers[msg.sender];
        reviewer.addr = msg.sender;
        reviewer.tier = ReviewerTier.Junior;
        reviewer.reputation = 100; // 初始声誉
        reviewer.completedReviews = 0;
        reviewer.joinedTime = block.timestamp;
        reviewer.metadataURI = _metadataURI;
        reviewer.isActive = true;
        
        // 铸造初始代币
        _mint(msg.sender, 10 * 10**18); // 10 tokens
        
        emit ReviewerRegistered(msg.sender, ReviewerTier.Junior);
    }
    
    /**
     * @dev 更新审稿人元数据
     * @param _metadataURI 新的元数据URI
     */
    function updateReviewerMetadata(string calldata _metadataURI) external onlyRole(REVIEWER_ROLE) {
        reviewers[msg.sender].metadataURI = _metadataURI;
    }
    
    /**
     * @dev 更新审稿人等级（仅管理员）
     * @param _reviewer 审稿人地址
     * @param _newTier 新等级
     */
    function updateReviewerTier(address _reviewer, ReviewerTier _newTier) external onlyRole(ADMIN_ROLE) {
        require(hasRole(REVIEWER_ROLE, _reviewer), "Not a reviewer");
        require(_newTier != ReviewerTier.None, "Invalid tier");
        
        reviewers[_reviewer].tier = _newTier;
        
        emit ReviewerTierChanged(_reviewer, _newTier);
    }
    
    /**
     * @dev 更新审稿人声誉
     * @param _reviewer 审稿人地址
     * @param _reputationChange 声誉变化（可正可负）
     */
    function updateReviewerReputation(address _reviewer, int256 _reputationChange) external onlyRole(EDITOR_ROLE) {
        require(hasRole(REVIEWER_ROLE, _reviewer), "Not a reviewer");
        
        Reviewer storage reviewer = reviewers[_reviewer];
        
        if (_reputationChange >= 0) {
            reviewer.reputation += uint256(_reputationChange);
        } else {
            uint256 change = uint256(-_reputationChange);
            if (change > reviewer.reputation) {
                reviewer.reputation = 0;
            } else {
                reviewer.reputation -= change;
            }
        }
        
        // 根据声誉自动调整等级
        if (reviewer.reputation >= 500 && reviewer.completedReviews >= 50) {
            reviewer.tier = ReviewerTier.Expert;
        } else if (reviewer.reputation >= 300 && reviewer.completedReviews >= 20) {
            reviewer.tier = ReviewerTier.Senior;
        } else {
            reviewer.tier = ReviewerTier.Junior;
        }
        
        emit ReviewerReputationChanged(_reviewer, reviewer.reputation);
        emit ReviewerTierChanged(_reviewer, reviewer.tier);
    }
    
    /**
     * @dev 分配审稿奖励（由JournalManager调用）
     * @param _reviewer 审稿人地址
     * @param _reviewId 审稿ID
     * @param _amount 奖励金额
     */
    function distributeReward(address _reviewer, uint256 _reviewId, uint256 _amount) external onlyRole(EDITOR_ROLE) {
        require(hasRole(REVIEWER_ROLE, _reviewer), "Not a registered reviewer");
        require(reviewRewards[_reviewId][_reviewer] == 0, "Reward already distributed");
        
        Reviewer storage reviewer = reviewers[_reviewer];
        reviewer.completedReviews++;
        
        // 记录奖励
        reviewRewards[_reviewId][_reviewer] = _amount;
        
        // 铸造代币奖励
        _mint(_reviewer, _amount);
        
        emit RewardDistributed(_reviewer, _reviewId, _amount);
    }
    
    /**
     * @dev 计算并分配审稿奖励（内部使用）
     * @param _reviewId 审稿ID
     * @param _submissionId 投稿ID
     * @param _qualityScore 质量评分（0-100）
     * @param _timelyCompletion 是否及时完成
     */
    function distributeReviewReward(
        uint256 _reviewId, 
        uint256 _submissionId, 
        uint256 _qualityScore,
        bool _timelyCompletion
    ) external onlyRole(EDITOR_ROLE) {
        // 获取审稿信息需要通过ReviewProcess合约
        (address reviewer, uint256 submissionId, , , , bool isCompleted, ) = reviewProcess.reviews(_reviewId);
        require(isCompleted, "Review not completed");
        require(submissionId == _submissionId, "Review does not match submission");
        require(hasRole(REVIEWER_ROLE, reviewer), "Not a registered reviewer");
        require(reviewRewards[_reviewId][reviewer] == 0, "Reward already distributed");
        
        Reviewer storage reviewerInfo = reviewers[reviewer];
        reviewerInfo.completedReviews++;
        
        // 计算基础奖励
        uint256 multiplier;
        if (reviewerInfo.tier == ReviewerTier.Expert) {
            multiplier = rewardParams.expertMultiplier;
        } else if (reviewerInfo.tier == ReviewerTier.Senior) {
            multiplier = rewardParams.seniorMultiplier;
        } else {
            multiplier = rewardParams.juniorMultiplier;
        }
        
        uint256 baseReward = rewardParams.baseReward * multiplier / 100;
        
        // 计算质量奖励
        uint256 qualityReward = 0;
        if (_qualityScore >= 80) {
            qualityReward = rewardParams.qualityBonus * _qualityScore / 100;
        }
        
        // 计算速度奖励
        uint256 speedReward = 0;
        if (_timelyCompletion) {
            speedReward = rewardParams.speedBonus;
        }
        
        // 总奖励
        uint256 totalReward = baseReward + qualityReward + speedReward;
        
        // 记录奖励
        reviewRewards[_reviewId][reviewer] = totalReward;
        
        // 铸造代币奖励
        _mint(reviewer, totalReward);
        
        emit RewardDistributed(reviewer, _reviewId, totalReward);
    }
    
    /**
     * @dev 创建提案
     * @param _proposalType 提案类型
     * @param _description 描述
     * @param _data 提案数据
     */
    function createProposal(
        ProposalType _proposalType,
        string calldata _description,
        bytes calldata _data
    ) external onlyRole(REVIEWER_ROLE) {
        require(_proposalType != ProposalType.None, "Invalid proposal type");
        require(balanceOf(msg.sender) >= proposalThreshold, "Insufficient tokens to create proposal");
        
        uint256 proposalId = _proposalIdCounter;
        _proposalIdCounter++;
        
        Proposal storage proposal = proposals[proposalId];
        proposal.id = proposalId;
        proposal.proposer = msg.sender;
        proposal.proposalType = _proposalType;
        proposal.description = _description;
        proposal.data = _data;
        proposal.startTime = block.timestamp;
        proposal.endTime = block.timestamp + votingPeriod;
        proposal.status = ProposalStatus.Active;
        
        emit ProposalCreated(proposalId, msg.sender, _proposalType);
    }
    
    /**
     * @dev 对提案投票
     * @param _proposalId 提案ID
     * @param _support 是否支持
     */
    function voteOnProposal(uint256 _proposalId, bool _support) external onlyRole(REVIEWER_ROLE) {
        Proposal storage proposal = proposals[_proposalId];
        require(proposal.status == ProposalStatus.Active, "Proposal not active");
        require(block.timestamp <= proposal.endTime, "Voting period ended");
        require(!proposal.hasVoted[msg.sender], "Already voted");
        
        uint256 weight = balanceOf(msg.sender);
        require(weight > 0, "No voting power");
        
        proposal.hasVoted[msg.sender] = true;
        
        if (_support) {
            proposal.forVotes += weight;
        } else {
            proposal.againstVotes += weight;
        }
        
        emit ProposalVoted(_proposalId, msg.sender, _support, weight);
    }
    
    /**
     * @dev 结束提案投票
     * @param _proposalId 提案ID
     */
    function finalizeProposal(uint256 _proposalId) external {
        Proposal storage proposal = proposals[_proposalId];
        require(proposal.status == ProposalStatus.Active, "Proposal not active");
        require(block.timestamp > proposal.endTime, "Voting period not ended");
        
        uint256 totalVotes = proposal.forVotes + proposal.againstVotes;
        uint256 totalSupply = totalSupply();
        
        // 检查是否达到法定人数
        if (totalVotes * 100 < totalSupply * quorum) {
            proposal.status = ProposalStatus.Rejected;
            return;
        }
        
        // 检查是否通过
        if (proposal.forVotes > proposal.againstVotes) {
            proposal.status = ProposalStatus.Passed;
        } else {
            proposal.status = ProposalStatus.Rejected;
        }
    }
    
    /**
     * @dev 执行通过的提案
     * @param _proposalId 提案ID
     */
    function executeProposal(uint256 _proposalId) external onlyRole(ADMIN_ROLE) {
        Proposal storage proposal = proposals[_proposalId];
        require(proposal.status == ProposalStatus.Passed, "Proposal not passed");
        
        proposal.status = ProposalStatus.Executed;
        
        // 根据提案类型执行不同的操作
        if (proposal.proposalType == ProposalType.AddReviewer) {
            // 解析数据：地址和元数据URI
            (address reviewer, string memory metadataURI) = abi.decode(proposal.data, (address, string));
            
            if (!hasRole(REVIEWER_ROLE, reviewer)) {
                _grantRole(REVIEWER_ROLE, reviewer);
                
                Reviewer storage newReviewer = reviewers[reviewer];
                newReviewer.addr = reviewer;
                newReviewer.tier = ReviewerTier.Junior;
                newReviewer.reputation = 100;
                newReviewer.joinedTime = block.timestamp;
                newReviewer.metadataURI = metadataURI;
                newReviewer.isActive = true;
                
                _mint(reviewer, 10 * 10**18); // 初始代币
                
                emit ReviewerRegistered(reviewer, ReviewerTier.Junior);
            }
        } else if (proposal.proposalType == ProposalType.RemoveReviewer) {
            // 解析数据：地址
            address reviewer = abi.decode(proposal.data, (address));
            
            if (hasRole(REVIEWER_ROLE, reviewer)) {
                _revokeRole(REVIEWER_ROLE, reviewer);
                reviewers[reviewer].isActive = false;
            }
        } else if (proposal.proposalType == ProposalType.UpgradeReviewer) {
            // 解析数据：地址和新等级
            (address reviewer, ReviewerTier newTier) = abi.decode(proposal.data, (address, ReviewerTier));
            
            if (hasRole(REVIEWER_ROLE, reviewer) && newTier != ReviewerTier.None) {
                reviewers[reviewer].tier = newTier;
                emit ReviewerTierChanged(reviewer, newTier);
            }
        } else if (proposal.proposalType == ProposalType.UpdateParameters) {
            // 解析数据：新的奖励参数
            RewardParameters memory newParams = abi.decode(proposal.data, (RewardParameters));
            rewardParams = newParams;
        } else if (proposal.proposalType == ProposalType.FundAllocation) {
            // 解析数据：接收者地址和金额
            (address recipient, uint256 amount) = abi.decode(proposal.data, (address, uint256));
            
            // 铸造代币并转给接收者
            _mint(recipient, amount);
        }
        
        emit ProposalExecuted(_proposalId);
    }
    
    /**
     * @dev 获取提案信息
     * @param _proposalId 提案ID
     */
    function getProposalInfo(uint256 _proposalId) external view returns (
        address proposer,
        ProposalType proposalType,
        string memory description,
        uint256 startTime,
        uint256 endTime,
        uint256 forVotes,
        uint256 againstVotes,
        ProposalStatus status
    ) {
        Proposal storage proposal = proposals[_proposalId];
        return (
            proposal.proposer,
            proposal.proposalType,
            proposal.description,
            proposal.startTime,
            proposal.endTime,
            proposal.forVotes,
            proposal.againstVotes,
            proposal.status
        );
    }
    
    /**
     * @dev 检查地址是否已对提案投票
     * @param _proposalId 提案ID
     * @param _voter 投票者地址
     */
    function hasVotedOnProposal(uint256 _proposalId, address _voter) external view returns (bool) {
        return proposals[_proposalId].hasVoted[_voter];
    }
    
    /**
     * @dev 获取审稿人信息
     * @param _reviewer 审稿人地址
     */
    function getReviewerInfo(address _reviewer) external view returns (
        ReviewerTier tier,
        uint256 reputation,
        uint256 completedReviews,
        uint256 joinedTime,
        string memory metadataURI,
        bool isActive
    ) {
        Reviewer storage reviewer = reviewers[_reviewer];
        return (
            reviewer.tier,
            reviewer.reputation,
            reviewer.completedReviews,
            reviewer.joinedTime,
            reviewer.metadataURI,
            reviewer.isActive
        );
    }
    
    /**
     * @dev 获取所有活跃审稿人地址
     * @return 活跃审稿人地址数组
     */
    function getActiveReviewers() external view returns (address[] memory) {
        // 首先计算活跃审稿人数量
        uint256 activeCount = 0;
        uint256 totalReviewers = getRoleMemberCount(REVIEWER_ROLE);
        
        for (uint256 i = 0; i < totalReviewers; i++) {
            address reviewer = getRoleMember(REVIEWER_ROLE, i);
            if (reviewers[reviewer].isActive) {
                activeCount++;
            }
        }
        
        // 创建结果数组
        address[] memory activeReviewers = new address[](activeCount);
        uint256 index = 0;
        
        for (uint256 i = 0; i < totalReviewers; i++) {
            address reviewer = getRoleMember(REVIEWER_ROLE, i);
            if (reviewers[reviewer].isActive) {
                activeReviewers[index] = reviewer;
                index++;
            }
        }
        
        return activeReviewers;
    }
    
    /**
     * @dev 根据等级获取活跃审稿人
     * @param _minTier 最低等级要求
     * @return 符合条件的审稿人地址数组
     */
    function getActiveReviewersByTier(ReviewerTier _minTier) external view returns (address[] memory) {
        uint256 activeCount = 0;
        uint256 totalReviewers = getRoleMemberCount(REVIEWER_ROLE);
        
        // 计算符合条件的审稿人数量
        for (uint256 i = 0; i < totalReviewers; i++) {
            address reviewer = getRoleMember(REVIEWER_ROLE, i);
            if (reviewers[reviewer].isActive && reviewers[reviewer].tier >= _minTier) {
                activeCount++;
            }
        }
        
        // 创建结果数组
        address[] memory qualifiedReviewers = new address[](activeCount);
        uint256 index = 0;
        
        for (uint256 i = 0; i < totalReviewers; i++) {
            address reviewer = getRoleMember(REVIEWER_ROLE, i);
            if (reviewers[reviewer].isActive && reviewers[reviewer].tier >= _minTier) {
                qualifiedReviewers[index] = reviewer;
                index++;
            }
        }
        
        return qualifiedReviewers;
    }
    
    /**
     * @dev 随机推荐审稿人（供JournalManager调用）
     * @param _submissionId 投稿ID
     * @param _count 需要的审稿人数量
     * @param _minTier 最低等级要求
     * @return 推荐的审稿人地址数组
     */
    function recommendReviewers(
        uint256 _submissionId,
        uint256 _count,
        ReviewerTier _minTier
    ) external view returns (address[] memory) {
        require(_count > 0, "Count must be greater than 0");
        
        // 获取符合条件的审稿人
        address[] memory qualifiedReviewers = this.getActiveReviewersByTier(_minTier);
        require(qualifiedReviewers.length >= _count, "Not enough qualified reviewers");
        
        // 如果符合条件的审稿人数量正好等于需要的数量，直接返回
        if (qualifiedReviewers.length == _count) {
            return qualifiedReviewers;
        }
        
        // 使用伪随机算法选择审稿人
        address[] memory selectedReviewers = new address[](_count);
        bool[] memory used = new bool[](qualifiedReviewers.length);
        
        // 使用投稿ID、区块时间戳和区块随机数作为随机种子
        uint256 seed = uint256(keccak256(abi.encodePacked(
            _submissionId,
            block.timestamp,
            block.prevrandao,
            blockhash(block.number - 1)
        )));
        
        for (uint256 i = 0; i < _count; i++) {
            uint256 randomIndex;
            do {
                seed = uint256(keccak256(abi.encodePacked(seed, i)));
                randomIndex = seed % qualifiedReviewers.length;
            } while (used[randomIndex]);
            
            used[randomIndex] = true;
            selectedReviewers[i] = qualifiedReviewers[randomIndex];
        }
        
        return selectedReviewers;
    }
    
    /**
     * @dev 智能推荐审稿人（基于声誉和工作负载）
     * @param _submissionId 投稿ID
     * @param _count 需要的审稿人数量
     * @param _minTier 最低等级要求
     * @return 推荐的审稿人地址数组
     */
    function smartRecommendReviewers(
        uint256 _submissionId,
        uint256 _count,
        ReviewerTier _minTier
    ) external view returns (address[] memory) {
        require(_count > 0, "Count must be greater than 0");
        
        // 获取符合条件的审稿人
        address[] memory qualifiedReviewers = this.getActiveReviewersByTier(_minTier);
        require(qualifiedReviewers.length >= _count, "Not enough qualified reviewers");
        
        if (qualifiedReviewers.length == _count) {
            return qualifiedReviewers;
        }
        
        // 计算每个审稿人的权重分数（声誉 + 等级加权）
        uint256[] memory scores = new uint256[](qualifiedReviewers.length);
        
        for (uint256 i = 0; i < qualifiedReviewers.length; i++) {
            address reviewer = qualifiedReviewers[i];
            Reviewer storage reviewerInfo = reviewers[reviewer];
            
            // 基础分数 = 声誉分数
            uint256 score = reviewerInfo.reputation;
            
            // 等级加权
            if (reviewerInfo.tier == ReviewerTier.Expert) {
                score = score * 150 / 100; // 1.5x
            } else if (reviewerInfo.tier == ReviewerTier.Senior) {
                score = score * 125 / 100; // 1.25x
            }
            
            scores[i] = score;
        }
        
        // 使用加权随机选择
        address[] memory selectedReviewers = new address[](_count);
        bool[] memory used = new bool[](qualifiedReviewers.length);
        
        uint256 seed = uint256(keccak256(abi.encodePacked(
            _submissionId,
            block.timestamp,
            block.prevrandao
        )));
        
        for (uint256 i = 0; i < _count; i++) {
            // 计算总权重
            uint256 totalWeight = 0;
            for (uint256 j = 0; j < qualifiedReviewers.length; j++) {
                if (!used[j]) {
                    totalWeight += scores[j];
                }
            }
            
            // 生成随机数
            seed = uint256(keccak256(abi.encodePacked(seed, i)));
            uint256 randomWeight = seed % totalWeight;
            
            // 选择审稿人
            uint256 currentWeight = 0;
            for (uint256 j = 0; j < qualifiedReviewers.length; j++) {
                if (!used[j]) {
                    currentWeight += scores[j];
                    if (currentWeight > randomWeight) {
                        used[j] = true;
                        selectedReviewers[i] = qualifiedReviewers[j];
                        break;
                    }
                }
            }
        }
        
        return selectedReviewers;
    }
    
    /**
     * @dev 铸造代币（仅管理员）
     * @param _to 接收者地址
     * @param _amount 代币数量
     */
    function mint(address _to, uint256 _amount) external onlyRole(ADMIN_ROLE) {
        _mint(_to, _amount);
    }
    
    /**
     * @dev 重写supportsInterface函数以处理多重继承
     * @param interfaceId 接口ID
     * @return 是否支持该接口
     */
    function supportsInterface(bytes4 interfaceId) public view virtual override(AccessControlEnumerable) returns (bool) {
        return AccessControlEnumerable.supportsInterface(interfaceId);
    }
}