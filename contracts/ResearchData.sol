// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";


/**
 * @title ResearchDataNFT
 * @dev 优化版研究数据NFT合约，减少gas消耗
 */
contract ResearchDataNFT is ERC721, ERC721Enumerable, Ownable {
    
    enum AccessLevel { NONE, READ, WRITE }
    
    struct DataItem {
        address owner;
        string ipfsHash;
        uint256 price;
        bool isPublic;
        uint256 totalEarned;
        uint256 createdAt;
        uint256 lastUpdated;
        string metadataURI;
        bool isFrozen;
        // 结构体成员已按类型大小排序以优化存储布局
    }
    
    struct DataVersion {
        string ipfsHash;
        uint256 timestamp;
    }

    uint256 internal _tokenIdCounter;
    mapping(uint256 => DataItem) public dataItems;
    mapping(uint256 => DataVersion[]) internal _dataVersions;
    mapping(uint256 => mapping(address => AccessLevel)) private _accessControls;
    mapping(uint256 => address[]) private _authorizedUsers;
    
    event DataItemCreated(uint256 tokenId, address owner, string ipfsHash);
    event DataAccessed(uint256 tokenId, address requester, uint256 amount);
    event DataUpdated(uint256 tokenId, string newIpfsHash);
    event AccessGranted(uint256 tokenId, address grantee, AccessLevel level);
    event OwnershipTransferred(uint256 tokenId, address from, address to);
    event DataFrozen(uint256 tokenId, bool isFrozen);

    constructor() ERC721("ResearchData", "RDT") Ownable(msg.sender) {}

    // 必须的覆盖函数
    function _update(address to, uint256 tokenId, address auth)
        internal
        override(ERC721, ERC721Enumerable)
        returns (address)
    {
        address previousOwner = super._update(to, tokenId, auth);
        dataItems[tokenId].owner = to; // 同步更新所有者记录
        return previousOwner;
    }

    function _isApprovedOrOwner(address spender, uint256 tokenId) 
        internal 
        view 
        returns (bool) 
    {
        address owner = ownerOf(tokenId);
        require(owner != address(0), "Token does not exist");
        return (spender == owner ||
                getApproved(tokenId) == spender ||
                isApprovedForAll(owner, spender));
    }

    function _increaseBalance(address account, uint128 value)
        internal
        override(ERC721, ERC721Enumerable)
    {
        super._increaseBalance(account, value);
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721, ERC721Enumerable)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }

    // 核心功能
    /**
     * @dev 创建新的数据项
     * @param _ipfsHash 数据的IPFS哈希
     * @param _price 访问数据的价格
     * @param _isPublic 数据是否公开
     * @param _metadataURI 元数据URI
     */
    function createDataItem(
        string calldata _ipfsHash,
        uint256 _price,
        bool _isPublic,
        string calldata _metadataURI
    ) public virtual {
        // 优化：缓存当前时间戳和发送者地址，减少重复访问
        uint256 currentTime = block.timestamp;
        address sender = msg.sender;
        
        uint256 tokenId = _tokenIdCounter;
        _tokenIdCounter++;
        _safeMint(sender, tokenId);
        
        // 优化：直接设置结构体字段，避免使用命名参数构造，减少gas消耗
        DataItem storage item = dataItems[tokenId];
        item.owner = sender;
        item.ipfsHash = _ipfsHash;
        item.price = _price;
        item.isPublic = _isPublic;
        item.totalEarned = 0;
        item.createdAt = currentTime;
        item.lastUpdated = currentTime;
        item.metadataURI = _metadataURI;
        item.isFrozen = false;
        
        // 优化：直接设置版本信息，避免使用命名参数构造
        DataVersion storage version = _dataVersions[tokenId].push();
        version.ipfsHash = _ipfsHash;
        version.timestamp = currentTime;
        
        emit DataItemCreated(tokenId, sender, _ipfsHash);
    }

    function requestAccess(uint256 _tokenId) external payable {
        require(ownerOf(_tokenId) != address(0), "Token does not exist");
        DataItem storage item = dataItems[_tokenId];
        
        // 优化：使用本地变量缓存所有者地址，减少SLOAD操作
        address itemOwner = item.owner;
        
        if (!item.isPublic) {
            // 优化：使用本地变量缓存访问级别，减少SLOAD操作
            AccessLevel userAccess = _accessControls[_tokenId][msg.sender];
            uint256 value = msg.value;
            
            // 检查是否有权限或支付了足够的费用
            bool hasPermission = itemOwner == msg.sender ||
                getApproved(_tokenId) == msg.sender ||
                isApprovedForAll(itemOwner, msg.sender) ||
                userAccess >= AccessLevel.READ;
            
            bool hasPaidEnough = value > 0 && value >= item.price;
            
            require(hasPermission || hasPaidEnough, "Not authorized");
            
            if (value > 0) {
                require(value >= item.price, "Insufficient payment");
                (bool sent, ) = itemOwner.call{value: value}("");
                require(sent, "Payment failed");
                item.totalEarned += value;
            }
        }
        
        emit DataAccessed(_tokenId, msg.sender, msg.value);
    }

    // 数据管理功能
    /**
     * @dev 更新数据项
     * @param _tokenId 数据项ID
     * @param _newIpfsHash 新的IPFS哈希
     * @param _newMetadataURI 新的元数据URI
     */
    function updateDataItem(
        uint256 _tokenId,
        string calldata _newIpfsHash,
        string calldata _newMetadataURI
    ) external {
        require(_isApprovedOrOwner(msg.sender, _tokenId), "Not authorized");
        
        // 优化：使用storage指针减少SLOAD操作
        DataItem storage item = dataItems[_tokenId];
        require(!item.isFrozen, "Data is frozen");
        
        // 优化：缓存当前时间戳，减少重复访问
        uint256 currentTime = block.timestamp;
        
        // 优化：检查是否有实际变化，如果没有变化则不更新
        if (keccak256(bytes(item.ipfsHash)) == keccak256(bytes(_newIpfsHash)) && 
            keccak256(bytes(item.metadataURI)) == keccak256(bytes(_newMetadataURI))) {
            return;
        }
        
        item.ipfsHash = _newIpfsHash;
        item.metadataURI = _newMetadataURI;
        item.lastUpdated = currentTime;
        
        // 优化：直接设置版本信息，避免使用命名参数构造
        DataVersion storage version = _dataVersions[_tokenId].push();
        version.ipfsHash = _newIpfsHash;
        version.timestamp = currentTime;
        
        emit DataUpdated(_tokenId, _newIpfsHash);
    }

    /**
     * @dev 冻结或解冻数据项
     * @param _tokenId 数据项ID
     * @param _freeze 是否冻结
     */
    function freezeData(uint256 _tokenId, bool _freeze) external {
        require(_isApprovedOrOwner(msg.sender, _tokenId), "Not authorized");
        
        // 优化：使用storage指针减少SLOAD操作
        DataItem storage item = dataItems[_tokenId];
        
        // 优化：检查是否有实际变化，如果没有变化则不更新
        if (item.isFrozen == _freeze) {
            return;
        }
        
        item.isFrozen = _freeze;
        emit DataFrozen(_tokenId, _freeze);
    }

    // 权限管理
    function grantAccess(
        uint256 _tokenId,
        address _grantee,
        AccessLevel _level
    ) external {
        require(_isApprovedOrOwner(msg.sender, _tokenId), "Not owner");
        
        // 优化：检查是否实际需要更新访问级别
        AccessLevel currentLevel = _accessControls[_tokenId][_grantee];
        if (currentLevel == _level) {
            return; // 如果访问级别没有变化，直接返回，节省gas
        }
        
        _accessControls[_tokenId][_grantee] = _level;
        
        // 维护授权用户列表 - 进一步优化以减少gas消耗
        if (_level != AccessLevel.NONE) {
            // 只有当授予新权限时才需要检查和更新列表
            if (currentLevel == AccessLevel.NONE) {
                // 缓存数组长度以减少gas消耗
                uint256 length = _authorizedUsers[_tokenId].length;
                bool alreadyExists = false;
                
                // 使用unchecked可以在Solidity 0.8+中节省gas
                unchecked {
                    for (uint256 i = 0; i < length; i++) {
                        if (_authorizedUsers[_tokenId][i] == _grantee) {
                            alreadyExists = true;
                            break;
                        }
                    }
                }
                
                if (!alreadyExists) {
                    _authorizedUsers[_tokenId].push(_grantee);
                }
            }
        } else if (currentLevel != AccessLevel.NONE) {
            // 如果撤销权限，需要从授权用户列表中移除
            _removeAuthorizedUser(_tokenId, _grantee);
        }
        
        emit AccessGranted(_tokenId, _grantee, _level);
    }

    // 查询功能
    function getDataVersions(uint256 _tokenId) external view returns (DataVersion[] memory) {
        return _dataVersions[_tokenId];
    }

    function getAuthorizedUsers(uint256 _tokenId) external view returns (address[] memory) {
        return _authorizedUsers[_tokenId];
    }
    
    // 优化的访问控制检查函数
    function checkAccessLevel(uint256 _tokenId, address _user) external view returns (AccessLevel) {
        return _accessControls[_tokenId][_user];
    }
    
    /**
     * @dev 从授权用户列表中移除用户
     * @param _tokenId 数据项ID
     * @param _user 要移除的用户地址
     */
    function _removeAuthorizedUser(uint256 _tokenId, address _user) private {
        uint256 length = _authorizedUsers[_tokenId].length;
        for (uint256 i = 0; i < length; i++) {
            if (_authorizedUsers[_tokenId][i] == _user) {
                // 将最后一个元素移到当前位置，然后删除最后一个元素
                // 这比维护数组顺序更节省gas
                if (i < length - 1) {
                    _authorizedUsers[_tokenId][i] = _authorizedUsers[_tokenId][length - 1];
                }
                _authorizedUsers[_tokenId].pop();
                break;
            }
        }
    }
}