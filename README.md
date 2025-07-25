# 链上学术评价体系 (Academic Evaluation System on Blockchain)

基于 Injective EVM 的去中心化学术论文评审与发表系统。

## 项目概述

本项目构建了一个完整的链上学术评价体系，包括论文NFT、期刊管理、同行评议、审稿人DAO治理等核心功能。通过区块链技术确保学术评审过程的透明性、公正性和不可篡改性。

## 核心功能

- 📄 **论文NFT化**: 将学术论文铸造为NFT，确保版权和所有权
- 🏛️ **期刊管理**: 去中心化的期刊创建和管理系统
- 👥 **同行评议**: 透明的审稿流程和评议记录
- 🏆 **审稿人DAO**: 基于代币的审稿人治理和激励机制
- 💰 **奖励机制**: 根据审稿质量和及时性分配代币奖励
- 📊 **声誉系统**: 基于历史表现的审稿人等级和声誉评分

## 合约架构

### 核心合约

1. **PaperNFT.sol** - 论文NFT合约
   - 论文元数据存储
   - 版权管理
   - 转移和授权

2. **ResearchDataNFT.sol** - 研究数据NFT合约
   - 研究数据资产化
   - 数据共享和授权

3. **JournalManager.sol** - 期刊管理合约
   - 期刊创建和配置
   - 编辑权限管理
   - 发表流程控制

4. **ReviewProcess.sol** - 评审流程合约
   - 投稿管理
   - 审稿人分配
   - 评审意见收集
   - 状态跟踪

5. **ReviewerDAO.sol** - 审稿人DAO合约
   - 审稿人注册和管理
   - 代币经济模型
   - 治理提案系统
   - 奖励分配机制

### 合约关系图

```
┌─────────────────┐    ┌─────────────────┐
│   PaperNFT      │    │ ResearchDataNFT │
└─────────────────┘    └─────────────────┘
         │                       │
         └───────────┬───────────┘
                     │
         ┌─────────────────┐
         │ ReviewProcess   │
         └─────────────────┘
                     │
    ┌────────────────┼────────────────┐
    │                │                │
┌─────────────────┐  │  ┌─────────────────┐
│ JournalManager  │──┘  │  ReviewerDAO    │
└─────────────────┘     └─────────────────┘
```

## 技术栈

- **区块链**: Injective Protocol (EVM兼容)
- **智能合约**: Solidity ^0.8.28
- **开发框架**: Hardhat
- **标准**: ERC721 (NFT), ERC20 (代币), AccessControl
- **测试网络**: Injective Testnet

## 快速开始

### 环境要求

- Node.js >= 16.0.0
- npm 或 pnpm
- Git

### 安装依赖

```bash
# 克隆项目
git clone <repository-url>
cd hardhat-inj

# 安装依赖
pnpm install
```

### 环境配置

创建 `.env` 文件：

```env
PRIVATE_KEY=your_private_key_here
INJ_TESTNET_RPC_URL=https://k8s.testnet.json-rpc.injective.network/
```

### 编译合约

```bash
npx hardhat compile
```

### 运行测试

```bash
# 运行所有测试
npx hardhat test

# 运行主要集成测试
npx hardhat test test/AcademicSystem.test.js

# 运行特定合约测试
npx hardhat test test/ReviewerDAO.test.js
```

## 部署指南

### 本地测试网部署

```bash
# 启动本地节点
npx hardhat node

# 部署到本地网络
npx hardhat run script/deploy-academic-system.js --network localhost
```

### Injective测试网部署

#### 准备工作

