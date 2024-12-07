import Gun from 'gun';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { GunEth } from "../src/core/gun-eth.js";
import { ethers } from 'ethers';
import { ProofChain } from "../src/features/proof/ProofChain.js";
import { setSigner } from "../src/utils/common.js";
import { PROOF_OF_INTEGRITY_ABI } from "../src/constants/abis.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Test configuration
const TEST_RPC = "http://127.0.0.1:8545";
const MOCK_KEYS = {
  alice: "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
  bob: "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d"
};

// Test both standard and custom contract scenarios
async function runTests() {
  console.log("🎭 PROOF PROTOCOL DEMO\n");
  
  // First run the standard test
  console.log("📌 Running standard test (default contract)...\n");
  await proofExample();
  
  // Then run the custom contract test
  console.log("\n📌 Running custom contract test...\n");
  await proofExampleWithCustomContract();
  
  console.log("\n All tests completed!");
}

async function proofExample() {
  try {
    // Configura Gun con peer locale
    const gunOptions = {
      peers: ['http://localhost:8765/gun'],
      localStorage: false,
      radisk: true,
      axe: false,
      multicast: false,
      web: false
    };

    // Setup provider e signers
    const provider = new ethers.JsonRpcProvider(TEST_RPC);
    const aliceSigner = new ethers.Wallet(MOCK_KEYS.alice, provider);
    const bobSigner = new ethers.Wallet(MOCK_KEYS.bob, provider);

    // Imposta il signer globalmente prima di inizializzare Gun
    setSigner(TEST_RPC, MOCK_KEYS.alice);
    await GunEth.init('localhost');

    // Inizializza Gun con le opzioni e le estensioni
    const gun = Gun(gunOptions);
    GunEth.extendGun(Gun);

    // Imposta il signer anche sull'istanza di Gun
    gun.setSigner(TEST_RPC, MOCK_KEYS.alice);

    // Inizializza ProofChain
    const proofChain = new ProofChain(gun);

    // Ottieni il gas price corrente
    const transactionOptions = {
      gasLimit: 500000,
      gasPrice: await provider.getFeeData().then(data => data.gasPrice)
    };

    // Dati di esempio
    const data = {
      message: "Hello, blockchain!",
      timestamp: Date.now(),
      author: "Alice"
    };

    // Forza l'uso della chain locale per i test
    const chain = 'localhost';
    console.log(`Using chain: ${chain} (test mode)`);

    // Scrivi i dati su GunDB e blockchain
    console.log("\n📝 Writing data to GunDB and blockchain...");

    return new Promise((resolve, reject) => {
      proofChain.proof(
        chain,    // chain
        null,     // nodeId
        data,     // data
        (ack) => {  // callback
          if (ack.err) {
            console.error("❌ Error:", ack.err);
            reject(new Error(ack.err));
            return;
          }
          
          if (ack.ok) {
            console.log("✅ Data written successfully!");
            console.log("Node ID:", ack.nodeId);
            console.log("Transaction Hash:", ack.txHash);
            
            // Prima verifica (dovrebbe passare)
            console.log("\n🔍 First verification (original data)...");
            verifyData(gun, ack.nodeId)
              .then(() => {
                // Modifica i dati in GunDB
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

                  // Seconda verifica (dovrebbe fallire)
                  console.log("\n🔍 Second verification (after tampering)...");
                  await verifyData(gun, ack.nodeId);
                  
                  resolve();
                });
              })
              .catch(reject);
          }
        },
        transactionOptions  // options come ultimo parametro
      );
    });

  } catch (error) {
    console.error("❌ Error executing example:", error);
    throw error;
  }
}

