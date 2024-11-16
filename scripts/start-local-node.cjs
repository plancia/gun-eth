const hardhat = require("hardhat");

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

    // Save contract addresses
    const fs = require('fs');
    const config = {
      STEALTH_ANNOUNCER_ADDRESS: stealthAddress,
      PROOF_OF_INTEGRITY_ADDRESS: proofAddress
    };

    fs.writeFileSync(
      './src/config/contract-address.json',
      JSON.stringify(config, null, 2)
    );

    console.log("\nContract addresses saved to config file");

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