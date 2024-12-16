// @ts-check

import { ethers } from "ethers";
import Gun from "gun/gun";
import "gun/sea.js";
import "gun/lib/then.js";
import "gun/lib/load.js";
import "gun/lib/open.js";
import "gun/lib/radix.js";
import "gun/lib/radisk.js";
import "gun/lib/store.js";
import "gun/lib/rindexed.js";
import { encrypt, decrypt, encryptWithPassword, decryptWithPassword } from './utils/encryption.js';
import { 
  generateRandomId,
  getSigner as getCommonSigner,
  setSigner as setCommonSigner
} from './utils/common.js';
import { StealthChain } from './features/StealthChain.js';

/**
 * @typedef {Object} EthereumProvider
 * @property {function} request - Metodo per fare richieste a Ethereum
 */

/**
 * @type {Window & { ethereum?: EthereumProvider }}
 */
const windowWithEthereum = window;

const SEA = Gun.SEA;

/**
 * @typedef {import('gun').IGunChain<any, any, any, any>} IGunChain
 * @typedef {import('gun').IGunInstance} IGunInstance
 * @typedef {import('gun').IGun} IGun
 * @typedef {import('gun').GunOptions} GunOptions
 */

/**
 * @typedef {Object} ExtendedSigner
 * @property {string} address - Ethereum address
 * @property {string} privateKey - Private key
 * @property {function(string): Promise<string>} signMessage - Signs a message
 * @property {function(): Promise<string>} getAddress - Gets the signer address
 * @property {Object} provider - Provider instance
 */

/**
 * @typedef {Object} BaseMethods
 * @property {string} MESSAGE_TO_SIGN - Messaggio da firmare per l'autenticazione
 * @property {function(string, string): Promise<ExtendedSigner>} setSigner - Imposta il signer
 * @property {function(): Promise<ExtendedSigner>} getSigner - Ottiene il signer corrente
 * @property {function(string, string): Promise<string>} verifySignature - Verifica una firma
 * @property {function(string): string} generatePassword - Genera una password da una firma
 * @property {function(string): Promise<string>} createSignature - Crea una firma
 * @property {function(string): Promise<Object>} createAndStoreEncryptedPair - Crea e salva una coppia di chiavi cifrata
 * @property {function(string, string): Promise<Object>} getAndDecryptPair - Ottiene e decifra una coppia di chiavi
 * @property {function(): Promise<Object>} ethToGunAccount - Converte un account Ethereum in un account Gun
 * @property {function(string): Promise<Object>} gunToEthAccount - Converte un account Gun in un account Ethereum
 * @property {function(string, string): Promise<Object>} decryptWithPassword - Decifra dati con una password
 * @property {function(Object, string): Promise<string>} encryptWithPassword - Cifra dati con una password
 * @property {function(Object, Object): Promise<string>} encrypt - Cifra dati con una coppia di chiavi
 * @property {function(string, Object): Promise<Object>} decrypt - Decifra dati con una coppia di chiavi
 */

const MESSAGE_TO_SIGN = "Access GunDB with Ethereum";

let testSigner = null;

// =============================================
// UTILITY FUNCTIONS
// =============================================

/**
 * @param {string} newRpcUrl
 * @param {string} newPrivateKey
 */
function setSigner(newRpcUrl, newPrivateKey) {
  return setCommonSigner(newRpcUrl, newPrivateKey);
}

async function getSigner() {
  try {
    if (testSigner) {
      return testSigner;
    }

    if (!windowWithEthereum.ethereum) {
      throw new Error("MetaMask non trovato");
    }

    // Utilizziamo eth_accounts invece di selectedAddress
    const accounts = await windowWithEthereum.ethereum.request({
      method: 'eth_accounts'
    });

    if (!accounts || accounts.length === 0) {
      // Se non ci sono account, richiediamo l'accesso
      await windowWithEthereum.ethereum.request({
        method: 'eth_requestAccounts'
      });
    }

    const provider = new ethers.BrowserProvider(windowWithEthereum.ethereum);
    const signer = await provider.getSigner();

    if (!signer) {
      throw new Error("Impossibile ottenere il signer");
    }

    return signer;
  } catch (error) {
    console.error("Errore nell'ottenere il signer:", error);
    throw error;
  }
}

// Cache per le password generate
const passwordCache = new Map();

/**
 * Genera una password da una firma
 * @param {string | Uint8Array} signature - La firma da cui generare la password
 * @returns {string | null} La password generata o null in caso di errore
 */
function generatePassword(signature) {
  try {
    if (!signature) {
      throw new Error("Firma non valida");
    }

    // Controlla se la password è già in cache
    const cacheKey = signature instanceof Uint8Array ? 
      ethers.hexlify(signature) : 
      signature;
    
    if (passwordCache.has(cacheKey)) {
      return passwordCache.get(cacheKey);
    }
    
    let signatureBytes;
    if (signature instanceof Uint8Array) {
      signatureBytes = signature;
    } else if (typeof signature === 'string') {
      // Se la firma è una stringa hex, convertiamola in bytes
      if (signature.startsWith('0x')) {
        signatureBytes = ethers.getBytes(signature);
      } else {
        // Se non è hex, prima convertiamo in UTF8 bytes
        signatureBytes = ethers.toUtf8Bytes(signature);
      }
    } else {
      throw new Error("Tipo di firma non supportato");
    }
    
    // Generiamo un hash dai bytes della firma usando keccak256
    const hash = ethers.keccak256(signatureBytes);
    
    // Rimuoviamo il prefisso 0x e usiamo solo i primi 32 bytes per la password
    const password = hash.slice(2, 66);
    
    // Salviamo in cache
    passwordCache.set(cacheKey, password);
    
    return password;
  } catch (error) {
    console.error("Errore nella generazione della password:", error);
    return null;
  }
}

/**
 * @param {string | Uint8Array} message - Il messaggio originale
 * @param {ethers.SignatureLike} signature - La firma da verificare
 * @returns {Promise<string|null>} L'indirizzo recuperato o null in caso di errore
 */
async function verifySignature(message, signature) {
  try {
    if (!message) {
      throw new Error("Messaggio non valido");
    }

    if (!signature) {
      throw new Error("Firma non valida");
    }

    // Convertiamo il messaggio in formato corretto se necessario
    let messageBytes;
    if (message instanceof Uint8Array) {
      messageBytes = message;
    } else if (typeof message === 'string') {
      messageBytes = ethers.toUtf8Bytes(message);
    } else {
      throw new Error("Formato messaggio non supportato");
    }

    // Verifichiamo la firma
    const recoveredAddress = ethers.verifyMessage(messageBytes, signature);
    
    if (!ethers.isAddress(recoveredAddress)) {
      throw new Error("Indirizzo recuperato non valido");
    }

    return recoveredAddress;
  } catch (error) {
    console.error("Errore nella verifica della firma:", error);
    return null;
  }
}

async function convertToEthAddress(gunPrivateKey) {
	const base64UrlToHex = (base64url) => {
		try {
		  const padding = "=".repeat((4 - (base64url.length % 4)) % 4);
		  const base64 = base64url.replace(/-/g, "+").replace(/_/g, "/") + padding;
		  const binary = atob(base64);
		  const hex = Array.from(binary, (char) =>
			char.charCodeAt(0).toString(16).padStart(2, "0")
		  ).join("");
		  
		  if (hex.length !== 64) {
			throw new Error("Lunghezza chiave privata non valida");
		  }
		  return hex;
		} catch (error) {
		  console.error("Errore nella conversione base64Url to hex:", error);
		  throw new Error("Impossibile convertire la chiave privata");
		}
	  };
  
	  const hexPrivateKey = "0x" + base64UrlToHex(gunPrivateKey);
	  return hexPrivateKey;
}

/**
 * @param {string} gunPrivateKey
 * @param {boolean} [isSecondary=false] - Flag per indicare se è un account secondario
 * @returns {Promise<Object>} Account convertito
 * @throws {Error} Se la conversione fallisce
 */
async function gunToEthAccount(gunPrivateKey) {
  try {
    if (!gunPrivateKey || typeof gunPrivateKey !== 'string') {
      throw new Error("Chiave privata Gun non valida");
    }

    const hexPrivateKey = await convertToEthAddress(gunPrivateKey);
    
    if (!ethers.isHexString(hexPrivateKey, 32)) {
      throw new Error("Chiave privata non valida dopo la conversione");
    }
    
    const wallet = new ethers.Wallet(hexPrivateKey);

    // Per l'account principale, procediamo con la creazione completa
    const [pair, v_pair, s_pair] = await Promise.all([
      SEA.pair(),
      SEA.pair(),
      SEA.pair()
    ]);

    if (!pair || !v_pair || !s_pair) {
      throw new Error("Impossibile generare le coppie di chiavi Gun");
    }

    const signature = await wallet.signMessage(MESSAGE_TO_SIGN);
    const password = generatePassword(signature);

    if (!password) {
      throw new Error("Impossibile generare la password");
    }

    const [encryptedPair, encryptedV_pair, encryptedS_pair] = await Promise.all([
      encryptWithPassword(pair, password),
      encryptWithPassword(v_pair, password),
      encryptWithPassword(s_pair, password)
    ]);

    if (!encryptedPair || !encryptedV_pair || !encryptedS_pair) {
      throw new Error("Impossibile cifrare le coppie di chiavi");
    }

    return {
      account: wallet,
      publicKey: wallet.address,
      privateKey: hexPrivateKey,
      pair,
      v_pair,
      s_pair,
      ethAddress: wallet.address,
      ethPrivateKey: hexPrivateKey,
      env_pair: encryptedPair,
      env_v_pair: encryptedV_pair,
      env_s_pair: encryptedS_pair,
      publicKeys: {
        viewingPublicKey: v_pair.epub,
        spendingPublicKey: s_pair.epub,
        ethViewingAddress: wallet.address,
      },
      password
    };
  } catch (error) {
    console.error("Errore in gunToEthAccount:", error);
    throw error;
  }
}

/**
 * @param {string} encryptedPair - La coppia di chiavi cifrata
 * @param {Object} keypair - La coppia di chiavi per la decifratura
 * @returns {Promise<Object|null>} La coppia di chiavi decifrata o null in caso di errore
 */
async function decryptPair(encryptedPair, keypair) {
  try {
    if (!encryptedPair || !keypair) {
      throw new Error("Parametri mancanti per la decifratura");
    }
    
    // Verifica che il keypair abbia i campi necessari
    if (!keypair.pub || !keypair.priv || !keypair.epub || !keypair.epriv) {
      throw new Error("Keypair non valido: campi mancanti");
    }
    
    const decrypted = await decrypt(encryptedPair, keypair);
    if (!decrypted) {
      throw new Error("Decifratura fallita");
    }

    // Verifica che il risultato decifrato sia nel formato corretto
    if (!decrypted.pub || !decrypted.priv || !decrypted.epub || !decrypted.epriv) {
      throw new Error("Risultato decifratura non valido: campi mancanti");
    }
    
    return decrypted;
  } catch (error) {
    console.error("Errore nella decifratura della coppia di chiavi:", error);
    return null;
  }
}

async function ethToGunAccount(isSecondary = false) {
  try {
    if (!windowWithEthereum.ethereum) {
      throw new Error("MetaMask non trovato");
    }

    // Otteniamo il signer e la firma
    const signer = await getSigner();
    const signature = await createSignature(MESSAGE_TO_SIGN);

    if (!signature) {
      throw new Error("Firma non generata");
    }

    const password = generatePassword(signature);
    if (!password) {
      throw new Error("Impossibile generare la password");
    }

    // Se è un account secondario, creiamo solo il wallet base
    if (isSecondary) {
      const randomBytes = ethers.randomBytes(32);
      if (!randomBytes || randomBytes.length !== 32) {
        throw new Error("Generazione bytes casuali fallita");
      }
      const wallet = new ethers.Wallet(ethers.hexlify(randomBytes));
      return {
        publicKey: wallet.address,
        address: wallet.address
      };
    }

    // Per l'account principale, procediamo con la creazione completa
    const [pair, v_pair, s_pair] = await Promise.all([
      SEA.pair(),
      SEA.pair(),
      SEA.pair()
    ]);

    if (!pair || !v_pair || !s_pair) {
      throw new Error("Impossibile generare le coppie di chiavi");
    }

    // Cifriamo le coppie di chiavi in parallelo
    const [encryptedPair, encryptedV_pair, encryptedS_pair] = await Promise.all([
      encryptWithPassword(pair, password),
      encryptWithPassword(v_pair, password),
      encryptWithPassword(s_pair, password)
    ]);

    if (!encryptedPair || !encryptedV_pair || !encryptedS_pair) {
      throw new Error("Impossibile cifrare le coppie di chiavi");
    }

    // Creiamo gli account secondari con il flag isSecondary
    const [viewingWallet, spendingWallet] = await Promise.all([
      ethToGunAccount(true),
      ethToGunAccount(true)
    ]);

    return {
      pair,
      v_pair,
      s_pair,
      ethAddress: signer.address,
      ethPrivateKey: null, // Non esponiamo la chiave privata per sicurezza
      env_pair: encryptedPair,
      env_v_pair: encryptedV_pair,
      env_s_pair: encryptedS_pair,
      publicKeys: {
        viewingPublicKey: v_pair.epub,
        spendingPublicKey: spendingWallet.publicKey,
        ethViewingAddress: viewingWallet.publicKey,
      },
      password
    };
  } catch (error) {
    console.error("Errore in ethToGunAccount:", error);
    throw error;
  }
}

/**
 * @param {any} address
 */
async function createAndStoreEncryptedPair(address) {
  try {
    if (!address || typeof address !== 'string') {
      throw new Error("Indirizzo non valido");
    }

    const gun = this;
    const account = await ethToGunAccount();
    
    if (!account || !account.pair) {
      throw new Error("Impossibile creare l'account");
    }

    const { env_pair, env_v_pair, env_s_pair, publicKeys } = account;

    // Salviamo i dati cifrati e attendiamo la conferma
    await new Promise((resolve, reject) => {
      let timeoutId = setTimeout(() => {
        reject(new Error("Timeout storing encrypted data"));
      }, 5000); // 5 secondi di timeout

      const data = {
        env_pair,
        env_v_pair,
        env_s_pair,
        publicKeys
      };

      gun.get("gun-eth")
        .get("users")
        .get(address)
        .put(data, (ack) => {
          clearTimeout(timeoutId);
          if (ack.err) {
            console.error("Error storing data:", ack.err);
            reject(new Error(ack.err));
          } else {
            resolve(ack);
          }
        });
    });

    // Verifichiamo che i dati siano stati salvati
    await new Promise((resolve, reject) => {
      let timeoutId = setTimeout(() => {
        reject(new Error("Timeout verifying stored data"));
      }, 5000); // 5 secondi di timeout

      gun.get("gun-eth")
        .get("users")
        .get(address)
        .on((data) => {
          clearTimeout(timeoutId);
          if (data && data.env_pair) {
            resolve(data);
          } else {
            reject(new Error("Data verification failed"));
          }
        });
    });

    console.log("Encrypted pairs and public keys stored for:", address);
    return account;
  } catch (error) {
    console.error("Error creating and storing encrypted pair:", error);
    throw error;
  }
}

/**
 * @param {any} address
 * @param {any} password
 */
async function getAndDecryptPair(address, password) {
  try {
    console.log("[getAndDecryptPair] Inizio recupero per indirizzo:", address);
    console.log("[getAndDecryptPair] Password ricevuta:", typeof password, password ? password.substring(0, 10) + "..." : "assente");

    if (!address || !password) {
      throw new Error("Parametri mancanti: " + (!address ? "address" : "password"));
    }

    const gun = this;
    console.log("[getAndDecryptPair] Istanza Gun:", gun ? "presente" : "assente");

    // Otteniamo i dati cifrati
    console.log("[getAndDecryptPair] Inizio recupero dati cifrati...");
    const encryptedData = await new Promise((resolve, reject) => {
      let resolved = false;
      const timeoutId = setTimeout(() => {
        if (!resolved) {
        console.log("[getAndDecryptPair] Timeout nel recupero dati");
        reject(new Error("Timeout nel recupero dati dopo 5 secondi"));
        }
      }, 5000);

      console.log("[getAndDecryptPair] Query Gun:", "gun-eth/users/" + address);
      gun.get("gun-eth")
        .get("users")
        .get(address)
        .once((data, key) => {  // Cambiato da .on a .once
          console.log("[getAndDecryptPair] Dati ricevuti:", key, data ? "presenti" : "assenti");
          clearTimeout(timeoutId);
          
          if (!data) {
            console.log("[getAndDecryptPair] Nessun dato trovato");
            reject(new Error("Nessun dato trovato"));
            return;
          }
          
          if (!data.env_pair) {
            console.log("[getAndDecryptPair] env_pair mancante nei dati:", Object.keys(data));
            reject(new Error("env_pair non trovato nei dati"));
            return;
          }
          
          console.log("[getAndDecryptPair] env_pair trovato, lunghezza:", data.env_pair.length);
          console.log("[getAndDecryptPair] Primi 50 caratteri env_pair:", data.env_pair.substring(0, 50));
          resolved = true;
          resolve(data.env_pair);
        });
    });
      
    if (!encryptedData) {
      console.log("[getAndDecryptPair] Dati cifrati non trovati");
      throw new Error("Dati cifrati non trovati per questo indirizzo");
    }

    console.log("[getAndDecryptPair] Dati cifrati recuperati, lunghezza:", encryptedData.length);
    console.log("[getAndDecryptPair] Primi 50 caratteri dei dati cifrati:", encryptedData.substring(0, 50));

    // Decrittiamo i dati
    console.log("[getAndDecryptPair] Inizio decifratura con password:", password.substring(0, 10) + "...");
    try {
    const decryptedPair = await decryptWithPassword(encryptedData, password);
    console.log("[getAndDecryptPair] Risultato decifratura:", decryptedPair ? "successo" : "fallito");

    if (!decryptedPair) {
      throw new Error("Decifratura fallita - risultato nullo");
    }

    if (typeof decryptedPair !== 'object') {
      console.log("[getAndDecryptPair] Tipo risultato non valido:", typeof decryptedPair);
      throw new Error(`Formato coppia decifrata non valido: ${typeof decryptedPair}`);
    }

    // Verifichiamo che il pair abbia tutti i campi necessari
    const requiredFields = ['pub', 'priv', 'epub', 'epriv'];
    const missingFields = requiredFields.filter(field => !decryptedPair[field]);
    
    if (missingFields.length > 0) {
      console.log("[getAndDecryptPair] Campi mancanti:", missingFields);
      throw new Error(`Coppia decifrata mancante dei campi: ${missingFields.join(', ')}`);
    }

    console.log("[getAndDecryptPair] Verifica campi completata con successo");
      console.log("[getAndDecryptPair] Coppia decifrata:", {
        pub: decryptedPair.pub.substring(0, 20) + "...",
        priv: "***nascosta***",
        epub: decryptedPair.epub.substring(0, 20) + "...",
        epriv: "***nascosta***"
      });

    return decryptedPair;
    } catch (decryptError) {
      console.error("[getAndDecryptPair] Errore durante la decifratura:", decryptError);
      console.error("[getAndDecryptPair] Stack decifratura:", decryptError.stack);
      throw new Error(`Errore nella decifratura: ${decryptError.message}`);
    }
  } catch (error) {
    console.error("[getAndDecryptPair] Errore generale:", error.message);
    console.error("[getAndDecryptPair] Stack generale:", error.stack);
    throw error;
  }
}

/**
 * Crea una firma utilizzando MetaMask
 * @param {string} message - Messaggio da firmare
 * @returns {Promise<string>} Firma generata
 * @throws {Error} Se MetaMask non è disponibile o se la firma fallisce
 */
async function createSignature(message) {
  try {
    if (!windowWithEthereum.ethereum) {
      throw new Error("MetaMask non trovato");
    }

    if (!message) {
      throw new Error("Messaggio da firmare non valido");
    }

    // Prima verifichiamo se abbiamo già accesso
    let accounts = await windowWithEthereum.ethereum.request({ 
      method: 'eth_accounts' 
    });

    // Se non abbiamo accesso, lo richiediamo
    if (!accounts || accounts.length === 0) {
      accounts = await windowWithEthereum.ethereum.request({ 
      method: 'eth_requestAccounts' 
    });
    }

    if (!accounts || accounts.length === 0) {
      throw new Error("Nessun account MetaMask disponibile");
    }

    const address = accounts[0];
    
    // Prepariamo il messaggio in formato hex
    const messageHex = ethers.hexlify(ethers.toUtf8Bytes(message));
    
    // Firmiamo il messaggio
    const signature = await windowWithEthereum.ethereum.request({
      method: 'personal_sign',
      params: [messageHex, address]
    });

    if (!signature || typeof signature !== 'string') {
      throw new Error("Firma non valida");
    }

    return signature;
  } catch (error) {
    console.error("Errore nella creazione della firma:", error);
    throw error;
  }
}

