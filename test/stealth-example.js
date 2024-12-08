import Gun from 'gun';
import { ethers } from "ethers";
import { StealthChain } from "../src/features/stealth/StealthChain.js";
import { GunEth, createSignature, MESSAGE_TO_SIGN } from "../src/core/gun-eth.js";
import { setSigner } from "../src/utils/common.js";

// Test configuration
const TEST_RPC = "http://127.0.0.1:8545";
const MOCK_KEYS = {
  alice: "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
  bob: "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d"
};

async function waitForGunData(gun, path, predicate, timeout = 5000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Timeout waiting for GUN data')), timeout);
    
    gun.get(path).on((data) => {
      if (predicate(data)) {
        clearTimeout(timer);
        resolve(data);
      }
    });
  });
}

async function stealthExample() {
  try {
    console.log("\n🎭 STEALTH PROTOCOL DEMO");
    
    // Setup provider e signers
    const provider = new ethers.JsonRpcProvider(TEST_RPC);
    const aliceSigner = new ethers.Wallet(MOCK_KEYS.alice, provider);
    const bobSigner = new ethers.Wallet(MOCK_KEYS.bob, provider);

    // Inizializza Gun
    const gun = Gun({
      peers: ['http://localhost:8765/gun'],
      localStorage: false,
      radisk: true,
      axe: false,
      multicast: false,
      web: false
    });

    // Forza l'uso della chain locale per i test
    const chain = 'localhost';
    console.log(`Using chain: ${chain} (test mode)`);

    // Inizializza GunEth
    await GunEth.init(chain);
    GunEth.extendGun(Gun);

    // Inizializza StealthChain
    const stealthChain = new StealthChain(gun);

    // Ottieni il gas price corrente
    const transactionOptions = {
      gasLimit: 500000,
      gasPrice: await provider.getFeeData().then(data => data.gasPrice)
    };

    // Setup Alice
    console.log("\n👩 Setting up Alice...");
    setSigner(TEST_RPC, MOCK_KEYS.alice);
    console.log("Alice's signer configured");
    
    const aliceSignature = await createSignature(MESSAGE_TO_SIGN);
    console.log("Alice's signature created:", aliceSignature.slice(0, 20) + "...");
    
    console.log("Publishing Alice's stealth keys...");
    const aliceKeys = await stealthChain.publishStealthKeys(aliceSignature);
    console.log("✅ Alice's stealth keys published");

    // Verifica che le chiavi di Alice siano state salvate
    console.log("Waiting for Alice's keys to sync...");
    await waitForGunData(
      gun,
      'gun-eth/users/' + aliceSigner.address + '/publicKeys',
      data => data?.viewingPublicKey && data?.spendingPublicKey,
      10000
    );
    console.log("✅ Alice's keys synced");

    // Setup Bob
    console.log("\n👨 Setting up Bob...");
    setSigner(TEST_RPC, MOCK_KEYS.bob);
    console.log("Bob's signer configured");
    
    const bobSignature = await createSignature(MESSAGE_TO_SIGN);
    console.log("Bob's signature created:", bobSignature.slice(0, 20) + "...");
    
    // Pubblica le chiavi di Bob
    console.log("Publishing Bob's stealth keys...");
    await stealthChain.publishStealthKeys(bobSignature);
    console.log("✅ Bob's stealth keys published");

    // Verifica che le chiavi di Bob siano state salvate
    console.log("Waiting for Bob's keys to sync...");
    await waitForGunData(
      gun,
      'gun-eth/users/' + bobSigner.address + '/publicKeys',
      data => data?.viewingPublicKey && data?.spendingPublicKey,
      10000
    );
    console.log("✅ Bob's keys synced");

    console.log("\nGenerating stealth address for Alice...");
    
    // Bob genera un indirizzo stealth per Alice
    const stealthInfo = await stealthChain.generateStealthAddress(
      aliceSigner.address,
      bobSignature
    );
    console.log("✅ Stealth address generated:", stealthInfo.stealthAddress);

    // Bob annuncia il pagamento
    console.log("\n💸 Bob announcing payment...");
    await stealthChain.announceStealthPayment(
      stealthInfo.stealthAddress,
      stealthInfo.senderPublicKey,
      stealthInfo.spendingPublicKey,
      bobSignature,
      { 
        chain,
        onChain: true,
        ...transactionOptions 
      }
    );
    console.log("✅ Payment announced");

    // Alice recupera i pagamenti
    console.log("\n🔍 Alice checking for payments...");
    setSigner(TEST_RPC, MOCK_KEYS.alice);
    const payments = await stealthChain.getStealthPayments(
      aliceSignature,
      { 
        chain,
        source: 'both'
      }
    );
    
    if (payments.length > 0) {
      console.log("✅ Found payments:", payments.length);
      
      // Per ogni pagamento trovato
      for (const payment of payments) {
        console.log(`\nPayment details:`);
        console.log("Stealth Address:", payment.stealthAddress);
        console.log("Timestamp:", new Date(payment.timestamp).toLocaleString());
        console.log("Source:", payment.source);

        // Alice recupera i fondi e li trasferisce a un nuovo indirizzo
        console.log("\n💰 Alice recovering funds...");
        
        try {
          // Recupera i fondi dall'indirizzo stealth
          const recoveredFunds = await stealthChain.recoverStealthFunds(
            payment.stealthAddress,
            payment.senderPublicKey,
            aliceSignature,
            payment.spendingPublicKey
          );
          console.log("✅ Funds recovered successfully");

          // Genera un nuovo indirizzo di destinazione
          const destinationWallet = ethers.Wallet.createRandom().connect(provider);
          console.log("\n📤 Transferring funds to new address:", destinationWallet.address);

          // Trasferisce i fondi al nuovo indirizzo
          const tx = await aliceSigner.sendTransaction({
            to: destinationWallet.address,
            value: ethers.parseEther("0.1") // Simula un trasferimento di 0.1 ETH
          });
          
          await tx.wait();
          console.log("✅ Transfer completed, tx hash:", tx.hash);

          // Verifica il bilancio del nuovo indirizzo
          const balance = await provider.getBalance(destinationWallet.address);
          console.log("New address balance:", ethers.formatEther(balance), "ETH");
          
        } catch (error) {
          console.error("❌ Error during fund recovery or transfer:", error);
        }
      }
    } else {
      console.log("❌ No payments found");
    }

  } catch (error) {
    console.error("❌ Error executing example:", error);
    throw error;
  }
}

// Test both standard and custom contract scenarios
async function runTests() {
  console.log("🎭 STEALTH PROTOCOL DEMO\n");
  
  // First run the standard test
  console.log("📌 Running standard test (default contract)...\n");
  await stealthExample();
  
  console.log("\n✨ All tests completed!");
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