const { expect } = require('chai');
const { ethers } = require('hardhat');

describe('ResearchDataNFT', function () {
  let researchData;
  let owner;
  let user1;
  let user2;
  let user3;
  
  // 测试数据
  const ipfsHash = 'QmXoypizjW3WknFiJnKLwHCnL72vedxjQkDDP1mXWo6uco';
  const metadataURI = 'https://example.com/metadata/1';
  const price = ethers.parseEther('0.1'); // 0.1 ETH
  
  // AccessLevel 枚举值
  const AccessLevel = {
    NONE: 0,
    READ: 1,
    WRITE: 2
  };

  beforeEach(async function () {
    // 获取测试账户
    [owner, user1, user2, user3] = await ethers.getSigners();
    
    // 部署合约
    const ResearchDataNFT = await ethers.getContractFactory('ResearchDataNFT');
    researchData = await ResearchDataNFT.deploy();
    await researchData.waitForDeployment();
  });

  describe('基本功能', function () {
    it('应该正确初始化合约', async function () {
      expect(await researchData.name()).to.equal('ResearchData');
      expect(await researchData.symbol()).to.equal('RDT');
      expect(await researchData.owner()).to.equal(owner.address);
    });
  });

  describe('创建数据项', function () {
    it('应该能够创建公开数据项', async function () {
      // 创建公开数据项
      await researchData.createDataItem(ipfsHash, price, true, metadataURI);
      
      // 验证数据项创建成功
      const dataItem = await researchData.dataItems(0);
      expect(dataItem.owner).to.equal(owner.address);
      expect(dataItem.ipfsHash).to.equal(ipfsHash);
      expect(dataItem.price).to.equal(price);
      expect(dataItem.isPublic).to.equal(true);
      expect(dataItem.totalEarned).to.equal(0);
      expect(dataItem.metadataURI).to.equal(metadataURI);
      expect(dataItem.isFrozen).to.equal(false);
      
      // 验证NFT铸造成功
      expect(await researchData.ownerOf(0)).to.equal(owner.address);
    });

    it('应该能够创建私有数据项', async function () {
      // 创建私有数据项
      await researchData.createDataItem(ipfsHash, price, false, metadataURI);
      
      // 验证数据项创建成功
      const dataItem = await researchData.dataItems(0);
      expect(dataItem.isPublic).to.equal(false);
    });
    
    it('应该能够由非所有者创建数据项', async function () {
      // 使用user1创建数据项
      await researchData.connect(user1).createDataItem(ipfsHash, price, true, metadataURI);
      
      // 验证数据项创建成功
      const dataItem = await researchData.dataItems(0);
      expect(dataItem.owner).to.equal(user1.address);
    });
  });

  describe('请求访问', function () {
    beforeEach(async function () {
      // 创建一个公开数据项和一个私有数据项
      await researchData.createDataItem(ipfsHash, price, true, metadataURI); // tokenId 0 - 公开
      await researchData.createDataItem(ipfsHash, price, false, metadataURI); // tokenId 1 - 私有
    });
    
    it('应该允许任何人访问公开数据项', async function () {
      // user2尝试访问公开数据项
      await expect(researchData.connect(user2).requestAccess(0))
        .to.not.be.reverted;
    });
    
    it('应该拒绝未授权用户访问私有数据项', async function () {
      // user2尝试访问私有数据项
      await expect(researchData.connect(user2).requestAccess(1))
        .to.be.revertedWith('Not authorized');
    });
    
    it('应该允许所有者访问私有数据项', async function () {
      // 所有者访问私有数据项
      await expect(researchData.requestAccess(1))
        .to.not.be.reverted;
    });
    
    it('应该允许授权用户访问私有数据项', async function () {
      // 授予user2读取权限
      await researchData.grantAccess(1, user2.address, AccessLevel.READ);
      
      // user2尝试访问私有数据项
      await expect(researchData.connect(user2).requestAccess(1))
        .to.not.be.reverted;
    });
    
    it('应该在付费访问时转移资金并更新收入', async function () {
      // 获取初始余额
      const initialOwnerBalance = await ethers.provider.getBalance(owner.address);
      
      // user3付费访问私有数据项
      await researchData.grantAccess(1, user3.address, AccessLevel.READ);
      await researchData.connect(user3).requestAccess(1, { value: price });
      
      // 验证资金转移
      const finalOwnerBalance = await ethers.provider.getBalance(owner.address);
      expect(finalOwnerBalance - initialOwnerBalance).to.be.closeTo(
        price, // 期望值
        ethers.parseEther('0.001') // 允许的误差
      );
      
      // 验证收入更新
      const dataItem = await researchData.dataItems(1);
      expect(dataItem.totalEarned).to.equal(price);
    });
    
    it('应该拒绝支付不足的访问请求', async function () {
      // 授予user3读取权限
      await researchData.grantAccess(1, user3.address, AccessLevel.READ);
      
      // user3尝试以低于要求的价格访问
      const lowPrice = ethers.parseEther('0.05');
      await expect(researchData.connect(user3).requestAccess(1, { value: lowPrice }))
        .to.be.revertedWith('Insufficient payment');
    });
  });

  describe('更新数据', function () {
    const newIpfsHash = 'QmNewHash';
    const newMetadataURI = 'https://example.com/metadata/updated';
    
    beforeEach(async function () {
      // 创建数据项
      await researchData.createDataItem(ipfsHash, price, true, metadataURI);
    });
    
    it('应该允许所有者更新数据', async function () {
      // 所有者更新数据
      await researchData.updateDataItem(0, newIpfsHash, newMetadataURI);
      
      // 验证数据已更新
      const dataItem = await researchData.dataItems(0);
      expect(dataItem.ipfsHash).to.equal(newIpfsHash);
      expect(dataItem.metadataURI).to.equal(newMetadataURI);
    });
    
    it('应该拒绝非所有者更新数据', async function () {
      // user1尝试更新数据
      await expect(researchData.connect(user1).updateDataItem(0, newIpfsHash, newMetadataURI))
        .to.be.revertedWith('Not authorized');
    });
    
    it('应该拒绝更新已冻结的数据', async function () {
      // 冻结数据
      await researchData.freezeData(0, true);
      
      // 尝试更新冻结的数据
      await expect(researchData.updateDataItem(0, newIpfsHash, newMetadataURI))
        .to.be.revertedWith('Data is frozen');
    });
    
    it('应该正确记录数据版本历史', async function () {
      // 更新数据
      await researchData.updateDataItem(0, newIpfsHash, newMetadataURI);
      
      // 获取版本历史
      const versions = await researchData.getDataVersions(0);
      
      // 验证版本历史
      expect(versions.length).to.equal(2);
      expect(versions[0].ipfsHash).to.equal(ipfsHash);
      expect(versions[1].ipfsHash).to.equal(newIpfsHash);
    });
  });

  describe('冻结数据', function () {
    beforeEach(async function () {
      // 创建数据项
      await researchData.createDataItem(ipfsHash, price, true, metadataURI);
    });
    
    it('应该允许所有者冻结和解冻数据', async function () {
      // 冻结数据
      await researchData.freezeData(0, true);
      
      // 验证数据已冻结
      let dataItem = await researchData.dataItems(0);
      expect(dataItem.isFrozen).to.equal(true);
      
      // 解冻数据
      await researchData.freezeData(0, false);
      
      // 验证数据已解冻
      dataItem = await researchData.dataItems(0);
      expect(dataItem.isFrozen).to.equal(false);
    });
    
    it('应该拒绝非所有者冻结数据', async function () {
      // user1尝试冻结数据
      await expect(researchData.connect(user1).freezeData(0, true))
        .to.be.revertedWith('Not authorized');
    });
  });

  describe('权限管理', function () {
    beforeEach(async function () {
      // 创建数据项
      await researchData.createDataItem(ipfsHash, price, false, metadataURI);
    });
    
    it('应该允许所有者授予和撤销访问权限', async function () {
      // 授予user1读取权限
      await researchData.grantAccess(0, user1.address, AccessLevel.READ);
      
      // 验证权限已授予
      let accessLevel = await researchData.checkAccessLevel(0, user1.address);
      expect(accessLevel).to.equal(AccessLevel.READ);
      
      // 撤销权限
      await researchData.grantAccess(0, user1.address, AccessLevel.NONE);
      
      // 验证权限已撤销
      accessLevel = await researchData.checkAccessLevel(0, user1.address);
      expect(accessLevel).to.equal(AccessLevel.NONE);
    });
    
    it('应该拒绝非所有者授予访问权限', async function () {
      // user2尝试授予user3权限
      await expect(researchData.connect(user2).grantAccess(0, user3.address, AccessLevel.READ))
        .to.be.revertedWith('Not owner');
    });
    
    it('应该正确维护授权用户列表', async function () {
      // 授予多个用户权限
      await researchData.grantAccess(0, user1.address, AccessLevel.READ);
      await researchData.grantAccess(0, user2.address, AccessLevel.WRITE);
      
      // 获取授权用户列表
      const authorizedUsers = await researchData.getAuthorizedUsers(0);
      
      // 验证列表包含授权用户
      expect(authorizedUsers).to.include(user1.address);
      expect(authorizedUsers).to.include(user2.address);
      expect(authorizedUsers.length).to.equal(2);
      
      // 撤销user1的权限
      await researchData.grantAccess(0, user1.address, AccessLevel.NONE);
      
      // 验证列表已更新
      const updatedUsers = await researchData.getAuthorizedUsers(0);
      expect(updatedUsers).to.not.include(user1.address);
      expect(updatedUsers).to.include(user2.address);
      expect(updatedUsers.length).to.equal(1);
    });
  });
});