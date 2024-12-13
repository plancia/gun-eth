// Importazioni condizionali per ambiente Node.js
let contractAddresses = {};

(async () => {
  if (typeof window === 'undefined') {
    try {
      // Ambiente Node.js
      const url = await import('url');
      const path = await import('path');
      const fs = await import('fs');
      
      const fileURLToPath = url.fileURLToPath;
      const dirname = path.dirname;
      const join = path.join;
      
      const __filename = fileURLToPath(import.meta.url);
      const __dirname = dirname(__filename);
      const rawdata = fs.readFileSync(join(__dirname, '../config/contract-address.json'), 'utf8');
      Object.assign(contractAddresses, JSON.parse(rawdata));
      console.log("Loaded contract addresses:", contractAddresses);
    } catch (error) {
      console.warn("Warning: contract-address.json not found or invalid");
    }
  }
})();

export const LOCAL_CONFIG = {
  STEALTH_ANNOUNCER_ADDRESS: contractAddresses.StealthAnnouncer || '0x5FbDB2315678afecb367f032d93F642f64180aa3',
  PROOF_OF_INTEGRITY_ADDRESS: contractAddresses.ProofOfIntegrity || '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512',
  BUBBLE_REGISTRY_ADDRESS: contractAddresses.BubbleRegistry || '0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0',
  RPC_URL: 'http://127.0.0.1:8545',
  CHAIN_ID: 31337
}; 