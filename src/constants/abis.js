/**
 * @typedef {Object} ChainConfig
 * @property {number} CHAIN_ID - ID della chain
 * @property {string} RPC_URL - URL del nodo RPC
 * @property {string} PROOF_OF_INTEGRITY_ADDRESS - Indirizzo del contratto ProofOfIntegrity
 * @property {string} STEALTH_ANNOUNCER_ADDRESS - Indirizzo del contratto StealthAnnouncer
 * @property {string} BUBBLE_REGISTRY_ADDRESS - Indirizzo del contratto BubbleRegistry
 */

import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const require = createRequire(import.meta.url);

// Percorsi relativi agli artifacts
const artifactsPath = join(__dirname, '../../artifacts/contracts');

// Importa gli ABI dagli artifacts
const StealthAnnouncer = require(join(artifactsPath, 'StealthAnnouncer.sol/StealthAnnouncer.json'));
const BubbleRegistry = require(join(artifactsPath, 'BubbleRegistry.sol/BubbleRegistry.json'));
const ProofOfIntegrity = require(join(artifactsPath, 'ProofOfIntegrity.sol/ProofOfIntegrity.json'));

// Esporta gli ABI dai file JSON
export const STEALTH_ANNOUNCER_ABI = StealthAnnouncer.abi;
export const BUBBLE_REGISTRY_ABI = BubbleRegistry.abi;
export const PROOF_OF_INTEGRITY_ABI = ProofOfIntegrity.abi;

// Configurazioni per diverse chain
const chainConfigs = {
  localhost: {
    CHAIN_ID: 31337,
    RPC_URL: "http://127.0.0.1:8545",
    PROOF_OF_INTEGRITY_ADDRESS: "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512",
    STEALTH_ANNOUNCER_ADDRESS: "0x5FbDB2315678afecb367f032d93F642f64180aa3",
    BUBBLE_REGISTRY_ADDRESS: "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0"
  },
  polygon:{
    CHAIN_ID: 137,
    RPC_URL: "https://polygon-mainnet.g.alchemy.com/v2/yjhjIoJ3o_at8ALT7nCJtFtjdqFpiBdx",
    PROOF_OF_INTEGRITY_ADDRESS: "0x8515fa00a00A5483a3485526c7aD1f44E2779321",
    STEALTH_ANNOUNCER_ADDRESS: "0xD0CDbD17E4f2DDCE27B51721095048302768434f",
    BUBBLE_REGISTRY_ADDRESS: "0xc70DC231B9690D9dA988f6D4E518356eE9e45cd9"
  }
};

/** @type {boolean} */
export const isLocalEnvironment = process.env.NODE_ENV === 'development';

/**
 * Ottiene le configurazioni degli indirizzi per una specifica chain
 * @param {string} [chain='localhost'] - Nome della chain
 * @returns {ChainConfig} Configurazione degli indirizzi per la chain specificata
 * @throws {Error} Se la configurazione della chain non viene trovata
 */
export function getAddressesForChain(chain = 'localhost') {
  const config = chainConfigs[chain];
  if (!config) {
    throw new Error(`Chain configuration not found for: ${chain}`);
  }
  return config;
}

// Esporta gli indirizzi di default (localhost)
export const {
  PROOF_OF_INTEGRITY_ADDRESS,
  STEALTH_ANNOUNCER_ADDRESS,
  BUBBLE_REGISTRY_ADDRESS
} = getAddressesForChain('localhost');
