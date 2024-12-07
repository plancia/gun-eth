const hardhat = require("hardhat");
const fs = require('fs');
const path = require('path');

async function updateConfigFiles(addresses) {
  // Aggiorna contract-address.json
  fs.writeFileSync(
    path.join(__dirname, '../src/config/contract-address.json'),
    JSON.stringify(addresses, null, 2)
  );

  // Leggi il contenuto attuale di abis.js
  const abisPath = path.join(__dirname, '../src/constants/abis.js');
  let abisContent = fs.readFileSync(abisPath, 'utf8');

  // Aggiorna gli indirizzi nella configurazione localhost
  const configRegex = /(localhost:\s*{[^}]*})/s;
  const newLocalhostConfig = `localhost: {
    CHAIN_ID: 31337,
    RPC_URL: "http://127.0.0.1:8545",
    PROOF_OF_INTEGRITY_ADDRESS: "${addresses.PROOF_OF_INTEGRITY_ADDRESS}",
    STEALTH_ANNOUNCER_ADDRESS: "${addresses.STEALTH_ANNOUNCER_ADDRESS}",
    BUBBLE_REGISTRY_ADDRESS: "${addresses.BUBBLE_REGISTRY_ADDRESS}"
  }`;

  abisContent = abisContent.replace(configRegex, newLocalhostConfig);

  // Scrivi il file aggiornato
  fs.writeFileSync(abisPath, abisContent);
}

async function main() {
  try {
    const [deployer] = await hardhat.ethers.getSigners();
    console.log("Deploying contracts with account:", deployer.address);

    // Deploy StealthAnnouncer
    console.log("\nDeploying StealthAnnouncer contract...");
    const StealthAnnouncer = await hardhat.ethers.getContractFactory("StealthAnnouncer");
    const stealthAnnouncer = await StealthAnnouncer.deploy(deployer.address);
    await stealthAnnouncer.waitForDeployment();
    const stealthAddress = await stealthAnnouncer.getAddress();
    console.log("StealthAnnouncer deployed to:", stealthAddress);

    // Deploy ProofOfIntegrity
    console.log("\nDeploying ProofOfIntegrity contract...");
    const ProofOfIntegrity = await hardhat.ethers.getContractFactory("ProofOfIntegrity");
    const proofOfIntegrity = await ProofOfIntegrity.deploy();
    await proofOfIntegrity.waitForDeployment();
    const proofAddress = await proofOfIntegrity.getAddress();
    console.log("ProofOfIntegrity deployed to:", proofAddress);

    // Deploy BubbleRegistry
    console.log("\nDeploying BubbleRegistry contract...");
    const BubbleRegistry = await hardhat.ethers.getContractFactory("BubbleRegistry");
    const bubbleRegistry = await BubbleRegistry.deploy();
    await bubbleRegistry.waitForDeployment();
    const bubbleAddress = await bubbleRegistry.getAddress();
    console.log("BubbleRegistry deployed to:", bubbleAddress);

    const addresses = {
      STEALTH_ANNOUNCER_ADDRESS: stealthAddress,
      PROOF_OF_INTEGRITY_ADDRESS: proofAddress,
      BUBBLE_REGISTRY_ADDRESS: bubbleAddress
    };

    // Aggiorna entrambi i file di configurazione
    await updateConfigFiles(addresses);
    console.log("\nContract addresses updated in config files");

  } catch (error) {
    console.error("Error during deployment:", error);
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });