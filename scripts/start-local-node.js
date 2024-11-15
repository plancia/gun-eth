import { ethers } from "hardhat";

async function main() {
  // Deploy del contratto StealthAnnouncer
  const StealthAnnouncer = await ethers.getContractFactory("StealthAnnouncer");
  const [deployer] = await ethers.getSigners();
  
  console.log("Deploying StealthAnnouncer with account:", deployer.address);
  
  const stealthAnnouncer = await StealthAnnouncer.deploy(deployer.address);
  await stealthAnnouncer.deployed();
  
  console.log("StealthAnnouncer deployed to:", stealthAnnouncer.address);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 