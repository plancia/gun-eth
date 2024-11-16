import Gun from 'gun';
import GunEth from "../node/gun-eth-node.js";

// Extend Gun with GunEth functionality
Object.assign(Gun.chain, GunEth.chain);

// Use local Hardhat node URL
const LOCAL_RPC = "http://127.0.0.1:8545";

// Use Hardhat test accounts
const MOCK_KEYS = {
  alice: "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80", // First Hardhat account
  bob: "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d"    // Second Hardhat account
};

async function stealthExample() {
  try {
    // Initialize Gun with local peer
    const gun = Gun({
      peers: ['http://localhost:8765/gun']
    });

    console.log("🚀 Initializing stealth protocol...");

    // Setup Alice (recipient)
    console.log("\n👩 Setting up Alice...");
    gun.setSigner(LOCAL_RPC, MOCK_KEYS.alice);
    const aliceSignature = await gun.createSignature("Access GunDB with Ethereum");
    const aliceAddress = await gun.verifySignature("Access GunDB with Ethereum", aliceSignature);
    console.log("Alice address:", aliceAddress);

    // Alice creates and stores her key pairs
    await gun.createAndStoreEncryptedPair(aliceAddress, aliceSignature);
    console.log("✅ Alice has generated and saved her keys");

    // Setup Bob (sender)
    console.log("\n👨 Setting up Bob...");
    gun.setSigner(LOCAL_RPC, MOCK_KEYS.bob);
    const bobSignature = await gun.createSignature("Access GunDB with Ethereum");
    const bobAddress = await gun.verifySignature("Access GunDB with Ethereum", bobSignature);
    console.log("Bob address:", bobAddress);

    // Bob creates and stores his key pairs
    await gun.createAndStoreEncryptedPair(bobAddress, bobSignature);
    console.log("✅ Bob has generated and saved his keys");

    // Bob generates a stealth address for Alice
    console.log("\n💫 Generating stealth address...");
    const stealthInfo = await gun.generateStealthAddress(aliceAddress, bobSignature);
    console.log("Generated stealth address:", stealthInfo.stealthAddress);

    // Bob announces the stealth payment on-chain
    console.log("\n📢 Announcing stealth payment on-chain...");
    await gun.announceStealthPayment(
      stealthInfo.stealthAddress,
      stealthInfo.senderPublicKey,
      stealthInfo.spendingPublicKey,
      bobSignature,
      { onChain: true }
    );

    // Simulate ETH transfer
    console.log("\n💸 Simulating ETH transfer to stealth address...");
    console.log(`Bob sends 1 ETH to ${stealthInfo.stealthAddress}`);

    // Wait for synchronization
    console.log("\n⏳ Waiting for synchronization...");
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Alice scans all on-chain announcements
    console.log("\n🔍 Alice scanning stealth announcements...");
    gun.setSigner(LOCAL_RPC, MOCK_KEYS.alice);
    
    // Retrieve all announcements and try to decrypt them
    const allAnnouncements = await gun.getStealthPayments(aliceSignature, { source: 'onChain' });
    console.log(`Found ${allAnnouncements.length} announcements for Alice`);

    if (allAnnouncements.length === 0) {
      console.log("No announcements found for Alice");
      return;
    }

    // Alice tries to recover funds from each announcement
    console.log("\n🔐 Alice recovering funds...");
    for (const announcement of allAnnouncements) {
      try {
        console.log("\nProcessing announcement:", {
          stealthAddress: announcement.stealthAddress,
          senderPublicKey: announcement.senderPublicKey,
          spendingPublicKey: announcement.spendingPublicKey,
          timestamp: new Date(announcement.timestamp * 1000).toLocaleString()
        });

        const recoveredWallet = await gun.recoverStealthFunds(
          announcement.stealthAddress,
          announcement.senderPublicKey,
          aliceSignature,
          announcement.spendingPublicKey
        );

        console.log("\n✅ Wallet successfully recovered!");
        console.log({
          stealthAddress: announcement.stealthAddress,
          recoveredAddress: recoveredWallet.address,
          timestamp: new Date(announcement.timestamp * 1000).toLocaleString()
        });

        // Here Alice could move the funds
        console.log("\n💡 Alice can now move funds from the recovered wallet");
        
      } catch (error) {
        // If recovery fails, the announcement wasn't for her
        console.log(`Announcement not intended for Alice: ${announcement.stealthAddress}`);
      }
    }

  } catch (error) {
    console.error("❌ Error executing example:", error);
  }
}

// Run the example
console.log("🎭 STEALTH PROTOCOL DEMO\n");
stealthExample()
  .then(() => console.log("\n✨ Demo completed!"))
  .catch(console.error); 