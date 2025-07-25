require('@nomicfoundation/hardhat-toolbox');
require('dotenv').config();

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: '0.8.28',
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      },
      viaIR: true
    }
  },
  networks: {
    inj_testnet: {
      url: process.env.INJ_TESTNET_RPC_URL || 'https://k8s.testnet.json-rpc.injective.network/',
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      chainId: 1439,
      gas: 8000000,
      gasPrice: 160000000000,
      maxFeePerGas: 200000000000,
      maxPriorityFeePerGas: 40000000000
    },
  },
  etherscan: {
    apiKey: {
      inj_testnet: 'nil',
    },
    customChains: [
      {
        network: 'inj_testnet',
        chainId: 1439,
        urls: {
          apiURL: 'https://testnet.blockscout-api.injective.network/api',
          browserURL: 'https://testnet.blockscout.injective.network/',
        },
      },
    ],
  },
  sourcify: {
    enabled: false,
  },
};
