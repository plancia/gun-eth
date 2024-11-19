let contractAddresses = {
  PROOF_OF_INTEGRITY_ADDRESS: "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512",
  STEALTH_ANNOUNCER_ADDRESS: "0x5FbDB2315678afecb367f032d93F642f64180aa3"
};

if (typeof window === 'undefined') {
  const { fileURLToPath } = require('url');
  const { dirname } = require('path');
  const { readFileSync } = require('fs');
  const { join } = require('path');

  try {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    const rawdata = readFileSync(join(__dirname, 'contract-address.json'), 'utf8');
    contractAddresses = JSON.parse(rawdata);
    console.log("Loaded contract addresses:", contractAddresses);
  } catch (error) {
    console.warn("Warning: contract-address.json not found or invalid");
  }
}

export const LOCAL_CONFIG = {
  CHAIN_ID: 1337,
  PROOF_OF_INTEGRITY_ADDRESS: contractAddresses.PROOF_OF_INTEGRITY_ADDRESS,
  STEALTH_ANNOUNCER_ADDRESS: contractAddresses.STEALTH_ANNOUNCER_ADDRESS,
  RPC_URL: "http://127.0.0.1:8545",
  GUN_PEER: "http://localhost:8765/gun"
}; 