/**
 * @typedef {Object} ChainConfig
 * @property {number} CHAIN_ID - ID della chain
 * @property {string} RPC_URL - URL del nodo RPC
 * @property {string} PROOF_OF_INTEGRITY_ADDRESS - Indirizzo del contratto ProofOfIntegrity
 * @property {string} STEALTH_ANNOUNCER_ADDRESS - Indirizzo del contratto StealthAnnouncer
 * @property {string} BUBBLE_REGISTRY_ADDRESS - Indirizzo del contratto BubbleRegistry
 */

import { ethers } from "ethers";
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
    PROOF_OF_INTEGRITY_ADDRESS: "0x5081a39b8A5f0E35a8D959395a630b68B74Dd30f",
    STEALTH_ANNOUNCER_ADDRESS: "0x922D6956C99E12DFeB3224DEA977D0939758A1Fe",
    BUBBLE_REGISTRY_ADDRESS: "0x1fA02b2d6A771842690194Cf62D91bdd92BfE28d"
  },
  optimismSepolia: {
    CHAIN_ID: 11155420,
    RPC_URL: "https://sepolia.optimism.io",
    PROOF_OF_INTEGRITY_ADDRESS: "0x...", // Indirizzo del contratto su Optimism Sepolia
    STEALTH_ANNOUNCER_ADDRESS: "0x...", // Indirizzo del contratto su Optimism Sepolia
    BUBBLE_REGISTRY_ADDRESS: "0x..." // Indirizzo del contratto su Optimism Sepolia
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
  STEALTH_ANNOUNCER_ADDRESS
} = chainConfigs.localhost;