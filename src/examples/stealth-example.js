import Gun from 'gun';
import GunEth from "../node/gun-eth-node.js";

// Estendi Gun con le funzionalità di GunEth
Object.assign(Gun.chain, GunEth.chain);

// Usa l'URL del nodo locale Hardhat
const LOCAL_RPC = "http://127.0.0.1:8545";

// Usa gli account di test di Hardhat
const MOCK_KEYS = {
  alice: "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80", // Primo account Hardhat
  bob: "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d"    // Secondo account Hardhat
};

async function stealthExample() {
  try {
    // Inizializza Gun con un peer locale
    const gun = Gun({
      peers: ['http://localhost:8765/gun']
    });

    console.log("🚀 Inizializzazione del protocollo stealth...");

    // Setup di Alice (recipient)
    console.log("\n👩 Setup di Alice...");
    gun.setSigner(LOCAL_RPC, MOCK_KEYS.alice);
    const aliceSignature = await gun.createSignature("Accesso a GunDB con Ethereum");
    const aliceAddress = await gun.verifySignature("Accesso a GunDB con Ethereum", aliceSignature);
    console.log("Alice address:", aliceAddress);

    // Alice crea e memorizza le sue coppie di chiavi
    await gun.createAndStoreEncryptedPair(aliceAddress, aliceSignature);
    console.log("✅ Alice ha generato e salvato le sue chiavi");

    // Setup di Bob (sender)
    console.log("\n👨 Setup di Bob...");
    gun.setSigner(LOCAL_RPC, MOCK_KEYS.bob);
    const bobSignature = await gun.createSignature("Accesso a GunDB con Ethereum");
    const bobAddress = await gun.verifySignature("Accesso a GunDB con Ethereum", bobSignature);
    console.log("Bob address:", bobAddress);

    // Bob crea e memorizza le sue coppie di chiavi
    await gun.createAndStoreEncryptedPair(bobAddress, bobSignature);
    console.log("✅ Bob ha generato e salvato le sue chiavi");

    // Bob genera un indirizzo stealth per Alice
    console.log("\n💫 Generazione indirizzo stealth...");
    const stealthInfo = await gun.generateStealthAddress(aliceAddress, bobSignature);
    console.log("Indirizzo stealth generato:", stealthInfo.stealthAddress);

    // Bob annuncia il pagamento stealth on-chain
    console.log("\n📢 Annuncio del pagamento stealth on-chain...");
    await gun.announceStealthPayment(
      stealthInfo.stealthAddress,
      stealthInfo.senderPublicKey,
      stealthInfo.spendingPublicKey,
      bobSignature,
      { onChain: true }
    );

    // Simula l'invio di ETH
    console.log("\n💸 Simulazione invio di ETH all'indirizzo stealth...");
    console.log(`Bob invia 1 ETH a ${stealthInfo.stealthAddress}`);

    // Attendi la sincronizzazione
    console.log("\n⏳ Attendi sincronizzazione...");
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Alice scansiona tutti gli annunci on-chain
    console.log("\n🔍 Alice scansiona gli annunci stealth...");
    gun.setSigner(LOCAL_RPC, MOCK_KEYS.alice);
    
    // Recupera tutti gli annunci e prova a decrittarli
    const allAnnouncements = await gun.getStealthPayments(aliceSignature, { source: 'onChain' });
    console.log(`Trovati ${allAnnouncements.length} annunci per Alice`);

    if (allAnnouncements.length === 0) {
      console.log("Nessun annuncio trovato per Alice");
      return;
    }

    // Alice prova a recuperare i fondi da ogni annuncio
    console.log("\n🔐 Alice recupera i fondi...");
    for (const announcement of allAnnouncements) {
      try {
        console.log("\nProcessando annuncio:", {
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

        console.log("\n✅ Wallet recuperato con successo!");
        console.log({
          stealthAddress: announcement.stealthAddress,
          recoveredAddress: recoveredWallet.address,
          timestamp: new Date(announcement.timestamp * 1000).toLocaleString()
        });

        // Qui Alice potrebbe spostare i fondi
        console.log("\n💡 Alice può ora spostare i fondi dal wallet recuperato");
        
      } catch (error) {
        // Se non riesce a recuperare i fondi, l'annuncio non era per lei
        console.log(`Annuncio non destinato ad Alice: ${announcement.stealthAddress}`);
      }
    }

  } catch (error) {
    console.error("❌ Errore nell'esecuzione dell'esempio:", error);
  }
}

// Esegui l'esempio
console.log("🎭 DEMO PROTOCOLLO STEALTH\n");
stealthExample()
  .then(() => console.log("\n✨ Demo completata!"))
  .catch(console.error); 