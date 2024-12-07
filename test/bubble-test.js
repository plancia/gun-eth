import { ethers } from "ethers";
import Gun from 'gun';
import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { HybridBubbleProvider } from '../src/features/bubbles/providers/hybrid-bubble-provider.js';
import { GUNBubbleProvider } from '../src/features/bubbles/providers/gun-bubble-provider.js';
import { getAddressesForChain } from '../src/constants/abis.js';
import { ethToGunAccount, MESSAGE_TO_SIGN, createSignature } from '../src/core/gun-eth.js';
import { BubbleClient } from '../src/features/bubbles/client/bubble-client.js';
import { setSigner } from '../src/utils/common.js';

// Test configuration
const TEST_RPC = "http://127.0.0.1:8545";
const TEST_PORT = 8765;
const MOCK_KEYS = {
  alice: "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
  bob: "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d",
  charlie: "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a"
};

async function startTestServer(provider) {
  const app = express();
  app.use(cors());
  app.use(express.json());

  // Crea prima l'HTTP server
  const httpServer = createServer(app);

  // API Routes
  app.post('/api/bubble', async (req, res) => {
    try {
      const result = await provider.handleCreateBubble(req.body);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/bubble/:bubbleId/write', async (req, res) => {
    try {
      const result = await provider.handleFileUpload(
        req.params.bubbleId,
        req.body.fileName,
        req.body.content,
        req.body.userAddress
      );
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/bubble/:bubbleId', async (req, res) => {
    try {
      const result = await provider.handleFileDownload(
        req.params.bubbleId,
        req.query.fileName,
        req.query.userAddress
      );
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/bubble/:bubbleId/share', async (req, res) => {
    try {
      const result = await provider.handleGrantPermission(
        req.params.bubbleId,
        req.body.granteeAddress,
        req.body.granterAddress,
        req.body
      );
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Avvia il server
  await new Promise(resolve => httpServer.listen(TEST_PORT, resolve));
  console.log(`Test server listening on port ${TEST_PORT}`);

  return httpServer;
}

async function testBubbleSystem() {
  let gunInstance = null;
  let httpServer = null;
  let hybridProvider = null;
  let gunProvider = null;
  let bobProvider = null;

  try {
    // Setup base
    const provider = new ethers.JsonRpcProvider(TEST_RPC);
    const alice = new ethers.Wallet(MOCK_KEYS.alice, provider);
    const bob = new ethers.Wallet(MOCK_KEYS.bob, provider);
    const charlie = new ethers.Wallet(MOCK_KEYS.charlie, provider);
    
    // Ottieni gli indirizzi dei contratti per la chain corrente
    const addresses = getAddressesForChain("localhost");
    console.log("Using contract addresses:", addresses);

    if (!addresses?.BUBBLE_REGISTRY_ADDRESS) {
      throw new Error("No BUBBLE_REGISTRY_ADDRESS found for localhost chain");
    }

    // Inizializza Gun
    gunInstance = Gun({
      peers: [`http://localhost:${TEST_PORT}/gun`],
      file: 'radata/test',
      radisk: true
    });

    // Imposta il signer per Alice
    console.log("Setting up Alice's signer...");
    setSigner(TEST_RPC, MOCK_KEYS.alice);
    console.log("Alice's signer configured");

    console.log("Generating keypairs...");
    const aliceSignature = await createSignature(MESSAGE_TO_SIGN);
    if (!aliceSignature) {
      throw new Error("Failed to create Alice's signature");
    }
    let aliceKeypair = await ethToGunAccount();
    aliceKeypair = aliceKeypair.pair;

    // Setup Bob
    setSigner(TEST_RPC, MOCK_KEYS.bob);
    console.log("Bob's signer configured");
    const bobSignature = await createSignature(MESSAGE_TO_SIGN);
    if (!bobSignature) {
      throw new Error("Failed to create Bob's signature");
    }
    let bobKeypair = await ethToGunAccount();
    bobKeypair = bobKeypair.pair;

    // Setup Charlie
    setSigner(TEST_RPC, MOCK_KEYS.charlie);
    console.log("Charlie's signer configured");
    const charlieSignature = await createSignature(MESSAGE_TO_SIGN);
    if (!charlieSignature) {
      throw new Error("Failed to create Charlie's signature");
    }
    let charlieKeypair = await ethToGunAccount();
    charlieKeypair = charlieKeypair.pair;

    // Verifica che i keypair siano validi
    

    // Inizializza i provider
    hybridProvider = new HybridBubbleProvider({
      rpcUrl: TEST_RPC,
      chain: 'localhost',
      gun: gunInstance,
      keypair: aliceKeypair
    });

    gunProvider = new GUNBubbleProvider({
      rpcUrl: TEST_RPC,
      chain: 'localhost',
      gun: gunInstance,
      keypair: aliceKeypair
    });

    // Inizializza il provider di Bob
    bobProvider = new HybridBubbleProvider({
      rpcUrl: TEST_RPC,
      chain: 'localhost',
      gun: gunInstance,
      keypair: bobKeypair
    });

    // Avvia il server di test con il provider di Bob
    console.log("\n🚀 Starting test server...");
    httpServer = await startTestServer(bobProvider);
    console.log("Test server started");

    // Test Suite 1: Hybrid Provider con contratto predefinito
    console.log("\n🧪 Test Suite 1: Hybrid Provider (Default Contract)");
    
    // Torna al signer di Alice per i test
    setSigner(TEST_RPC, MOCK_KEYS.alice);
    
    // Inizializza provider ibrido per Alice
    hybridProvider = new HybridBubbleProvider({
      rpcUrl: TEST_RPC,
      chain: 'localhost',
      gun: gunInstance,
      keypair: aliceKeypair
    });

    // Test 1.1: Creazione bolla
    console.log("\n📝 Test 1.1: Creating bubble with Hybrid Provider...");
    const hybridBubble = await hybridProvider.handleCreateBubble({
      name: "Hybrid Test Bubble " + Date.now(),
      isPrivate: true,
      userAddress: alice.address
    });
    console.log("Hybrid bubble created:", hybridBubble);

    // Test 1.2: Upload file
    console.log("\n📤 Test 1.2: Uploading file to hybrid bubble...");
    const hybridFile = {
      name: "hybrid-test.txt",
      content: "This is a hybrid test file"
    };
    const hybridUpload = await hybridProvider.handleFileUpload(
      hybridBubble.id,
      hybridFile.name,
      hybridFile.content,
      alice.address
    );
    console.log("File uploaded to hybrid bubble:", hybridUpload);

    // Test Suite 2: Hybrid Provider con contratto personalizzato
    console.log("\n🧪 Test Suite 2: Hybrid Provider (Custom Contract)");
    console.log("Using BUBBLE_REGISTRY_ADDRESS:", addresses.BUBBLE_REGISTRY_ADDRESS);
    
    // Inizializza provider ibrido per Alice con contratto personalizzato
    const customHybridProvider = new HybridBubbleProvider({
      rpcUrl: TEST_RPC,
      chain: 'localhost',
      gun: gunInstance,
      keypair: aliceKeypair,
      contractAddress: addresses.BUBBLE_REGISTRY_ADDRESS // Usa l'indirizzo caricato dinamicamente
    });

    // Test 2.1: Creazione bolla con contratto personalizzato
    console.log("\n📝 Test 2.1: Creating bubble with Custom Contract...");
    const customBubble = await customHybridProvider.handleCreateBubble({
      name: "Custom Contract Bubble " + Date.now(),
      isPrivate: true,
      userAddress: alice.address
    });
    console.log("Custom contract bubble created:", customBubble);

    // Test 2.2: Upload file con contratto personalizzato
    console.log("\n📤 Test 2.2: Uploading file to custom contract bubble...");
    const customFile = {
      name: "custom-test.txt",
      content: "This is a custom contract test file"
    };
    const customUpload = await customHybridProvider.handleFileUpload(
      customBubble.id,
      customFile.name,
      customFile.content,
      alice.address
    );
    console.log("File uploaded to custom contract bubble:", customUpload);

    // Test 2.3: Client con contratto personalizzato
    console.log("\n🔄 Test 2.3: Client with custom contract...");
    const customAliceClient = new BubbleClient({
      providerUrl: `http://localhost:${TEST_PORT}/api`,
      signer: alice,
      keypair: aliceKeypair,
      gun: gunInstance,
      contractAddress: addresses.BUBBLE_REGISTRY_ADDRESS // Usa l'indirizzo caricato dinamicamente
    });

    // Test lettura con client personalizzato
    const customReadResult = await customAliceClient.readBubble(
      customBubble.id,
      customFile.name
    );
    console.log("Custom contract read result:", {
      hasContent: !!customReadResult.content,
      expectedContent: customFile.content,
      receivedContent: customReadResult.content
    });

    // Test Suite 3: GUN Provider
    console.log("\n🧪 Test Suite 3: GUN Provider");
    
    // Inizializza provider GUN per Alice usando lo stesso keypair
    gunProvider = new GUNBubbleProvider({
      rpcUrl: TEST_RPC,
      chain: 'localhost',
      gun: gunInstance,
      keypair: aliceKeypair  // Usa lo stesso keypair di Alice
    });

    // Test 3.1: Creazione bolla
    console.log("\n📝 Test 3.1: Creating bubble with GUN Provider...");
    const gunBubble = await gunProvider.handleCreateBubble({
      name: "GUN Test Bubble " + Date.now(),
      isPrivate: true,
      userAddress: alice.address
    });
    console.log("GUN bubble created:", gunBubble);

    // Test 3.2: Upload file
    console.log("\n📤 Test 3.2: Uploading file to GUN bubble...");
    const gunFile = {
      name: "gun-test.txt",
      content: "This is a GUN test file"
    };
    const gunUpload = await gunProvider.handleFileUpload(
      gunBubble.id,
      gunFile.name,
      gunFile.content,
      alice.address
    );
    console.log("File uploaded to GUN bubble:", gunUpload);

    // Test Suite 4: Interoperabilità con Client
    console.log("\n🧪 Test Suite 4: Client Interoperability");

    // Inizializza il client di Alice
    const aliceClient = new BubbleClient({
      providerUrl: `http://localhost:${TEST_PORT}/api`,
      signer: alice,
      keypair: aliceKeypair,
      gun: gunInstance
    });

    // Test 4.1: Client legge file ibrido
    console.log("\n📥 Test 4.1: Client reading hybrid file...");
    try {
      // Usa lo stesso nome file usato nell'upload
      const hybridReadResult = await aliceClient.readBubble(
        hybridBubble.id, 
        hybridFile.name  // Passa esplicitamente il nome del file
      );
      
      // Verifica dettagliata del risultato
      console.log("Read result:", {
        hasContent: !!hybridReadResult.content,
        expectedContent: hybridFile.content,
        receivedContent: hybridReadResult.content,
        metadata: hybridReadResult.metadata
      });

      const contentMatches = hybridReadResult.content === hybridFile.content;
      console.log("Content verification:", contentMatches ? "✅ Success" : "❌ Failed");
      
      if (!contentMatches) {
        throw new Error("Content verification failed");
      }
    } catch (error) {
      console.error("Error reading hybrid file:", error);
      throw error;
    }

    // Test 4.2: Client scrive e provider legge
    console.log("\n📤 Test 4.2: Client writing, provider reading...");
    const clientFile = {
      name: "client-test.txt",
      content: "This is a client test file"
    };

    try {
      await aliceClient.writeBubble(
        hybridBubble.id, 
        clientFile.name, 
        clientFile.content
      );
      console.log("File written by client");

      const providerRead = await hybridProvider.handleFileDownload(
        hybridBubble.id,
        clientFile.name,
        alice.address
      );

      console.log("Provider reading client file:", 
        providerRead.content === clientFile.content ? "✅ Success" : "❌ Failed",
        "\nExpected:", clientFile.content,
        "\nGot:", providerRead.content
      );
    } catch (error) {
      console.error("Error in client write test:", error);
      throw error;
    }

    // Test 4.3: Client condivide con Bob
    console.log("\n🔄 Test 4.3: Client sharing with Bob...");
    try {
      // Verifica che le chiavi siano disponibili
      console.log("Bob's keypair:", {
        hasEpub: !!bobKeypair?.epub,
        hasEpriv: !!bobKeypair?.epriv,
        pub: bobKeypair?.pub?.slice(0, 20) + '...'
      });

      await aliceClient.shareBubble(
        hybridBubble.id,
        bob.address,
        {
          granteeEpub: bobKeypair.epub,  // Passa esplicitamente la chiave pubblica di Bob
          metadata: {
            sharedAt: Date.now(),
            granterAddress: alice.address,
            granteeAddress: bob.address
          }
        }
      );
      console.log("File shared through client");

      // Inizializza il client di Bob
      const bobClient = new BubbleClient({
        providerUrl: `http://localhost:${TEST_PORT}/api`,
        signer: bob,
        keypair: bobKeypair,
        gun: gunInstance
      });

      // Bob legge con il client
      const bobClientRead = await bobClient.readBubble(hybridBubble.id, clientFile.name);
      console.log("Bob's client read:", 
        bobClientRead.content === clientFile.content ? "✅ Success" : "❌ Failed",
        "\nExpected:", clientFile.content,
        "\nGot:", bobClientRead.content
      );
    } catch (error) {
      console.error("Error in sharing test:", error);
      throw error;
    }

    // Test 4.4: Verifica accesso incrociato
    console.log("\n🔀 Test 4.4: Cross-access verification...");
    try {
      // Bob prova a leggere con provider dopo condivisione client
      const bobProviderRead = await bobProvider.handleFileDownload(
        hybridBubble.id,
        clientFile.name,
        bob.address
      );

      console.log("Bob's provider read after client share:", 
        bobProviderRead.content === clientFile.content ? "✅ Success" : "❌ Failed",
        "\nExpected:", clientFile.content,
        "\nGot:", bobProviderRead.content
      );

      // Alice legge con client dopo scrittura provider
      const aliceClientRead = await aliceClient.readBubble(hybridBubble.id, hybridFile.name);
      console.log("Alice's client read of provider file:", 
        aliceClientRead.content === hybridFile.content ? "✅ Success" : "❌ Failed",
        "\nExpected:", hybridFile.content,
        "\nGot:", aliceClientRead.content
      );
    } catch (error) {
      console.error("Error in cross-access test:", error);
      throw error;
    }

    // Cleanup aggiuntivo per i test con contratto personalizzato
    console.log("\n🧹 Custom contract cleanup...");
    try {
      await customHybridProvider.handleDeleteFile(customBubble.id, customFile.name, alice.address);
      await customHybridProvider.handleDeleteBubble(customBubble.id, alice.address);
      console.log("Custom contract cleanup completed");
    } catch (error) {
      console.error("Error during custom contract cleanup:", error);
    }

    // Cleanup
    console.log("\n🧹 Cleanup...");
    try {
      // Elimina i file creati
      await hybridProvider.handleDeleteFile(hybridBubble.id, hybridFile.name, alice.address);
      await hybridProvider.handleDeleteFile(hybridBubble.id, clientFile.name, alice.address);
      
      // Elimina la bolla
      await hybridProvider.handleDeleteBubble(hybridBubble.id, alice.address);
      
      // Elimina anche la bolla GUN se esiste
      if (gunBubble) {
        await gunProvider.handleDeleteBubble(gunBubble.id, alice.address);
      }
      
      console.log("Cleanup completed successfully");
    } catch (error) {
      console.error("Error during cleanup:", error);
      // Non far fallire il test se il cleanup fallisce
    }

    console.log("\n✨ All tests passed!");

  } catch (error) {
    console.error("❌ Test failed:", error);
    throw error;
  } finally {
    if (gunInstance) {
      console.log("Cleaning up GUN instance...");
      gunInstance.off();
    }
    if (httpServer) {
      console.log("Shutting down test server...");
      await new Promise(resolve => httpServer.close(resolve));
    }
  }
}

async function cleanup(hybridProvider, gunProvider, gunInstance, httpServer, bubbleId) {
  console.log("\n🧹 Cleanup...");
  try {
    // Delete files first
    await hybridProvider.handleDeleteFile(bubbleId, 'hybrid-test.txt', alice.address);
    console.log("Files deleted");

    // Wait for Gun to sync
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Delete bubble
    await hybridProvider.handleDeleteBubble(bubbleId, alice.address);
    console.log("Bubble deleted");

    // Wait for Gun to sync again
    await new Promise(resolve => setTimeout(resolve, 1000));

    if (gunInstance) {
      console.log("Cleaning up GUN instance...");
      gunInstance.off();
    }

    if (httpServer) {
      console.log("Shutting down test server...");
      await new Promise(resolve => httpServer.close(resolve));
    }

    console.log("Cleanup completed successfully");
  } catch (error) {
    console.error("Error during cleanup:", error);
  }
}

// Run tests
console.log("🎭 BUBBLE SYSTEM TEST SUITE\n");
testBubbleSystem()
  .then(() => process.exit(0))
  .catch(() => process.exit(1)); 