async function verifyData(gun, nodeId) {
  console.log("\n🔍 Verifying data on blockchain...");
  
  // Cambia a Bob
  gun.setSigner(TEST_RPC, MOCK_KEYS.bob);
  
  // Setup Bob come verificatore
  console.log("\n👨 Setting up Bob as verifier...");
  const bobSignature = await gun.createSignature("Access GunDB with Ethereum");

  // Verifica i dati
  return new Promise((resolve) => {
    gun.proof(
      "localhost",  // chain
      nodeId,       // nodeId
      null,         // data
      (ack) => {    // callback
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
            resolve();
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
          resolve();
        }
      },
      { gasLimit: 500000 }  // options
    );
  });
}

async function proofExampleWithCustomContract() {
  try {
    // Setup Gun and provider as before
    const gunOptions = {
      peers: ['http://localhost:8765/gun'],
      localStorage: false,
      radisk: true,
      axe: false,
      multicast: false,
      web: false
    };

    const provider = new ethers.JsonRpcProvider(TEST_RPC);
    const aliceSigner = new ethers.Wallet(MOCK_KEYS.alice, provider);
    
    // Usa l'indirizzo del contratto già deployato
    console.log("📄 Using existing ProofOfIntegrity contract...");
    const customContractAddress = '0x8A791620dd6260079BF849Dc5567aDC3F2FdC318'; // Indirizzo del contratto già deployato
    console.log("Contract address:", customContractAddress);

    // Initialize Gun with custom contract
    setSigner(TEST_RPC, MOCK_KEYS.alice);
    await GunEth.init('localhost');
    const gun = Gun(gunOptions);
    GunEth.extendGun(Gun);
    gun.setSigner(TEST_RPC, MOCK_KEYS.alice);

    // Initialize ProofChain with custom contract
    const proofChain = new ProofChain(gun, {
      contractAddress: customContractAddress
    });

    const transactionOptions = {
      gasLimit: 500000,
      gasPrice: await provider.getFeeData().then(data => data.gasPrice)
    };

    // Test data
    const data = {
      message: "Hello from custom contract!",
      timestamp: Date.now(),
      author: "Alice"
    };

    // Write and verify data using custom contract
    return new Promise((resolve, reject) => {
      proofChain.proof(
        'localhost',
        null,
        data,
        async (ack) => {
          if (ack.err) {
            console.error("❌ Error:", ack.err);
            reject(new Error(ack.err));
            return;
          }
          
          if (ack.ok) {
            console.log("✅ Data written successfully to custom contract!");
            console.log("Node ID:", ack.nodeId);
            console.log("Transaction Hash:", ack.txHash);
            
            // Verify data
            await verifyDataWithCustomContract(gun, ack.nodeId, customContractAddress);
            resolve();
          }
        },
        { ...transactionOptions, contractAddress: customContractAddress }
      );
    });

  } catch (error) {
    console.error("❌ Error executing custom contract example:", error);
    throw error;
  }
}

async function verifyDataWithCustomContract(gun, nodeId, contractAddress) {
  console.log("\n🔍 Verifying data on custom contract...");
  
  // Switch to Bob for verification
  gun.setSigner(TEST_RPC, MOCK_KEYS.bob);
  const bobSignature = await gun.createSignature("Access GunDB with Ethereum");

  return new Promise((resolve) => {
    gun.proof(
      "localhost",
      nodeId,
      null,
      (ack) => {
        if (ack.ok) {
          console.log("\n✅ Data verification PASSED on custom contract!");
          console.log("Timestamp:", new Date(Number(ack.timestamp) * 1000).toLocaleString());
          console.log("Updater:", ack.updater);
          resolve();
        } else {
          console.log("\n❌ Data verification FAILED on custom contract!");
          console.error("Error:", ack.err);
          resolve();
        }
      },
      { 
        gasLimit: 500000,
        contractAddress: contractAddress
      }
    );
  });
}

// Run all tests
runTests()
  .then(() => {
    setTimeout(() => {
      process.exit(0);
    }, 5000);
  })
  .catch(error => {
    console.error("❌ Fatal error:", error);
    process.exit(1);
  }); 