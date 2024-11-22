import { LOCAL_CONFIG } from '../config/local.js';

// Indirizzi di produzione per diverse chain
export const CHAIN_CONFIG = {
  optimismSepolia: {
    STEALTH_ANNOUNCER_ADDRESS: "0xD0F2e9DA59d2DFECFdE67CcF17300BB6093A72f8",
    PROOF_OF_INTEGRITY_ADDRESS: "0x...",
    RPC_URL: "https://sepolia.optimism.io",
    CHAIN_ID: 11155420
  },
  arbitrumSepolia: {
    STEALTH_ANNOUNCER_ADDRESS: "0x...",
    PROOF_OF_INTEGRITY_ADDRESS: "0x...",
    RPC_URL: "https://sepolia-rollup.arbitrum.io/rpc",
    CHAIN_ID: 421614
  },
  localhost: {
    RPC_URL: "http://127.0.0.1:8545",
    CHAIN_ID: 1337
  }
};

// Funzione per ottenere gli indirizzi corretti
export function getAddressesForChain(chainName) {
  let config;

  // Se è localhost, prova a caricare gli indirizzi locali
  if (chainName === 'localhost') {
    try {
      // Carica gli indirizzi dal file generato dal deploy locale
      const localAddresses = require('../config/contract-address.json');
      config = {
        ...CHAIN_CONFIG.localhost,
        ...localAddresses
      };
      console.log("Using local addresses:", config);
      return config;
    } catch (err) {
      console.warn('No local addresses found');
      throw new Error('No local addresses found. Did you run local deployment?');
    }
  }

  // Altrimenti usa gli indirizzi di produzione
  config = CHAIN_CONFIG[chainName];
  if (!config) {
    throw new Error(`Chain ${chainName} not supported. Supported chains: ${Object.keys(CHAIN_CONFIG).join(', ')}`);
  }

  return config;
}

// Funzione helper per verificare se siamo in ambiente locale
export function isLocalEnvironment() {
  return process.env.NODE_ENV === 'development' && 
         typeof window !== 'undefined' && 
         window.location.hostname === 'localhost';
}

export const STEALTH_ANNOUNCER_ABI = [
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "_devAddress",
        "type": "address"
      }
    ],
    "stateMutability": "nonpayable",
    "type": "constructor"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "internalType": "string",
        "name": "senderPublicKey",
        "type": "string"
      },
      {
        "internalType": "string",
        "name": "spendingPublicKey",
        "type": "string"
      },
      {
        "internalType": "address",
        "name": "stealthAddress",
        "type": "address"
      },
      {
        "internalType": "uint256",
        "name": "timestamp",
        "type": "uint256"
      }
    ],
    "name": "StealthPaymentAnnounced",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "internalType": "address",
        "name": "newAddress",
        "type": "address"
      }
    ],
    "name": "DevAddressUpdated",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "internalType": "uint256",
        "name": "newFee",
        "type": "uint256"
      }
    ],
    "name": "DevFeeUpdated",
    "type": "event"
  },
  {
    "inputs": [
      {
        "internalType": "string",
        "name": "senderPublicKey",
        "type": "string"
      },
      {
        "internalType": "string",
        "name": "spendingPublicKey",
        "type": "string"
      },
      {
        "internalType": "address",
        "name": "stealthAddress",
        "type": "address"
      }
    ],
    "name": "announcePayment",
    "outputs": [],
    "stateMutability": "payable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "devAddress",
    "outputs": [
      {
        "internalType": "address",
        "name": "",
        "type": "address"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "devFee",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "getAnnouncementsCount",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "fromIndex",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "toIndex",
        "type": "uint256"
      }
    ],
    "name": "getAnnouncementsInRange",
    "outputs": [
      {
        "components": [
          {
            "internalType": "string",
            "name": "senderPublicKey",
            "type": "string"
          },
          {
            "internalType": "string",
            "name": "spendingPublicKey",
            "type": "string"
          },
          {
            "internalType": "address",
            "name": "stealthAddress",
            "type": "address"
          },
          {
            "internalType": "uint256",
            "name": "timestamp",
            "type": "uint256"
          }
        ],
        "internalType": "struct StealthAnnouncer.StealthAnnouncement[]",
        "name": "",
        "type": "tuple[]"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "_newFee",
        "type": "uint256"
      }
    ],
    "name": "updateDevFee",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "_newAddress",
        "type": "address"
      }
    ],
    "name": "updateDevAddress",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "withdrawStuckETH",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  }
];

export const PROOF_OF_INTEGRITY_ABI = [
  {
    "inputs": [
      {
        "internalType": "bytes[]",
        "name": "nodeIds",
        "type": "bytes[]"
      },
      {
        "internalType": "bytes32[]",
        "name": "contentHashes",
        "type": "bytes32[]"
      }
    ],
    "name": "batchUpdateData",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "bytes",
        "name": "nodeId",
        "type": "bytes"
      },
      {
        "indexed": false,
        "internalType": "bytes32",
        "name": "contentHash",
        "type": "bytes32"
      },
      {
        "indexed": false,
        "internalType": "address",
        "name": "updater",
        "type": "address"
      }
    ],
    "name": "DataUpdated",
    "type": "event"
  },
  {
    "inputs": [
      {
        "internalType": "bytes",
        "name": "nodeId",
        "type": "bytes"
      }
    ],
    "name": "getLatestRecord",
    "outputs": [
      {
        "internalType": "bytes32",
        "name": "",
        "type": "bytes32"
      },
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      },
      {
        "internalType": "address",
        "name": "",
        "type": "address"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "bytes",
        "name": "nodeId",
        "type": "bytes"
      },
      {
        "internalType": "bytes32",
        "name": "contentHash",
        "type": "bytes32"
      }
    ],
    "name": "updateData",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "bytes",
        "name": "nodeId",
        "type": "bytes"
      },
      {
        "internalType": "bytes32",
        "name": "contentHash",
        "type": "bytes32"
      }
    ],
    "name": "verifyData",
    "outputs": [
      {
        "internalType": "bool",
        "name": "",
        "type": "bool"
      },
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      },
      {
        "internalType": "address",
        "name": "",
        "type": "address"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  }
];


export const SHINE_OPTIMISM_SEPOLIA = "0x43D838b683F772F08f321E5FA265ad3e333BE9C2";
