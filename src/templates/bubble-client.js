import { ethers } from "ethers";
import Gun from "gun";
import { BubbleClient } from "../features/BubbleClient.js";
import {
  ethToGunAccount,
  createSignature,
  MESSAGE_TO_SIGN,
} from "../gun-eth.js";
import { setSigner } from "../utils/common.js";
import { decrypt } from "../utils/encryption.js";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";

dotenv.config();

const CONFIG = {
  RPC_URL: process.env.RPC_URL,
  PRIVATE_KEY: process.env.PRIVATE_KEY,
  PROVIDER_URL: process.env.PROVIDER_URL || "http://localhost:3000/api",
  GUN_PEERS: process.env.GUN_PEERS?.split(",") || ["http://localhost:8765/gun"],
  DECRYPTED_FILES_DIR: "./decrypted-files",
  DEFAULT_CHAIN_ID: process.env.DEFAULT_CHAIN_ID || "1",
};

class BubbleClientManager {
  constructor() {
    this.clients = new Map();
  }

  async initializeClient(chainId) {
    try {
      // Setup provider e signer
      const provider = new ethers.JsonRpcProvider(CONFIG.RPC_URL);
      const signer = new ethers.Wallet(CONFIG.PRIVATE_KEY, provider);

      // Configura Gun
      const gun = Gun({
        peers: CONFIG.GUN_PEERS,
        radix: true,
      });

      // Imposta il signer
      setSigner(CONFIG.RPC_URL, CONFIG.PRIVATE_KEY);

      // Genera il keypair
      const signature = await createSignature(MESSAGE_TO_SIGN);
      if (!signature) {
        throw new Error("Failed to create signature");
      }
      let keypair = await ethToGunAccount();
      keypair = keypair.pair;

      // Crea il client per la chain specifica
      const client = new BubbleClient({
        providerUrl: `${CONFIG.PROVIDER_URL}/${chainId}`,
        signer: signer,
        keypair: keypair,
        gun: gun,
        chainId: chainId,
      });

      return client;
    } catch (error) {
      console.error(`Failed to initialize client for chain ${chainId}:`, error);
      throw error;
    }
  }

  async getClient(chainId = CONFIG.DEFAULT_CHAIN_ID) {
    if (!this.clients.has(chainId)) {
      const client = await this.initializeClient(chainId);
      this.clients.set(chainId, client);
    }
    return this.clients.get(chainId);
  }
}

async function saveDecryptedFile(
  bubbleId,
  fileName,
  content,
  isBase64 = false
) {
  const dirPath = path.join(CONFIG.DECRYPTED_FILES_DIR, bubbleId);

  // Crea la directory se non esiste
  await fs.promises.mkdir(dirPath, { recursive: true });

  const filePath = path.join(dirPath, fileName);

  let dataToWrite;
  if (isBase64) {
    // Rimuovi eventuali header data:image e prendi solo il contenuto base64
    const base64Data = content.replace(/^data:image\/\w+;base64,/, "");
    try {
      dataToWrite = Buffer.from(base64Data, "base64");
      console.log(
        `📊 Dimensione immagine decodificata: ${dataToWrite.length} bytes`
      );
    } catch (error) {
      console.error(
        `❌ Errore nella decodifica base64 per ${fileName}:`,
        error
      );
      throw error;
    }
  } else if (fileName.endsWith(".json")) {
    // Se è JSON, formatta in modo leggibile
    try {
      const jsonContent =
        typeof content === "string" ? JSON.parse(content) : content;
      dataToWrite = JSON.stringify(jsonContent, null, 2);
    } catch (error) {
      console.warn(
        `⚠️ Errore nella formattazione JSON per ${fileName}:`,
        error
      );
      dataToWrite =
        typeof content === "string" ? content : JSON.stringify(content);
    }
  } else {
    // Altrimenti salva come testo
    dataToWrite = content;
  }

  await fs.promises.writeFile(filePath, dataToWrite);
  console.log(`📁 File salvato in: ${filePath}`);
  return filePath;
}