1. **获取测试代币**
   访问 [Injective Testnet Faucet](https://testnet.faucet.injective.network/) 获取测试INJ代币

2. **配置环境变量**
   ```bash
   cp .env.example .env
   # 编辑 .env 文件，添加你的私钥
   ```

#### 部署命令

```bash
# 增量部署（推荐，节约gas费）
npx hardhat run script/deploy-inj-testnet.js --network inj_testnet

# 验证部署状态
npx hardhat run script/verify-deployment.js --network inj_testnet

# 完整重新部署（如需要）
npx hardhat run script/deploy-academic-system.js --network inj_testnet
```

### 增量部署特性

我们的增量部署脚本具有以下智能特性：

- **🔍 智能检测**: 自动检测已部署的合约，跳过重复部署
- **💾 状态持久化**: 部署状态保存到 `script/inj-testnet-deployments.json`
- **🔄 重试机制**: 网络拥堵时自动重试，使用指数退避策略
- **⛽ Gas优化**: 只部署必要的合约，节省Gas费用
- **🛡️ 错误恢复**: 部署失败时可以从中断点继续

### 部署脚本说明

- `deploy-inj-testnet.js` - 智能增量部署，跳过已部署合约，支持重试机制
- `verify-deployment.js` - 验证部署状态和合约功能
- `deploy-academic-system.js` - 完整系统部署
- `deploy-local.js` - 本地测试网部署

## 使用示例

### 功能脚本

```bash
# 运行完整的系统演示
npx hardhat run script/interact-academic-system.js --network localhost

# 创建测试数据
npx hardhat run script/write-test-data.js --network inj_testnet

# 查询测试数据
npx hardhat run script/query-test-data.js --network inj_testnet

# 期刊管理功能演示
npx hardhat run script/journal-management-simple.js --network inj_testnet
```

### 主要功能演示

1. **期刊管理**：创建期刊、设置投稿费用、管理编辑权限
2. **审稿人系统**：注册审稿人、等级管理、代币奖励
3. **论文NFT**：创建论文NFT、版权管理、引用关系
4. **研究数据NFT**：数据资产化、访问控制、收益分配
5. **评审流程**：投稿管理、审稿人分配、评审意见收集
6. **奖励机制**：基于质量和及时性的代币分配
7. **治理功能**：DAO提案、投票决策、参数调整

## 测试状态

✅ **所有测试通过** - 17个集成测试全部通过
- ReviewerDAO 功能测试
- 论文NFT 创建和引用功能
- 投稿和审稿流程
- 奖励分配机制
- 数据访问控制

## 部署状态

✅ **Injective Testnet 部署成功** - 所有合约已成功部署
- ✅ ReviewerDAO - 审稿人DAO治理合约
- ✅ JournalManager - 期刊管理合约
- ✅ ResearchDataNFT - 研究数据NFT合约
- ✅ PaperNFT - 论文NFT合约
- ✅ ReviewProcess - 评审流程合约

**验证状态**: 所有合约功能正常，可以进行下一步的系统配置和测试。

**快速验证命令**:
```bash
# 验证所有合约部署状态
npx hardhat run script/verify-deployment.js --network inj_testnet
```

## 已部署合约地址

### 本地测试网 (最新部署)

- **ResearchDataNFT**: `0x5FbDB2315678afecb367f032d93F642f64180aa3`
- **PaperNFT**: `0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512`
- **JournalManager**: `0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0`
- **ReviewerDAO**: `0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9`
- **ReviewProcess**: `0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9`

### Injective Testnet (最新部署 - 2025-07-25)

- **ReviewerDAO**: `0x7373064A3A00EBe5c91bD5Ba537253aA7eD7ded4`
- **JournalManager**: `0x670830D6ee36eE813131c80d5C147C5663322CF5`
- **ResearchDataNFT**: `0xaDdb7A35aA2212cD58a2ef0e4105D7B65Ce61D69`
- **PaperNFT**: `0x945BD6d2367367c7b503Cb739B11c5A5cd7e92DD`
- **ReviewProcess**: `0xB23dD3dA569f1A55e3eE2bC5d473b81aE1B23927`

**部署信息**:
- 网络: Injective Testnet
- 部署时间: 2025-07-25 09:43:43 UTC
- Gas消耗: 约 1.10 INJ
- 状态文件: `script/inj-testnet-deployments.json`

**区块浏览器链接**:
- [ReviewerDAO](https://testnet.explorer.injective.network/account/0x7373064A3A00EBe5c91bD5Ba537253aA7eD7ded4)
- [JournalManager](https://testnet.explorer.injective.network/account/0x670830D6ee36eE813131c80d5C147C5663322CF5)
- [ResearchDataNFT](https://testnet.explorer.injective.network/account/0xaDdb7A35aA2212cD58a2ef0e4105D7B65Ce61D69)
- [PaperNFT](https://testnet.explorer.injective.network/account/0x945BD6d2367367c7b503Cb739B11c5A5cd7e92DD)
- [ReviewProcess](https://testnet.explorer.injective.network/account/0xB23dD3dA569f1A55e3eE2bC5d473b81aE1B23927)

## 项目特色

### 🔒 安全性
- 基于OpenZeppelin标准库
- 完善的权限控制机制
- 防重入攻击保护

### 🚀 可扩展性
- 模块化合约设计
- 可升级的治理机制
- 灵活的奖励参数配置

### 💡 创新性
- 首个完整的链上学术评价系统
- 代币化的审稿人激励机制
- 透明的同行评议流程

### 🌍 去中心化
- 无需中心化机构控制
- 社区驱动的治理模式
- 全球化的学术合作平台

## 开发指南

### 项目结构

```
ReviewDAO_EVM/
├── contracts/                 # 智能合约源码
│   ├── JournalManager.sol    # 期刊管理合约
│   ├── ResearchData.sol      # 研究数据NFT合约
│   ├── ReviewProcess.sol     # 评审流程合约
│   ├── ReviewerDAO.sol       # 审稿人DAO合约
│   └── paperNFT.sol         # 论文NFT合约
├── script/                   # 部署和交互脚本
│   ├── deploy-academic-system.js     # 完整系统部署
│   ├── deploy-inj-testnet.js         # Injective测试网增量部署
│   ├── deploy-local.js               # 本地部署
│   ├── verify-deployment.js          # 部署验证
│   ├── interact-academic-system.js   # 系统交互演示
│   ├── write-test-data.js            # 创建测试数据
│   ├── query-test-data.js            # 查询测试数据
│   ├── journal-management-simple.js  # 期刊管理功能演示
│   └── inj-testnet-deployments.json  # 部署状态记录
├── test/                     # 测试文件
│   ├── AcademicSystem.test.js     # 主要集成测试
│   ├── JournalManager.test.js     # 期刊管理测试
│   ├── PaperNFT.test.js          # 论文NFT测试
│   ├── ResearchData.test.js      # 研究数据测试
│   ├── ReviewProcess.test.js     # 评审流程测试
│   └── ReviewerDAO.test.js       # 审稿人DAO测试
├── hardhat.config.js         # Hardhat配置
├── package.json             # 项目依赖
└── README.md               # 项目文档
```

### 脚本功能说明

| 脚本文件 | 功能描述 | 使用场景 |
|---------|---------|----------|
| `deploy-academic-system.js` | 完整系统部署 | 首次部署或完全重新部署 |
| `deploy-inj-testnet.js` | 增量部署到测试网 | 测试网部署，支持断点续传 |
| `deploy-local.js` | 本地测试网部署 | 本地开发和测试 |
| `verify-deployment.js` | 验证部署状态 | 检查合约部署是否成功 |
| `interact-academic-system.js` | 系统功能演示 | 完整流程演示和测试 |
| `write-test-data.js` | 创建测试数据 | 生成测试用的期刊、论文等数据 |
| `query-test-data.js` | 查询测试数据 | 验证数据创建和查询功能 |
| `journal-management-simple.js` | 期刊管理演示 | 期刊创建、编辑、配置等功能 |

### 开发工作流

1. **合约开发**：在 `contracts/` 目录下创建新合约
2. **测试编写**：在 `test/` 目录下编写对应测试用例
3. **部署脚本**：更新相关部署脚本
4. **功能验证**：编写交互脚本验证功能
5. **文档更新**：更新README和相关文档

### 代码规范

- **Solidity**：遵循最佳实践，使用NatSpec注释
- **JavaScript**：使用ES6+语法，保持代码简洁
- **测试**：确保100%测试覆盖率
- **文档**：及时更新README和代码注释

## 贡献指南

1. Fork 本项目
2. 创建功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 创建 Pull Request

## 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情。

## 联系方式

- 项目维护者: [chord233]
- 邮箱: [chord244@gmail.com]
- 项目链接: [https://github.com/ReviewDAO/ReviewDAO_EVM]

## 常见问题排查

### 部署问题

1. **Gas不足**：增加Gas限制，合约较复杂需要更多gas
2. **合约大小超限**：确保合约大小在24KB限制内
3. **网络连接**：检查与Injective测试网的连接状态
4. **余额不足**：确保部署账户有足够的测试币

### 功能问题

1. **查询失败**：确保合约地址正确，网络配置无误
2. **权限错误**：检查账户是否有相应的操作权限
3. **交易失败**：查看具体错误信息，检查参数是否正确

### 测试网络

- **获取测试币**：访问 [Injective Testnet Faucet](https://testnet.faucet.injective.network/)
- **区块浏览器**：[Injective Testnet Explorer](https://testnet.explorer.injective.network/)
- **RPC端点**：`https://k8s.testnet.json-rpc.injective.network/`

## 技术特点

### 🔒 安全性
- 基于OpenZeppelin标准库
- 完善的权限控制机制
- 防重入攻击保护

### ⚡ 性能优化
- 使用存储指针减少SLOAD操作
- 缓存频繁访问的变量
- 优化循环结构和数组操作
- 使用unchecked块减少gas消耗

### 🎯 功能完整
- 数据所有权管理（NFT）
- 访问控制和权限管理
- 版本管理和历史记录
- 收益分配和激励机制
- 数据冻结和保护机制

## 致谢

感谢 Injective Protocol 提供的优秀区块链基础设施，以及 OpenZeppelin 提供的安全智能合约库。

## 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情。
