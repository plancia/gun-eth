import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let contractAddresses = {
  PROOF_OF_INTEGRITY_ADDRESS: null,
  STEALTH_ANNOUNCER_ADDRESS: null
};

try {
  const rawdata = readFileSync(join(__dirname, 'contract-address.json'), 'utf8');
  contractAddresses = JSON.parse(rawdata);
  console.log("Loaded contract addresses:", contractAddresses);
} catch (error) {
  console.warn("Warning: contract-address.json not found or invalid");
}

export const LOCAL_CONFIG = {
  PROOF_OF_INTEGRITY_ADDRESS: contractAddresses.PROOF_OF_INTEGRITY_ADDRESS,
  STEALTH_ANNOUNCER_ADDRESS: contractAddresses.STEALTH_ANNOUNCER_ADDRESS,
  RPC_URL: "http://127.0.0.1:8545",
  GUN_PEER: "http://localhost:8765/gun",
  CHAIN_ID: 31337
}; 