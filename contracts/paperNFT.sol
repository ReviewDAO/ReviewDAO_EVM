// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./ResearchData.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

contract PaperNFT is ResearchDataNFT {
    
    // 新增数据结构
    struct Citation {
        address citer;
        uint256 amount;
        uint256 timestamp;
    }
    
    mapping(uint256 => Citation[]) public citations;
    mapping(uint256 => string) public paperDOIs;
    uint256 public baseCitationFee = 0.1 ether;

    event PaperCited(uint256 indexed paperId, address indexed citer, uint256 amount);
    event DOIUpdated(uint256 indexed paperId, string doi);

    // 论文专属创建逻辑
    function createPaperItem(
        string calldata _ipfsHash,
        string calldata _doi, // 新增DOI参数
        string calldata _metadataURI
    ) external {
        uint256 tokenId = _tokenIdCounter;
        
        // 调用父类创建方法
        super.createDataItem(_ipfsHash, 0, true, _metadataURI); // 论文默认开放访问
        
        // 论文特有属性
        paperDOIs[tokenId] = _doi;
        emit DOIUpdated(tokenId, _doi);
    }

    // 付费引用功能
    function citePaper(uint256 _paperId) external payable {
    require(ownerOf(_paperId) != address(0), "Paper not exist");  // ✅ 检查 NFT 是否存在
    require(msg.value >= baseCitationFee, "Insufficient fee");
    
    citations[_paperId].push(Citation({
        citer: msg.sender,
        amount: msg.value,
        timestamp: block.timestamp
    }));

    _distributeCitationFee(_paperId, msg.value);
    emit PaperCited(_paperId, msg.sender, msg.value);
}

    function _distributeCitationFee(uint256 _paperId, uint256 _amount) internal {
        address author = ownerOf(_paperId);
        uint256 daoShare = _amount * 5 / 100;
        
        payable(author).transfer(_amount - daoShare);
        payable(owner()).transfer(daoShare); // DAO金库
    }

    // 论文版本修正
    function submitCorrection(
        uint256 _originalPaperId,
        string memory _newIpfsHash
    ) external {
        require(_isApprovedOrOwner(msg.sender, _originalPaperId), "Not authorized");
        
        // 生成修正版本NFT（保留原论文关联）
        uint256 newTokenId = _tokenIdCounter;
        _tokenIdCounter++;
        _safeMint(msg.sender, newTokenId);
        
        dataItems[newTokenId] = DataItem({
            owner: msg.sender,
            ipfsHash: _newIpfsHash,
            price: 0,
            isPublic: true,
            totalEarned: 0,
            createdAt: block.timestamp,
            lastUpdated: block.timestamp,
            metadataURI: dataItems[_originalPaperId].metadataURI,
            isFrozen: false
        });
        
        // 标记修正关系
        paperDOIs[newTokenId] = string(abi.encodePacked(
            paperDOIs[_originalPaperId],
            "-v",
            Strings.toString(_dataVersions[_originalPaperId].length + 1)
        ));
    }
}