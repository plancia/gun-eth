import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let contractAddress = { STEALTH_ANNOUNCER_ADDRESS: "0x5FbDB2315678afecb367f032d93F642f64180aa3" };

try {
  const rawdata = readFileSync(join(__dirname, 'contract-address.json'), 'utf8');
  contractAddress = JSON.parse(rawdata);
} catch (error) {
  console.warn("Warning: contract-address.json not found, using default address");
}

export const LOCAL_CONFIG = {
  STEALTH_ANNOUNCER_ADDRESS: contractAddress.STEALTH_ANNOUNCER_ADDRESS,
  RPC_URL: "http://127.0.0.1:8545",
  GUN_PEER: "http://localhost:8765/gun",
  CHAIN_ID: 31337
}; 