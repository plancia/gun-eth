const hardhat = require("hardhat");
const fs = require('fs');
const path = require('path');

async function updateConfigFiles(network, addresses) {
  // Aggiorna contract-address.json
  const addressesPath = path.join(__dirname, '../src/config/contract-address.json');
  let existingAddresses = {};
  
  if (fs.existsSync(addressesPath)) {
    existingAddresses = JSON.parse(fs.readFileSync(addressesPath, 'utf8'));
  }

  existingAddresses[network] = addresses;
  
  fs.writeFileSync(
    addressesPath,
    JSON.stringify(existingAddresses, null, 2)
  );

  // Leggi il contenuto attuale di abis.js
  const abisPath = path.join(__dirname, '../src/constants/abis.js');
  let abisContent = fs.readFileSync(abisPath, 'utf8');

  // Aggiorna gli indirizzi nella configurazione della network
  const networkConfig = `${network}: {
    CHAIN_ID: ${network === 'mainnet' ? 1 : network === 'polygon' ? 137 : network === 'optimism' ? 10 : 31337},
    RPC_URL: process.env.${network.toUpperCase()}_RPC_URL,
    PROOF_OF_INTEGRITY_ADDRESS: "${addresses.PROOF_OF_INTEGRITY_ADDRESS}",
    STEALTH_ANNOUNCER_ADDRESS: "${addresses.STEALTH_ANNOUNCER_ADDRESS}",
    BUBBLE_REGISTRY_ADDRESS: "${addresses.BUBBLE_REGISTRY_ADDRESS}"
  }`;

  // Se la configurazione per questa network esiste già, aggiornala
  const networkRegex = new RegExp(`(${network}:\\s*{[^}]*})`, 's');
  if (abisContent.match(networkRegex)) {
    abisContent = abisContent.replace(networkRegex, networkConfig);
  } else {
    // Altrimenti, aggiungi la nuova configurazione
    const lastBrace = abisContent.lastIndexOf('}');
    abisContent = abisContent.slice(0, lastBrace) + ',\n  ' + networkConfig + abisContent.slice(lastBrace);
  }

  // Scrivi il file aggiornato
  fs.writeFileSync(abisPath, abisContent);
}

async function verifyContract(address, constructorArgs = []) {
  try {
    await hardhat.run("verify:verify", {
      address: address,
      constructorArguments: constructorArgs,
    });
    console.log("Contract verified successfully");
  } catch (error) {
    console.log("Verification failed:", error);
  }
}

async function main() {
  // Ottieni la network dal comando (es: npx hardhat run scripts/deploy-contracts.cjs --network mainnet)
  const network = hardhat.network.name;
  
  try {
    const [deployer] = await hardhat.ethers.getSigners();
    console.log(`\nDeploying contracts to ${network} with account:`, deployer.address);

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

    // Aggiorna i file di configurazione
    await updateConfigFiles(network, addresses);
    console.log("\nContract addresses updated in config files");

    // Verifica i contratti su Etherscan/Polygonscan/ecc se non siamo in localhost
    if (network !== 'localhost' && network !== 'hardhat') {
      console.log("\nVerifying contracts on block explorer...");
      
      // Attendi qualche blocco prima di verificare
      console.log("Waiting for a few blocks before verification...");
      await new Promise(resolve => setTimeout(resolve, 60000)); // 60 secondi
      
      await verifyContract(stealthAddress, [deployer.address]);
      await verifyContract(proofAddress);
      await verifyContract(bubbleAddress);
    }

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