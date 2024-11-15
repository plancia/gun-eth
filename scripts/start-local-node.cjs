const hardhat = require("hardhat");

async function main() {
  try {
    // Deploy del contratto StealthAnnouncer
    console.log("Deploying StealthAnnouncer contract...");
    
    const [deployer] = await hardhat.ethers.getSigners();
    console.log("Deploying with account:", deployer.address);

    const StealthAnnouncer = await hardhat.ethers.getContractFactory("StealthAnnouncer");
    console.log("Contract factory created...");

    const stealthAnnouncer = await StealthAnnouncer.deploy(deployer.address);
    console.log("Deployment transaction sent...");
    
    console.log("Waiting for deployment transaction...");
    await stealthAnnouncer.waitForDeployment();
    
    const deployedAddress = await stealthAnnouncer.getAddress();
    console.log("StealthAnnouncer deployed to:", deployedAddress);

    // Salva l'indirizzo del contratto in un file di configurazione
    const fs = require('fs');
    const config = {
      STEALTH_ANNOUNCER_ADDRESS: deployedAddress
    };

    fs.writeFileSync(
      './src/config/contract-address.json',
      JSON.stringify(config, null, 2)
    );

    console.log("Contract address saved to config file");

  } catch (error) {
    console.error("Error during deployment:", error);
    console.error(error.stack);
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 