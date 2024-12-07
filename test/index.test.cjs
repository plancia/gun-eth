const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Smart Contracts", function() {
  async function deployFixture() {
    const [owner, alice, bob] = await ethers.getSigners();

    const BubbleRegistry = await ethers.getContractFactory("BubbleRegistry");
    const registry = await BubbleRegistry.deploy();
    await registry.waitForDeployment();

    const ProofOfIntegrity = await ethers.getContractFactory("ProofOfIntegrity");
    const proof = await ProofOfIntegrity.deploy();
    await proof.waitForDeployment();

    const StealthAnnouncer = await ethers.getContractFactory("StealthAnnouncer");
    const announcer = await StealthAnnouncer.deploy(owner.address);
    await announcer.waitForDeployment();

    const registryAddress = await registry.getAddress();
    const proofAddress = await proof.getAddress();
    const announcerAddress = await announcer.getAddress();

    return { 
      registry,
      proof,
      announcer,
      registryAddress,
      proofAddress,
      announcerAddress,
      owner, 
      alice, 
      bob 
    };
  }

  describe("Integration Tests", function() {
    it("Should deploy all contracts", async function() {
      const { registryAddress, proofAddress, announcerAddress } = await loadFixture(deployFixture);
      expect(registryAddress).to.match(/^0x[0-9a-fA-F]{40}$/);
      expect(proofAddress).to.match(/^0x[0-9a-fA-F]{40}$/);
      expect(announcerAddress).to.match(/^0x[0-9a-fA-F]{40}$/);
    });

    it("Should create a bubble and grant access", async function() {
      const { registry, alice, bob } = await loadFixture(deployFixture);
      
      // Create bubble as Alice
      const aliceRegistry = registry.connect(alice);
      const bubbleName = "Test Bubble";
      
      // Create bubble and get transaction
      const tx = await aliceRegistry.createBubble(bubbleName, true);
      const receipt = await tx.wait();
      
      // Get bubble ID from event
      const event = receipt.logs[0];
      const bubbleId = event.args[0]; // Assuming BubbleCreated event emits bubbleId as first parameter
      
      // Verify bubble details
      const [name, owner, , isPrivate] = await registry.getBubbleDetails(bubbleId);
      expect(name).to.equal(bubbleName);
      expect(owner).to.equal(alice.address);
      expect(isPrivate).to.be.true;
      
      // Grant access to Bob
      await aliceRegistry.grantAccess(bubbleId, bob.address);
      
      // Verify Bob has access
      expect(await registry.hasAccess(bubbleId, bob.address)).to.be.true;
    });

    it("Should update and verify data integrity", async function() {
      const { proof } = await loadFixture(deployFixture);
      
      const nodeId = ethers.keccak256(ethers.toUtf8Bytes("test-node"));
      const contentHash = ethers.keccak256(ethers.toUtf8Bytes("test-content"));
      
      await proof.updateData(nodeId, contentHash);
      
      const [isValid] = await proof.verifyData(nodeId, contentHash);
      expect(isValid).to.be.true;
    });

    it("Should announce stealth payment", async function() {
      const { announcer, alice } = await loadFixture(deployFixture);
      
      const devFee = await announcer.devFee();
      
      await announcer.connect(alice).announcePayment(
        "senderKey",
        "spendingKey",
        ethers.Wallet.createRandom().address,
        { value: devFee }
      );
      
      expect(await announcer.getAnnouncementsCount()).to.equal(1);
    });
  });
});