async function runClientTests(chainId = CONFIG.DEFAULT_CHAIN_ID) {
  const clientManager = new BubbleClientManager();
  const client = await clientManager.getClient(chainId);
  const userAddress = client.signer.address;

  try {
    console.log("\n=== Starting Client Tests ===");
    console.log("Using address:", userAddress);
    console.log("Chain ID:", chainId);

    // Test 1: Creazione bolla
    console.log("\n📝 Test 1: Creating bubble...");
    const bubble = await client.createBubble("Test Bubble " + Date.now(), {
      isPrivate: true,
      userAddress: userAddress,
    });
    console.log("Bubble created:", bubble);

    // Test 2: Upload file di testo
    console.log("\n📤 Test 2: Writing text file...");
    const textContent = "This is a test file " + Date.now();
    await client.writeBubble(bubble.id, "test.txt", textContent);
    console.log("Text file written successfully");

    // Test 3: Upload file JSON
    console.log("\n📤 Test 3: Writing JSON file...");
    const jsonContent = {
      name: "Test Object",
      timestamp: Date.now(),
      data: {
        field1: "value1",
        field2: 123,
        field3: ["a", "b", "c"],
        nested: {
          key: "value",
        },
      },
    };
    await client.writeBubble(
      bubble.id,
      "data.json",
      JSON.stringify(jsonContent, null, 2)
    );
    console.log("JSON file written successfully");

    // Test 4: Upload file PNG
    console.log("\n📤 Test 4: Writing PNG file...");
    // Crea un'immagine di test se non esiste
    const testImagePath = path.join(process.cwd(), "test-image.png");
    if (!fs.existsSync(testImagePath)) {
      console.log("Creating test image...");
      // Qui potresti usare canvas o altra libreria per creare un'immagine di test
      // Per ora usiamo un'immagine base64 minima
      const base64Image =
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
      fs.writeFileSync(testImagePath, Buffer.from(base64Image, "base64"));
    }

    const imageBuffer = fs.readFileSync(testImagePath);
    await client.writeBubble(
      bubble.id,
      "image.png",
      imageBuffer.toString("base64")
    );
    console.log("PNG file written successfully");

    // Test 5: Lettura e verifica dei file
    console.log("\n📥 Test 5: Reading, verifying and saving files...");

    // Verifica file di testo
    const textResult = await client.readBubble(bubble.id, "test.txt");
    let decodedText = textResult.content;
    if (decodedText.startsWith("SEA{")) {
      decodedText = await decrypt(decodedText, client.keypair);
    }
    await saveDecryptedFile(bubble.id, "test.txt", decodedText);
    console.log(
      "\nText file verification:",
      decodedText === textContent ? "✅ Success" : "❌ Failed"
    );

    // Verifica file JSON
    const jsonResult = await client.readBubble(bubble.id, "data.json");
    let decodedJson = jsonResult.content;
    if (decodedJson.startsWith("SEA{")) {
      decodedJson = await decrypt(decodedJson, client.keypair);
    }

    // Prova a parsare il JSON se è una stringa
    if (typeof decodedJson === "string") {
      try {
        decodedJson = JSON.parse(decodedJson);
      } catch (error) {
        console.warn("⚠️ Errore nel parsing JSON:", error);
      }
    }

    await saveDecryptedFile(bubble.id, "data.json", decodedJson);

    // Normalizza il JSON per il confronto
    const normalizeJson = (input) => {
      try {
        // Se è una stringa, prova a parsarla
        const obj = typeof input === "string" ? JSON.parse(input) : input;

        // Converti in stringa con chiavi ordinate
        const normalized = JSON.stringify(obj, Object.keys(obj).sort());

        // Rimuovi tutti gli spazi bianchi e le quote non necessarie
        return normalized.replace(/\s+/g, "");
      } catch (e) {
        console.error("Errore nella normalizzazione JSON:", e);
        return typeof input === "string" ? input : JSON.stringify(input);
      }
    };

    const normalizedExpected = normalizeJson(jsonContent);
    const normalizedActual = normalizeJson(decodedJson);
    const isEqual = normalizedExpected === normalizedActual;

    console.log(
      "JSON file verification:",
      isEqual ? "✅ Success" : "❌ Failed"
    );

    if (!isEqual) {
      console.log("\nJSON Comparison:");
      console.log(
        "Expected (normalized):",
        JSON.stringify(JSON.parse(normalizedExpected), null, 2)
      );
      console.log(
        "Got (normalized):",
        JSON.stringify(JSON.parse(normalizedActual), null, 2)
      );
      console.log("\nDifferences:");

      // Mostra le differenze specifiche
      const expectedObj = JSON.parse(normalizedExpected);
      const actualObj = JSON.parse(normalizedActual);
      const findDifferences = (obj1, obj2, path = "") => {
        const differences = [];
        const allKeys = new Set([...Object.keys(obj1), ...Object.keys(obj2)]);

        for (const key of allKeys) {
          const currentPath = path ? `${path}.${key}` : key;
          if (!(key in obj1)) {
            differences.push(`Extra key in actual: ${currentPath}`);
          } else if (!(key in obj2)) {
            differences.push(`Missing key in actual: ${currentPath}`);
          } else if (typeof obj1[key] !== typeof obj2[key]) {
            differences.push(
              `Type mismatch at ${currentPath}: expected ${typeof obj1[
                key
              ]}, got ${typeof obj2[key]}`
            );
          } else if (typeof obj1[key] === "object" && obj1[key] !== null) {
            differences.push(
              ...findDifferences(obj1[key], obj2[key], currentPath)
            );
          } else if (obj1[key] !== obj2[key]) {
            differences.push(
              `Value mismatch at ${currentPath}: expected ${obj1[key]}, got ${obj2[key]}`
            );
          }
        }
        return differences;
      };

      const differences = findDifferences(expectedObj, actualObj);
      if (differences.length > 0) {
        differences.forEach((diff) => console.log(`- ${diff}`));
      } else {
        console.log(
          "No structural differences found - might be formatting only"
        );
      }
    }

    // Verifica file PNG
    const imageResult = await client.readBubble(bubble.id, "image.png");
    let decodedImage = imageResult.content;
    if (decodedImage.startsWith("SEA{")) {
      decodedImage = await decrypt(decodedImage, client.keypair);
    }
    await saveDecryptedFile(bubble.id, "image.png", decodedImage, true);
    console.log(
      "PNG file verification:",
      decodedImage === imageBuffer.toString("base64")
        ? "✅ Success"
        : "❌ Failed"
    );

    console.log(
      `\n📂 I file decriptati sono stati salvati in: ${CONFIG.DECRYPTED_FILES_DIR}`
    );

    console.log("\n��� All client tests completed successfully!");
  } catch (error) {
    console.error("Client test failed:", error);
    throw error;
  }
}

// Esegui i test se il file è eseguito direttamente
if (process.argv[1] === import.meta.url) {
  const chainId = process.argv[2] || CONFIG.DEFAULT_CHAIN_ID;
  runClientTests(chainId)
    .then(() => process.exit(0))
    .catch((error) => {
      console.error("Fatal error:", error);
      process.exit(1);
    });
}

const clientManager = new BubbleClientManager();
await clientManager.getClient();
