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
const require = createRequire(import.meta.url);

const ProofOfIntegrityArtifact = require('./ProofOfIntegrity.json');
const StealthAnnouncerArtifact = require('./StealthAnnouncer.json');
const BubbleRegistryArtifact = require('./BubbleRegistry.json');
const BubbleProxyArtifact = require('./BubbleProxy.json');

// Il resto del codice rimane invariato

// Esporta gli ABI dai file JSON
export const PROOF_OF_INTEGRITY_ABI = ProofOfIntegrityArtifact.abi;
export const STEALTH_ANNOUNCER_ABI = StealthAnnouncerArtifact.abi;
export const BUBBLE_REGISTRY_ABI = BubbleRegistryArtifact.abi;
export const BUBBLE_PROXY_ABI = BubbleProxyArtifact.abi;

/**
 * Configurazioni per diverse chain
 * @type {Object.<string, ChainConfig>}
 */
const chainConfigs = {
  localhost: {
    CHAIN_ID: 31337,
    RPC_URL: "http://127.0.0.1:8545",
    PROOF_OF_INTEGRITY_ADDRESS: "0x8A791620dd6260079BF849Dc5567aDC3F2FdC318",
    STEALTH_ANNOUNCER_ADDRESS: "0x2279B7A0a67DB372996a5FaB50D91eAA73d2eBe6",
    BUBBLE_REGISTRY_ADDRESS: "0x610178dA211FEF7D417bC0e6FeD39F05609AD788"
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