// =============================================
// STEALTH METHODS
// =============================================

/**
 * @typedef {Object} StealthMethods
 * @property {function} generateStealthAddress
 * @property {function} announceStealthPayment
 * @property {function} getStealthPayments
 * @property {function} recoverStealthFunds
 * @property {function} publishStealthKeys
 */

/**
 * Estende Gun con i metodi stealth
 * @param {import("gun").IGun} Gun 
 */
function extendGunWithStealth(Gun) {
  const stealthMethods = {
    /**
     * Genera un indirizzo stealth
     * @param {string} recipientAddress 
     * @param {string} signature 
     */
    async generateStealthAddress(recipientAddress, signature) {
      const stealth = new StealthChain(this);
      return stealth.generateStealthAddress(recipientAddress, signature);
    },

    /**
     * Annuncia un pagamento stealth
     * @param {string} stealthAddress 
     * @param {string} senderPublicKey 
     * @param {string} spendingPublicKey 
     * @param {string} signature 
     */
    async announceStealthPayment(stealthAddress, senderPublicKey, spendingPublicKey, signature) {
      const stealth = new StealthChain(this);
      return stealth.announceStealthPayment(stealthAddress, senderPublicKey, spendingPublicKey, signature);
    },

    /**
     * Recupera i pagamenti stealth
     * @param {string} signature 
     */
    async getStealthPayments(signature) {
      const stealth = new StealthChain(this);
      return stealth.getStealthPayments(signature);
    },

    /**
     * Recupera i fondi stealth
     * @param {string} stealthAddress 
     * @param {string} senderPublicKey 
     * @param {string} signature 
     * @param {string} spendingPublicKey 
     */
    async recoverStealthFunds(stealthAddress, senderPublicKey, signature, spendingPublicKey) {
      const stealth = new StealthChain(this);
      return stealth.recoverStealthFunds(stealthAddress, senderPublicKey, signature, spendingPublicKey);
    },

    /**
     * Pubblica le chiavi stealth
     * @param {string} signature 
     */
    async publishStealthKeys(signature) {
      const stealth = new StealthChain(this);
      return stealth.publishStealthKeys(signature);
    }
  };

  Object.assign(Gun.chain, stealthMethods);
}

// =============================================
// GUN EXTENSIONS
// =============================================

/**
 * @param {import("gun").IGun} Gun
 */
function extendGun(Gun) {
  /** @type {BaseMethods} */
  const baseMethods = {
    MESSAGE_TO_SIGN,
    setSigner,
    getSigner,
    verifySignature,
    generatePassword,
    createSignature,
    createAndStoreEncryptedPair,
    getAndDecryptPair,
    ethToGunAccount,
    gunToEthAccount,
    decryptPair,
    decryptWithPassword,
    encryptWithPassword,
    encrypt,
    decrypt
  };

  Object.assign(Gun.chain, baseMethods);
  extendGunWithStealth(Gun);
}

/**
 * Inizializza Gun con le estensioni e le opzioni specificate
 * @param {Object} options - Opzioni di configurazione per Gun
 * @returns {IGunInstance} 
 */
function initializeGun(options = {}) {
  // Configurazione di default
  const defaultOptions = {
    localStorage: false,
    radisk: false,
    ...options
  };

  // Verifica che Gun sia stato caricato correttamente
  if (!Gun.SEA) {
    console.warn("Gun.SEA non disponibile, ricarico le estensioni...");
    require("gun/sea");
  }

  // Estendi Gun con i nostri metodi
  extendGun(Gun);

  // Crea una nuova istanza di Gun
  const gun = new Gun(defaultOptions);

  // Verifica che l'istanza sia stata creata correttamente
  if (!gun || typeof gun.user !== 'function') {
    throw new Error("Inizializzazione Gun fallita: user API non disponibile");
  }

  return gun;
}

// Esportazioni
export {
  MESSAGE_TO_SIGN,
  generateRandomId,
  getSigner,
  generatePassword,
  verifySignature,
  initializeGun,
  extendGun,
  createSignature,
  setSigner,
  gunToEthAccount,
  decryptWithPassword,
  encryptWithPassword,
  encrypt,
  decrypt,
  ethToGunAccount,
  createAndStoreEncryptedPair,
  getAndDecryptPair
};