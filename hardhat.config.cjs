require("@nomicfoundation/hardhat-toolbox");
require("@nomicfoundation/hardhat-ethers");
require("@nomicfoundation/hardhat-verify");
require('dotenv').config();

// Se non impostata, usa la private key di default di hardhat
const deployerPrivateKey = process.env.PRIVATE_KEY || "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";

// API keys per i block explorer
const etherscanApiKey = process.env.ETHERSCAN_API_KEY || "DNXJA8RX2Q3VZ4URQIWP7Z68CJXQZSC6AW";
const polygonscanApiKey = process.env.POLYGONSCAN_API_KEY || etherscanApiKey;
const optimismApiKey = process.env.OPTIMISM_API_KEY || "RM62RDISS1RH448ZY379NX625ASG1N633R";
const arbitrumApiKey = process.env.ARBITRUM_API_KEY || etherscanApiKey;
const basescanApiKey = process.env.BASESCAN_API_KEY || "ZZZEIPMT1MNJ8526VV2Y744CA7TNZR64G6";

// Alchemy API key
const alchemyApiKey = process.env.ALCHEMY_API_KEY || "oKxs-03sij-U_N0iOlrSsZFr29-IqbuF";

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.19",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      }
    }
  },
  defaultNetwork: "localhost",
  namedAccounts: {
    deployer: {
      default: 0,
    },
  },
  networks: {
    hardhat: {
      chainId: 31337,
      forking: {
        url: `https://eth-mainnet.alchemyapi.io/v2/${alchemyApiKey}`,
        enabled: process.env.MAINNET_FORKING_ENABLED === "true",
      }
    },
    localhost: {
      url: "http://127.0.0.1:8545",
      chainId: 31337
    },
    mainnet: {
      url: `https://eth-mainnet.alchemyapi.io/v2/${alchemyApiKey}`,
      accounts: [deployerPrivateKey],
      chainId: 1
    },
    sepolia: {
      url: `https://eth-sepolia.g.alchemy.com/v2/${alchemyApiKey}`,
      accounts: [deployerPrivateKey],
      chainId: 11155111
    },
    polygon: {
      url: `https://polygon-mainnet.g.alchemy.com/v2/${alchemyApiKey}`,
      accounts: [deployerPrivateKey],
      chainId: 137
    },
    polygonMumbai: {
      url: `https://polygon-mumbai.g.alchemy.com/v2/${alchemyApiKey}`,
      accounts: [deployerPrivateKey],
      chainId: 80001
    },
    polygonZkEvm: {
      url: `https://polygonzkevm-mainnet.g.alchemy.com/v2/${alchemyApiKey}`,
      accounts: [deployerPrivateKey]
    },
    polygonZkEvmTestnet: {
      url: `https://polygonzkevm-testnet.g.alchemy.com/v2/${alchemyApiKey}`,
      accounts: [deployerPrivateKey]
    },
    optimism: {
      url: `https://opt-mainnet.g.alchemy.com/v2/${alchemyApiKey}`,
      accounts: [deployerPrivateKey],
      chainId: 10,
      verify: {
        etherscan: {
          apiUrl: "https://api-optimistic.etherscan.io",
          apiKey: optimismApiKey
        }
      }
    },
    optimismSepolia: {
      url: `https://opt-sepolia.g.alchemy.com/v2/${alchemyApiKey}`,
      accounts: [deployerPrivateKey],
      verify: {
        etherscan: {
          apiUrl: "https://api-sepolia-optimistic.etherscan.io",
          apiKey: optimismApiKey
        }
      }
    },
    arbitrum: {
      url: `https://arb-mainnet.g.alchemy.com/v2/${alchemyApiKey}`,
      accounts: [deployerPrivateKey],
      chainId: 42161
    },
    arbitrumSepolia: {
      url: `https://arb-sepolia.g.alchemy.com/v2/${alchemyApiKey}`,
      accounts: [deployerPrivateKey]
    },
    base: {
      url: "https://mainnet.base.org",
      accounts: [deployerPrivateKey],
      verify: {
        etherscan: {
          apiUrl: "https://api.basescan.org",
          apiKey: basescanApiKey
        }
      }
    },
    baseSepolia: {
      url: "https://sepolia.base.org",
      accounts: [deployerPrivateKey],
      verify: {
        etherscan: {
          apiUrl: "https://api-sepolia.basescan.org",
          apiKey: basescanApiKey
        }
      }
    },
    gnosis: {
      url: "https://rpc.gnosischain.com",
      accounts: [deployerPrivateKey]
    },
    chiado: {
      url: "https://rpc.chiadochain.net",
      accounts: [deployerPrivateKey]
    },
    scrollSepolia: {
      url: "https://sepolia-rpc.scroll.io",
      accounts: [deployerPrivateKey]
    },
    scroll: {
      url: "https://rpc.scroll.io",
      accounts: [deployerPrivateKey]
    },
    pgn: {
      url: "https://rpc.publicgoods.network",
      accounts: [deployerPrivateKey]
    },
    pgnTestnet: {
      url: "https://sepolia.publicgoods.network",
      accounts: [deployerPrivateKey]
    },
    celo: {
      url: "https://forno.celo.org",
      accounts: [deployerPrivateKey]
    },
    celoAlfajores: {
      url: "https://alfajores-forno.celo-testnet.org",
      accounts: [deployerPrivateKey]
    }
  },
  etherscan: {
    apiKey: {
      mainnet: etherscanApiKey,
      sepolia: etherscanApiKey,
      polygon: polygonscanApiKey,
      polygonMumbai: polygonscanApiKey,
      optimisticEthereum: optimismApiKey,
      optimisticSepolia: optimismApiKey,
      arbitrumOne: arbitrumApiKey,
      arbitrumSepolia: arbitrumApiKey,
      base: basescanApiKey,
      baseSepolia: basescanApiKey
    }
  },
  verify: {
    etherscan: {
      apiKey: {
        mainnet: etherscanApiKey,
        sepolia: etherscanApiKey,
        polygon: polygonscanApiKey,
        polygonMumbai: polygonscanApiKey,
        optimisticEthereum: optimismApiKey,
        optimisticSepolia: optimismApiKey,
        arbitrumOne: arbitrumApiKey,
        arbitrumSepolia: arbitrumApiKey,
        base: basescanApiKey,
        baseSepolia: basescanApiKey
      }
    }
  },
  sourcify: {
    enabled: false
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts"
  },
  mocha: {
    timeout: 40000
  }
}; 