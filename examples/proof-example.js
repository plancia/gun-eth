import Gun from 'gun';
import GunEth from "../node/gun-eth-node.js";
import { ethers } from 'ethers';
import { isLocalEnvironment } from '../src/abis/abis.js';

// Extend Gun with GunEth functionality
Object.assign(Gun.chain, GunEth.chain);

// Use local Hardhat node URL
const LOCAL_RPC = "http://127.0.0.1:8545";

// Use Hardhat test accounts
const MOCK_KEYS = {
  alice: "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80", // First Hardhat account
  bob: "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d"    // Second Hardhat account
};

async function proofExample() {
  try {
    // Initialize Gun with local peer
    const gun = Gun({
      peers: ['http://localhost:8765/gun']
    });

    console.log("🚀 Initializing proof protocol...");

    // Setup Alice as data writer
    console.log("\n👩 Setting up Alice...");
    gun.setSigner(LOCAL_RPC, MOCK_KEYS.alice);

    // Example data to store and verify
    const data = {
      message: "Hello, blockchain!",
      timestamp: Date.now(),
      author: "Alice"
    };

    // Determina la chain da usare
    const chain = isLocalEnvironment() ? 'localhost' : 'optimismSepolia';
    console.log(`Using chain: ${chain}`);

    // Write data to GunDB and blockchain
    console.log("\n📝 Writing data to GunDB and blockchain...");
    
    return new Promise((resolve, reject) => {
      gun.proof(chain, null, data, async (ack) => {
        if (ack.err) {
          console.error("❌ Error:", ack.err);
          reject(new Error(ack.err));
          return;
        }
        
        if (ack.ok) {
          console.log("✅ Data written successfully!");
          console.log("Node ID:", ack.nodeId);
          console.log("Transaction Hash:", ack.txHash);
          
          // First verification (should pass)
          console.log("\n🔍 First verification (original data)...");
          await verifyData(gun, ack.nodeId);

          // Modify data in GunDB
          console.log("\n✏️ Modifying data in GunDB...");
          const modifiedData = {
            ...data,
            message: "Tampered message!",
            timestamp: Date.now()
          };

          gun.get(ack.nodeId).put(modifiedData, async (putAck) => {
            if (putAck.err) {
              console.error("❌ Error modifying data:", putAck.err);
              return;
            }

            console.log("Data modified in GunDB");

            // Second verification (should fail)
            console.log("\n🔍 Second verification (after tampering)...");
            await verifyData(gun, ack.nodeId);
            
            resolve();
          });
        }
      });
    });

  } catch (error) {
    console.error("❌ Error executing example:", error);
    throw error;
  }
}

async function verifyData(gun, nodeId) {
  console.log("\n🔍 Verifying data on blockchain...");
  
  // Setup Bob as data verifier
  console.log("\n👨 Setting up Bob as verifier...");
  gun.setSigner(LOCAL_RPC, MOCK_KEYS.bob);

  // Verify the data
  return new Promise((resolve) => {
    gun.proof("localhost", nodeId, null, (ack) => {
      if (ack.ok) {
        console.log("\n✅ Data verification PASSED!");
        console.log("Timestamp:", new Date(Number(ack.timestamp) * 1000).toLocaleString());
        console.log("Updater:", ack.updater);
        console.log("\nLatest Record:", {
          contentHash: ack.latestRecord.contentHash,
          timestamp: new Date(Number(ack.latestRecord.timestamp) * 1000).toLocaleString(),
          updater: ack.latestRecord.updater
        });

        // Verifica se i dati sono stati manomessi
        gun.get(nodeId).once((data) => {
          console.log("\n🔄 Re-analyzing current data state...");
          
          const originalHash = data._contentHash;
          const currentData = { ...data };
          delete currentData._contentHash;
          delete currentData._;
          
          const currentDataString = JSON.stringify(currentData);
          const currentHash = ethers.keccak256(ethers.toUtf8Bytes(currentDataString));

          console.log("Current data state:", currentData);
          console.log("Calculated new hash:", currentHash);
          console.log("Original stored hash:", originalHash);

          if (currentHash !== originalHash) {
            console.log("\n⚠️ WARNING: Data has been tampered!");
            console.log("Original hash:", originalHash);
            console.log("Current hash:", currentHash);
            console.log("Modified data:", currentData);
          } else {
            console.log("\n✅ Data integrity check passed: No tampering detected");
          }
        });

      } else {
        console.log("\n❌ Data verification FAILED!");
        if (ack.err) {
          console.error("Error:", ack.err);
        }
        if (ack.latestRecord) {
          console.log("Latest Record:", {
            contentHash: ack.latestRecord.contentHash,
            timestamp: new Date(Number(ack.latestRecord.timestamp) * 1000).toLocaleString(),
            updater: ack.latestRecord.updater
          });
        }
      }
      resolve();
    });
  });
}

// Run the example
console.log("🎭 PROOF PROTOCOL DEMO\n");
proofExample()
  .then(() => {
    // Wait for all verifications to complete
    setTimeout(() => {
      console.log("\n✨ Demo completed!");
      process.exit(0);
    }, 5000);
  })
  .catch(error => {
    console.error("❌ Fatal error:", error);
    process.exit(1);
  }); 