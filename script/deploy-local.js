const { ethers } = require("hardhat");

async function main() {
  console.log("开始部署 ResearchDataNFT 合约到本地网络...");
  
  try {
    // 获取部署账户
    const [deployer] = await ethers.getSigners();
    console.log("部署账户:", deployer.address);
    console.log("账户余额:", ethers.formatEther(await deployer.provider.getBalance(deployer.address)), "ETH");
    
    // 获取合约工厂
    const ResearchDataNFT = await ethers.getContractFactory("ResearchDataNFT");
    
    // 部署合约
    const researchDataNFT = await ResearchDataNFT.deploy();
    
    // 等待部署完成
    await researchDataNFT.waitForDeployment();
    
    // 获取部署地址
    const deployedAddress = await researchDataNFT.getAddress();
    
    console.log("✅ ResearchDataNFT 部署成功!");
    console.log("📝 合约地址:", deployedAddress);
    
    // 创建一些示例数据
    console.log("创建示例数据...");
    
    // 创建一个公开数据项
    const tx1 = await researchDataNFT.createDataItem(
      "QmPublicHash",                      // IPFS哈希
      ethers.parseEther("0.1"),           // 价格: 0.1 ETH
      true,                               // 是否公开
      "https://example.com/metadata/1"    // 元数据URI
    );
    await tx1.wait();
    console.log("已创建公开数据项 (tokenId: 0)");
    
    // 创建一个私有数据项
    const tx2 = await researchDataNFT.createDataItem(
      "QmPrivateHash",                     // IPFS哈希
      ethers.parseEther("0.2"),           // 价格: 0.2 ETH
      false,                              // 是否公开
      "https://example.com/metadata/2"    // 元数据URI
    );
    await tx2.wait();
    console.log("已创建私有数据项 (tokenId: 1)");
    
    console.log("✅ 示例数据创建完成");
    console.log("💡 可以使用以下命令与合约交互:");
    console.log("npx hardhat console --network localhost");
    
    return deployedAddress;
  } catch (error) {
    console.error("❌ 部署失败:", error.message);
    throw error;
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });