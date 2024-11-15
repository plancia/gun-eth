import Gun from "gun";
import SEA from "gun/sea.js";
import { ethers } from "ethers";
import { SHINE_ABI, SHINE_OPTIMISM_SEPOLIA } from "../abis/abis.js";
import { STEALTH_ANNOUNCER_ABI, STEALTH_ANNOUNCER_ADDRESS } from "../abis/abis.js";
import { LOCAL_CONFIG } from "../config/local.js";

let SHINE_CONTRACT_ADDRESS;
let rpcUrl = "";
let privateKey = "";

const MESSAGE_TO_SIGN = "Accesso a GunDB con Ethereum";

/**
 * Generates a password from a signature.
 * @param {string} signature - The signature to derive the password from.
 * @returns {string|null} The generated password or null if generation fails.
 */
export function generatePassword(signature) {
  try {
    const hexSignature = ethers.hexlify(signature);
    const hash = ethers.keccak256(hexSignature);
    console.log("Generated password:", hash);
    return hash;
  } catch (error) {
    console.error("Error generating password:", error);
    return null;
  }
}

/**
 * Converts a Gun private key to an Ethereum account.
 * @param {string} gunPrivateKey - The Gun private key in base64url format.
 * @returns {Object} An object containing the Ethereum account and public key.
 */
export function gunToEthAccount(gunPrivateKey) {
  // Function to convert base64url to hex
  const base64UrlToHex = (base64url) => {
    const padding = "=".repeat((4 - (base64url.length % 4)) % 4);
    const base64 = base64url.replace(/-/g, "+").replace(/_/g, "/") + padding;
    const binary = atob(base64);
    return Array.from(binary, (char) =>
      char.charCodeAt(0).toString(16).padStart(2, "0")
    ).join("");
  };

  // Convert Gun private key to hex format
  const hexPrivateKey = "0x" + base64UrlToHex(gunPrivateKey);

  // Create an Ethereum wallet from the private key
  const wallet = new ethers.Wallet(hexPrivateKey);

  // Get the public address (public key)
  const publicKey = wallet.address;

  return {
    account: wallet,
    publicKey: publicKey,
    privateKey: hexPrivateKey,
  };
}

/**
 * Funzione per ottenere il signer
 * @returns {Promise<ethers.Signer>} Il signer.
 */
const getSigner = async () => {
  if (rpcUrl && privateKey) {
    // Modalità standalone con provider locale
    const provider = new ethers.JsonRpcProvider(rpcUrl, {
      chainId: 31337,
      name: "localhost"
    });
    return new ethers.Wallet(privateKey, provider);
  } else if (
    typeof window !== "undefined" &&
    typeof window.ethereum !== "undefined"
  ) {
    // Modalità browser
    await window.ethereum.request({ method: "eth_requestAccounts" });
    const provider = new ethers.BrowserProvider(window.ethereum);
    return provider.getSigner();
  } else {
    throw new Error("No valid Ethereum provider found");
  }
};

/**
 * Sets standalone configuration for Gun.
 * @param {string} newRpcUrl - The new RPC URL.
 * @param {string} newPrivateKey - The new private key.
 * @returns {Gun} The Gun instance for chaining.
 */
Gun.chain.setSigner = function (newRpcUrl, newPrivateKey) {
  rpcUrl = newRpcUrl;
  privateKey = newPrivateKey;
  console.log("Standalone configuration set");
  return this;
};

/**
 * Verifies an Ethereum signature.
 * @param {string} message - The original message that was signed.
 * @param {string} signature - The signature to verify.
 * @returns {Promise<string|null>} The recovered address or null if verification fails.
 */
Gun.chain.verifySignature = async function (message, signature) {
  try {
    const recoveredAddress = ethers.verifyMessage(message, signature);
    return recoveredAddress;
  } catch (error) {
    console.error("Error verifying signature:", error);
    return null;
  }
};

/**
 * Generates a password from a signature.
 * @param {string} signature - The signature to derive the password from.
 * @returns {string|null} The generated password or null if generation fails.
 */
Gun.chain.generatePassword = function (signature) {
  return generatePassword(signature);
};

/**
 * Creates an Ethereum signature for a given message.
 * @param {string} message - The message to sign.
 * @returns {Promise<string|null>} The signature or null if signing fails.
 */
Gun.chain.createSignature = async function (message) {
  try {
    // Verifica se il messaggio è uguale a MESSAGE_TO_SIGN
    if (message !== MESSAGE_TO_SIGN) {
      throw new Error("Invalid message, valid message is: " + MESSAGE_TO_SIGN);
    }
    const signer = await getSigner();
    const signature = await signer.signMessage(message);
    console.log("Signature created:", signature);
    return signature;
  } catch (error) {
    console.error("Error creating signature:", error);
    return null;
  }
};

/**
 * Creates and stores an encrypted key pair for a given address.
 * @param {string} address - The Ethereum address to associate with the key pair.
 * @param {string} signature - The signature to use for encryption.
 * @returns {Promise<void>}
 */
Gun.chain.createAndStoreEncryptedPair = async function (address, signature) {
  try {
    const gun = this;
    const pair = await SEA.pair();
    const v_pair = await SEA.pair();
    const s_pair = await SEA.pair();
    const password = generatePassword(signature);

    // Salva le coppie originali SEA
    const encryptedPair = await SEA.encrypt(JSON.stringify(pair), password);
    const encryptedV_pair = await SEA.encrypt(JSON.stringify(v_pair), password);
    const encryptedS_pair = await SEA.encrypt(JSON.stringify(s_pair), password);

    // Converti solo per ottenere gli indirizzi Ethereum
    const viewingAccount = gunToEthAccount(v_pair.priv);
    const spendingAccount = gunToEthAccount(s_pair.priv);

    await gun.get("gun-eth").get("users").get(address).put({
      pair: encryptedPair,
      v_pair: encryptedV_pair,
      s_pair: encryptedS_pair,
      publicKeys: {
        viewingPublicKey: v_pair.epub, // Usa la chiave pubblica di crittografia SEA
        spendingPublicKey: spendingAccount.publicKey, // Usa l'indirizzo Ethereum
        ethViewingAddress: viewingAccount.publicKey // Salva anche l'indirizzo Ethereum
      }
    });

    console.log("Encrypted pairs and public keys stored for:", address);
  } catch (error) {
    console.error("Error creating and storing encrypted pair:", error);
    throw error;
  }
};

/**
 * Retrieves and decrypts a stored key pair for a given address.
 * @param {string} address - The Ethereum address associated with the key pair.
 * @param {string} signature - The signature to use for decryption.
 * @returns {Promise<Object|null>} The decrypted key pair or null if retrieval fails.
 */
Gun.chain.getAndDecryptPair = async function (address, signature) {
  try {
    const gun = this;
    const encryptedData = await gun
      .get("gun-eth")
      .get("users")
      .get(address)
      .get("pair")
      .then();
    if (!encryptedData) {
      throw new Error("No encrypted data found for this address");
    }
    const decryptedPair = await SEA.decrypt(encryptedData, signature);
    console.log(decryptedPair);
    return decryptedPair;
  } catch (error) {
    console.error("Error retrieving and decrypting pair:", error);
    return null;
  }
};

/**
 * Proof of Integrity
 * @param {string} chain - The blockchain to use (e.g., "optimismSepolia").
 * @param {string} nodeId - The ID of the node to verify or write.
 * @param {Object} data - The data to write (if writing).
 * @param {Function} callback - Callback function to handle the result.
 * @returns {Gun} The Gun instance for chaining.
 */
Gun.chain.proof = function (chain, nodeId, data, callback) {
  console.log("Proof plugin called with:", { chain, nodeId, data });

  if (typeof callback !== "function") {
    console.error("Callback must be a function");
    return this;
  }

  const gun = this;

  // Seleziona l'indirizzo basato sulla catena
  if (chain === "optimismSepolia") {
    SHINE_CONTRACT_ADDRESS = SHINE_OPTIMISM_SEPOLIA;
  } else {
    throw new Error("Chain not supported");
  }
  // Funzione per verificare on-chain
  const verifyOnChain = async (nodeId, contentHash) => {
    console.log("Verifying on chain:", { nodeId, contentHash });
    const signer = await getSigner();
    const contract = new ethers.Contract(
      SHINE_CONTRACT_ADDRESS,
      SHINE_ABI,
      signer
    );
    const [isValid, timestamp, updater] = await contract.verifyData(
      ethers.toUtf8Bytes(nodeId),
      contentHash
    );
    console.log("Verification result:", { isValid, timestamp, updater });
    return { isValid, timestamp, updater };
  };

  // Funzione per scrivere on-chain
  const writeOnChain = async (nodeId, contentHash) => {
    console.log("Writing on chain:", { nodeId, contentHash });
    const signer = await getSigner();
    const contract = new ethers.Contract(
      SHINE_CONTRACT_ADDRESS,
      SHINE_ABI,
      signer
    );
    const tx = await contract.updateData(
      ethers.toUtf8Bytes(nodeId),
      contentHash
    );
    console.log("Transaction sent:", tx.hash);
    const receipt = await tx.wait();
    console.log("Transaction confirmed:", receipt);
    return tx;
  };

  // Nuova funzione per ottenere l'ultimo record dalla blockchain
  const getLatestRecord = async (nodeId) => {
    const signer = await getSigner();
    const contract = new ethers.Contract(
      SHINE_CONTRACT_ADDRESS,
      SHINE_ABI,
      signer
    );
    const [contentHash, timestamp, updater] = await contract.getLatestRecord(
      ethers.toUtf8Bytes(nodeId)
    );
    console.log("Latest record from blockchain:", {
      nodeId,
      contentHash,
      timestamp,
      updater,
    });
    return { contentHash, timestamp, updater };
  };

  // Processo SHINE
  if (nodeId && !data) {
    // Caso 1: Utente passa solo il nodo
    gun.get(nodeId).once(async (existingData) => {
      if (!existingData) {
        if (callback) callback({ err: "Node not found in GunDB" });
        return;
      }

      console.log("existingData", existingData);

      // Usa il contentHash memorizzato invece di ricalcolarlo
      const contentHash = existingData._contentHash;
      console.log("contentHash", contentHash);

      if (!contentHash) {
        if (callback) callback({ err: "No content hash found for this node" });
        return;
      }

      try {
        const { isValid, timestamp, updater } = await verifyOnChain(
          nodeId,
          contentHash
        );
        const latestRecord = await getLatestRecord(nodeId);

        if (isValid) {
          if (callback)
            callback({
              ok: true,
              message: "Data verified on blockchain",
              timestamp,
              updater,
              latestRecord,
            });
        } else {
          if (callback)
            callback({
              ok: false,
              message: "Data not verified on blockchain",
              latestRecord,
            });
        }
      } catch (error) {
        if (callback) callback({ err: error.message });
      }
    });
  } else if (data && !nodeId) {
    // Caso 2: Utente passa solo il testo (data)
    const newNodeId = Gun.text.random();
    const dataString = JSON.stringify(data);
    const contentHash = ethers.keccak256(ethers.toUtf8Bytes(dataString));

    gun
      .get(newNodeId)
      .put({ ...data, _contentHash: contentHash }, async (ack) => {
        console.log("ack", ack);
        if (ack.err) {
          if (callback) callback({ err: "Error saving data to GunDB" });
          return;
        }

        try {
          const tx = await writeOnChain(newNodeId, contentHash);
          if (callback)
            callback({
              ok: true,
              message: "Data written to GunDB and blockchain",
              nodeId: newNodeId,
              txHash: tx.hash,
            });
        } catch (error) {
          if (callback) callback({ err: error.message });
        }
      });
  } else {
    if (callback)
      callback({
        err: "Invalid input. Provide either nodeId or data, not both.",
      });
  }

  return gun;
};

/**
 * Converts a Gun private key to an Ethereum account.
 * @param {string} gunPrivateKey - The Gun private key in base64url format.
 * @returns {Object} An object containing the Ethereum account and public key.
 */
Gun.chain.gunToEthAccount = function (gunPrivateKey) {
  return gunToEthAccount(gunPrivateKey);
};

/**
 * Funzione di utilità per generare l'indirizzo stealth
 * @param {string} sharedSecret - Il segreto condiviso
 * @param {string} spendingPublicKey - La chiave pubblica di spesa
 * @returns {Object} L'indirizzo stealth e la chiave privata
 */
function deriveStealthAddress(sharedSecret, spendingPublicKey) {
  try {
    // Converti il segreto condiviso in bytes
    const sharedSecretBytes = Buffer.from(sharedSecret, 'base64');
    
    // Genera la chiave privata stealth usando il segreto condiviso e la spending public key
    const stealthPrivateKey = ethers.keccak256(
      ethers.concat([
        sharedSecretBytes,
        ethers.getBytes(spendingPublicKey)
      ])
    );
    
    // Crea il wallet stealth
    const stealthWallet = new ethers.Wallet(stealthPrivateKey);

    console.log("Debug deriveStealthAddress:", {
      sharedSecretHex: ethers.hexlify(sharedSecretBytes),
      spendingPublicKey,
      stealthPrivateKey,
      stealthAddress: stealthWallet.address
    });

    return {
      stealthPrivateKey,
      stealthAddress: stealthWallet.address,
      wallet: stealthWallet
    };
  } catch (error) {
    console.error("Error in deriveStealthAddress:", error);
    throw error;
  }
}

/**
 * Genera una chiave stealth e le relative coppie di chiavi
 * @param {string} recipientAddress - L'indirizzo Ethereum del destinatario
 * @param {string} signature - La firma del sender per accedere alle proprie chiavi
 * @returns {Promise<Object>} Oggetto contenente gli indirizzi stealth e le chiavi
 */
Gun.chain.generateStealthAddress = async function (recipientAddress, signature) {
  try {
    const gun = this;
    
    // Recupera le chiavi pubbliche del destinatario
    const recipientData = await gun
      .get("gun-eth")
      .get("users")
      .get(recipientAddress)
      .get("publicKeys")
      .then();

    if (!recipientData || !recipientData.viewingPublicKey || !recipientData.spendingPublicKey) {
      throw new Error("Chiavi pubbliche del destinatario non trovate");
    }

    // Recupera le proprie chiavi (sender)
    const senderAddress = await this.verifySignature(MESSAGE_TO_SIGN, signature);
    const password = generatePassword(signature);
    
    const senderData = await gun
      .get("gun-eth")
      .get("users")
      .get(senderAddress)
      .then();

    if (!senderData || !senderData.s_pair) {
      throw new Error("Chiavi del sender non trovate");
    }

    // Decripta la spending pair del sender
    let spendingKeyPair;
    try {
      const decryptedData = await SEA.decrypt(senderData.s_pair, password);
      spendingKeyPair = typeof decryptedData === 'string' ? 
        JSON.parse(decryptedData) : 
        decryptedData;
    } catch (error) {
      console.error("Errore nella decrittazione della spending pair:", error);
      throw new Error("Impossibile decrittare la spending pair");
    }

    // Genera il segreto condiviso usando SEA ECDH con la chiave pubblica di crittografia
    const sharedSecret = await SEA.secret(recipientData.viewingPublicKey, spendingKeyPair);

    if (!sharedSecret) {
      throw new Error("Impossibile generare il segreto condiviso");
    }

    console.log("Generate shared secret:", sharedSecret);

    const { stealthAddress } = deriveStealthAddress(
      sharedSecret,
      recipientData.spendingPublicKey
    );

    return {
      stealthAddress,
      senderPublicKey: spendingKeyPair.epub, // Usa la chiave pubblica di crittografia
      spendingPublicKey: recipientData.spendingPublicKey
    };

  } catch (error) {
    console.error("Errore nella generazione dell'indirizzo stealth:", error);
    throw error;
  }
};

/**
 * Pubblica le chiavi pubbliche necessarie per ricevere pagamenti stealth
 * @param {string} signature - La firma per autenticare l'utente
 * @returns {Promise<void>}
 */
Gun.chain.publishStealthKeys = async function (signature) {
  try {
    const gun = this;
    const address = await this.verifySignature(MESSAGE_TO_SIGN, signature);
    const password = generatePassword(signature);

    // Recupera le proprie coppie di chiavi criptate
    const encryptedData = await gun
      .get("gun-eth")
      .get("users")
      .get(address)
      .then();

    if (!encryptedData || !encryptedData.v_pair || !encryptedData.s_pair) {
      throw new Error("Chiavi non trovate");
    }

    // Decripta le coppie viewing e spending
    const viewingKeyPair = JSON.parse(
      await SEA.decrypt(encryptedData.v_pair, password)
    );
    const spendingKeyPair = JSON.parse(
      await SEA.decrypt(encryptedData.s_pair, password)
    );

    const viewingAccount = gunToEthAccount(viewingKeyPair.priv);
    const spendingAccount = gunToEthAccount(spendingKeyPair.priv);

    // Pubblica solo le chiavi pubbliche
    await gun.get("gun-eth").get("users").get(address).get("publicKeys").put({
      viewingPublicKey: viewingAccount.publicKey,
      spendingPublicKey: spendingAccount.publicKey,
    });

    console.log("Chiavi pubbliche stealth pubblicate con successo");
  } catch (error) {
    console.error("Errore nella pubblicazione delle chiavi stealth:", error);
    throw error;
  }
};

/**
 * Recupera i fondi da un indirizzo stealth
 * @param {string} stealthAddress - L'indirizzo stealth da cui recuperare i fondi
 * @param {string} senderPublicKey - La chiave pubblica del sender usata per generare l'indirizzo
 * @param {string} signature - La firma per decifrare le chiavi private
 * @returns {Promise<Object>} Oggetto contenente il wallet per accedere ai fondi
 */
Gun.chain.recoverStealthFunds = async function (
  stealthAddress,
  senderPublicKey,
  signature,
  spendingPublicKey
) {
  try {
    const gun = this;
    const password = generatePassword(signature);

    // Recupera le proprie coppie di chiavi
    const myAddress = await this.verifySignature(MESSAGE_TO_SIGN, signature);
    const encryptedData = await gun
      .get("gun-eth")
      .get("users")
      .get(myAddress)
      .then();

    if (!encryptedData || !encryptedData.v_pair || !encryptedData.s_pair) {
      throw new Error("Chiavi non trovate");
    }

    // Decripta le coppie viewing e spending
    let viewingKeyPair;
    try {
      const decryptedViewingData = await SEA.decrypt(encryptedData.v_pair, password);
      viewingKeyPair = typeof decryptedViewingData === 'string' ? 
        JSON.parse(decryptedViewingData) : 
        decryptedViewingData;
    } catch (error) {
      console.error("Errore nella decrittazione delle chiavi:", error);
      throw new Error("Impossibile decrittare le chiavi");
    }

    // Genera il segreto condiviso usando SEA ECDH
    const sharedSecret = await SEA.secret(senderPublicKey, viewingKeyPair);

    if (!sharedSecret) {
      throw new Error("Impossibile generare il segreto condiviso");
    }

    console.log("Recover shared secret:", sharedSecret);

    const { wallet, stealthAddress: recoveredAddress } = deriveStealthAddress(
      sharedSecret,
      spendingPublicKey
    );

    // Verifica che l'indirizzo corrisponda
    if (recoveredAddress.toLowerCase() !== stealthAddress.toLowerCase()) {
      console.error("Mismatch:", {
        recovered: recoveredAddress,
        expected: stealthAddress,
        sharedSecret
      });
      throw new Error("L'indirizzo stealth recuperato non corrisponde");
    }

    return {
      wallet,
      address: recoveredAddress,
    };
  } catch (error) {
    console.error("Errore nel recupero dei fondi stealth:", error);
    throw error;
  }
};

/**
 * Annuncia un pagamento stealth
 * @param {string} stealthAddress - L'indirizzo stealth generato
 * @param {string} senderPublicKey - La chiave pubblica del mittente
 * @param {string} spendingPublicKey - La chiave pubblica di spesa
 * @param {string} signature - La firma del mittente
 * @returns {Promise<void>}
 */
Gun.chain.announceStealthPayment = async function (
  stealthAddress,
  senderPublicKey,
  spendingPublicKey,
  signature,
  options = { onChain: false }
) {
  try {
    const gun = this;
    const senderAddress = await this.verifySignature(MESSAGE_TO_SIGN, signature);

    if (options.onChain) {
      // Annuncio on-chain
      const signer = await getSigner();
      const contractAddress = process.env.NODE_ENV === 'development' 
        ? LOCAL_CONFIG.STEALTH_ANNOUNCER_ADDRESS 
        : STEALTH_ANNOUNCER_ADDRESS;

      console.log("Using contract address:", contractAddress);

      const contract = new ethers.Contract(
        contractAddress,
        STEALTH_ANNOUNCER_ABI,
        signer
      );

      // Ottieni la dev fee dal contratto
      const devFee = await contract.devFee();
      console.log("Dev fee:", devFee.toString());

      // Chiama il contratto
      const tx = await contract.announcePayment(
        senderPublicKey,
        spendingPublicKey,
        stealthAddress,
        { value: devFee }
      );
      
      console.log("Transaction sent:", tx.hash);
      const receipt = await tx.wait();
      console.log("Transaction confirmed:", receipt.hash);
      
      console.log("Pagamento stealth annunciato on-chain (dev fee pagata)");
    } else {
      // Annuncio off-chain (GunDB)
      await gun
        .get("gun-eth")
        .get("stealth-payments")
        .set({
          stealthAddress,
          senderAddress,
          senderPublicKey,
          spendingPublicKey,
          timestamp: Date.now(),
        });
      console.log("Pagamento stealth annunciato off-chain");
    }
  } catch (error) {
    console.error("Errore nell'annuncio del pagamento stealth:", error);
    console.error("Error details:", error.stack);
    throw error;
  }
};

/**
 * Recupera tutti i pagamenti stealth per un indirizzo
 * @param {string} signature - La firma per autenticare l'utente
 * @returns {Promise<Array>} Lista dei pagamenti stealth
 */
Gun.chain.getStealthPayments = async function (signature, options = { source: 'both' }) {
  try {
    const payments = [];

    if (options.source === 'onChain' || options.source === 'both') {
      // Recupera pagamenti on-chain
      const signer = await getSigner();
      const contractAddress = process.env.NODE_ENV === 'development' 
        ? LOCAL_CONFIG.STEALTH_ANNOUNCER_ADDRESS 
        : STEALTH_ANNOUNCER_ADDRESS;

      const contract = new ethers.Contract(
        contractAddress,
        STEALTH_ANNOUNCER_ABI,
        signer
      );
      
      try {
        // Ottieni il numero totale di annunci
        const totalAnnouncements = await contract.getAnnouncementsCount();
        const total = Number(totalAnnouncements);
        console.log("Totale annunci on-chain:", total);
        
        if (total > 0) {
          // Recupera gli annunci in batch di 100
          const batchSize = 100;
          const lastIndex = total - 1;
          
          for(let i = 0; i <= lastIndex; i += batchSize) {
            const toIndex = Math.min(i + batchSize - 1, lastIndex);
            const batch = await contract.getAnnouncementsInRange(i, toIndex);
            
            // Per ogni annuncio, prova a decrittare
            for(const announcement of batch) {
              try {
                // Verifica che l'annuncio sia valido
                if (!announcement || !announcement.stealthAddress || 
                    !announcement.senderPublicKey || !announcement.spendingPublicKey) {
                  console.log("Annuncio invalido:", announcement);
                  continue;
                }

                // Prova a recuperare i fondi per verificare se l'annuncio è per noi
                const recoveredWallet = await this.recoverStealthFunds(
                  announcement.stealthAddress,
                  announcement.senderPublicKey,
                  signature,
                  announcement.spendingPublicKey
                );
                
                // Se non lancia errori, l'annuncio è per noi
                payments.push({
                  stealthAddress: announcement.stealthAddress,
                  senderPublicKey: announcement.senderPublicKey,
                  spendingPublicKey: announcement.spendingPublicKey,
                  timestamp: Number(announcement.timestamp),
                  source: 'onChain',
                  wallet: recoveredWallet
                });

              } catch (e) {
                // Non è per noi, continua
                console.log(`Annuncio non per noi: ${announcement.stealthAddress}`);
                continue;
              }
            }
          }
        }
      } catch (error) {
        console.error("Errore nel recupero degli annunci on-chain:", error);
      }
    }

    if (options.source === 'offChain' || options.source === 'both') {
      // Recupera pagamenti off-chain
      const gun = this;
      const offChainPayments = await new Promise((resolve) => {
        const p = [];
        gun
          .get("gun-eth")
          .get("stealth-payments")
          .get(recipientAddress)
          .map()
          .once((payment, id) => {
            if (payment?.stealthAddress) {
              p.push({ ...payment, id, source: 'offChain' });
            }
          });
        setTimeout(() => resolve(p), 2000);
      });
      
      payments.push(...offChainPayments);
    }

    console.log(`Trovati ${payments.length} pagamenti stealth`);
    return payments;
  } catch (error) {
    console.error("Errore nel recupero dei pagamenti stealth:", error);
    throw error;
  }
};

/**
 * Pulisce i vecchi pagamenti stealth
 * @param {string} recipientAddress - L'indirizzo del destinatario
 * @returns {Promise<void>}
 */
Gun.chain.cleanStealthPayments = async function(recipientAddress) {
  try {
    const gun = this;
    const payments = await gun
      .get("gun-eth")
      .get("stealth-payments")
      .get(recipientAddress)
      .map()
      .once()
      .then();

    // Rimuovi i nodi vuoti o invalidi
    if (payments) {
      Object.keys(payments).forEach(async (key) => {
        const payment = payments[key];
        if (!payment || !payment.stealthAddress || !payment.senderPublicKey || !payment.spendingPublicKey) {
          await gun
            .get("gun-eth")
            .get("stealth-payments")
            .get(recipientAddress)
            .get(key)
            .put(null);
        }
      });
    }
  } catch (error) {
    console.error("Errore nella pulizia dei pagamenti stealth:", error);
  }
};

export default Gun;
