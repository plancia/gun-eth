// @ts-check

import { ethers } from "ethers";
import SEA from "gun/sea.js";
import { 
  MESSAGE_TO_SIGN,
  generatePassword,
  verifySignature
} from "../utils/common.js";
import { decrypt, deriveSharedKey } from "../utils/encryption.js";

export class StealthChain {
  constructor(gun) {
    this.gun = gun;
  }

  /**
   * Genera un indirizzo stealth per il destinatario
   * @param {string} recipientAddress - Indirizzo del destinatario
   * @param {string} signature - Firma per l'autenticazione
   * @returns {Promise<Object>} Indirizzo stealth generato e chiavi
   */
  async generateStealthAddress(recipientAddress, signature) {
    try {
      if (!recipientAddress) {
        throw new Error("Recipient address is required");
      }

      console.log("[generateStealthAddress] Cercando dati per:", recipientAddress);

      let userData;
      let userPub;

      // Se l'input è un indirizzo Ethereum, cerchiamo i dati dell'utente
      if (recipientAddress.startsWith('0x')) {
        console.log("[generateStealthAddress] Cercando utente con indirizzo:", recipientAddress);
        
        userData = await new Promise((resolve) => {
          this.gun
            .get("gun-eth")
            .get("users")
            .get(recipientAddress)
            .once((data) => {
              console.log("[generateStealthAddress] Dati utente trovati:", data);
              resolve(data);
            });
          
          setTimeout(() => {
            console.log("[generateStealthAddress] Timeout nella ricerca utente");
            resolve(null);
          }, 3000);
        });

        console.log("[generateStealthAddress] UserData recuperato:", userData);

        if (!userData) {
          throw new Error(`Nessun utente trovato per l'indirizzo Ethereum: ${recipientAddress}`);
        }

        // Controlliamo prima le chiavi nella struttura root
        userPub = userData.spendingPublicKey;
        
        // Se non troviamo le chiavi nella root, proviamo a caricarle da publicKeys
        if (!userPub && userData.publicKeys) {
          userPub = userData.publicKeys.spendingPublicKey;
        }

        // Se ancora non abbiamo le chiavi, proviamo a caricarle direttamente
        if (!userPub) {
          console.log("[generateStealthAddress] Tentativo di caricamento diretto delle chiavi pubbliche");
          const publicKeys = await new Promise((resolve) => {
            this.gun
              .get("gun-eth")
              .get("users")
              .get(recipientAddress)
              .get("publicKeys")
              .once((data) => {
                console.log("[generateStealthAddress] Chiavi pubbliche caricate:", data);
                resolve(data);
              });
            
            setTimeout(() => resolve(null), 3000);
          });

          if (publicKeys) {
            userPub = publicKeys.spendingPublicKey;
          }
        }

        if (!userPub) {
          console.log("[generateStealthAddress] Struttura dati utente completa:", userData);
          throw new Error("Chiave pubblica di spesa non trovata per l'utente");
        }

        console.log("[generateStealthAddress] Chiave pubblica di spesa trovata:", userPub);
      } else {
        // Se non è un indirizzo Ethereum, assumiamo sia già una chiave pubblica
        userPub = recipientAddress;
      }

      if (!userPub) {
        console.log("[generateStealthAddress] Dati completi utente:", JSON.stringify(userData, null, 2));
        throw new Error("Chiave pubblica non trovata per il destinatario");
      }

      // Prima cerchiamo le chiavi stealth dedicate
      console.log("[generateStealthAddress] Cercando chiavi stealth per:", userPub);
      let stealthKeys = await new Promise((resolve) => {
        this.gun
          .get("gun-eth")
          .get("stealth-keys")
          .get(userPub)
          .once((data) => {
            console.log("[generateStealthAddress] Chiavi stealth trovate:", data);
            resolve(data);
          });
      });

      // Se non troviamo chiavi stealth dedicate, le generiamo
      if (!stealthKeys || !stealthKeys.viewingPublicKey || !stealthKeys.spendingPublicKey) {
        console.log("[generateStealthAddress] Generando nuove chiavi stealth per:", userPub);
        // Generiamo nuove chiavi stealth dedicate
        const [v_pair, s_pair] = await Promise.all([
          SEA.pair(),
          SEA.pair()
        ]);

        stealthKeys = {
          viewingPublicKey: v_pair.epub,
          spendingPublicKey: s_pair.epub,
          timestamp: Date.now()
        };

        // Salviamo le nuove chiavi stealth
        await new Promise((resolve) => {
          this.gun
            .get("gun-eth")
            .get("stealth-keys")
            .get(userPub)
            .put(stealthKeys, (ack) => {
              if (ack.err) throw new Error(ack.err);
              resolve();
            });
        });
      }

      if (!stealthKeys.viewingPublicKey || !stealthKeys.spendingPublicKey) {
        throw new Error("Invalid stealth keys structure");
      }

      // Get sender's keys
      const senderAddress = await verifySignature(MESSAGE_TO_SIGN, signature);
      const password = await generatePassword(signature);
      
      const senderData = await this.gun
        .get("gun-eth")
        .get("users")
        .get(senderAddress)
        .then();

      if (!senderData?.s_pair) {
        throw new Error("Chiavi del mittente non trovate");
      }

      // Decrypt sender's spending pair
      let spendingKeyPair;
      try {
        const decryptedData = await decrypt(senderData.s_pair, password);
        spendingKeyPair = typeof decryptedData === 'string' ? 
          JSON.parse(decryptedData) : 
          decryptedData;
      } catch (error) {
        console.error("Errore nella decrittazione delle chiavi di spesa:", error);
        throw new Error("Impossibile decrittare le chiavi di spesa");
      }

      // Generate shared secret using SEA ECDH
      const sharedSecret = await deriveSharedKey(stealthKeys.viewingPublicKey, spendingKeyPair);
      
      if (!sharedSecret) {
        throw new Error("Impossibile generare la chiave condivisa");
      }

      console.log("[generateStealthAddress] Chiave condivisa generata");

      // Base64 to hex conversion
      const base64ToHex = (base64) => {
        const cleanBase64 = base64.split('.')[0];
        const withoutPrefix = cleanBase64.replace('0x', '');
        const raw = atob(withoutPrefix.replace(/-/g, '+').replace(/_/g, '/'));
        let hex = '';
        for (let i = 0; i < raw.length; i++) {
          const hexByte = raw.charCodeAt(i).toString(16);
          hex += hexByte.length === 2 ? hexByte : '0' + hexByte;
        }
        return '0x' + hex;
      };

      // Convert values to hex
      const sharedSecretHex = base64ToHex(sharedSecret);
      const spendingPublicKeyHex = base64ToHex(stealthKeys.spendingPublicKey);

      // Generate stealth private key
      const stealthPrivateKey = ethers.keccak256(
        ethers.concat([
          ethers.getBytes(sharedSecretHex),
          ethers.getBytes(spendingPublicKeyHex)
        ])
      );
      
      // Create stealth wallet
      const stealthWallet = new ethers.Wallet(stealthPrivateKey);
      const stealthAddress = stealthWallet.address;

      console.log("[generateStealthAddress] Indirizzo stealth generato:", stealthAddress);

      return {
        stealthAddress,
        ephemeralPublicKey: spendingKeyPair.epub,
        viewingPublicKey: stealthKeys.viewingPublicKey,
        spendingPublicKey: stealthKeys.spendingPublicKey,
        wallet: stealthWallet // Includiamo il wallet per operazioni future
      };
    } catch (error) {
      console.error("[generateStealthAddress] Errore:", error);
      throw error;
    }
  }

  /**
   * Annuncia un pagamento stealth
   * @param {string} stealthAddress - Indirizzo stealth
   * @param {string} senderPublicKey - Chiave pubblica del mittente
   * @param {string} spendingPublicKey - Chiave pubblica di spesa
   * @returns {Promise<Object>} Dettagli dell'annuncio
   */
  async announceStealthPayment(stealthAddress, senderPublicKey, spendingPublicKey) {
    try {
      const timestamp = Date.now();
      const announcement = {
        stealthAddress,
        senderPublicKey,
        spendingPublicKey,
        timestamp
      };

      await this.gun
        .get("gun-eth")
        .get("stealth-payments")
        .get(stealthAddress)
        .put(announcement);

      return announcement;
    } catch (error) {
      console.error("Error announcing stealth payment:", error);
      throw error;
    }
  }

  /**
   * Recupera i pagamenti stealth
   * @param {string} signature - Firma per l'autenticazione
   * @returns {Promise<Array>} Lista dei pagamenti stealth
   */
  async getStealthPayments(signature) {
    try {
      const payments = [];
      await new Promise((resolve) => {
        this.gun
          .get("gun-eth")
          .get("stealth-payments")
          .map()
          .once((payment, id) => {
            if (payment) {
              payments.push({ ...payment, id });
            }
          });
        
        // Risolvi dopo un breve timeout per permettere la raccolta dei dati
        setTimeout(resolve, 1000);
      });

      return payments;
    } catch (error) {
      console.error("Error getting stealth payments:", error);
      throw error;
    }
  }

  /**
   * Recupera i fondi stealth
   * @param {string} stealthAddress - Indirizzo stealth
   * @param {string} senderPublicKey - Chiave pubblica del mittente
   * @param {string} signature - Firma per l'autenticazione
   * @param {string} spendingPublicKey - Chiave pubblica di spesa
   * @returns {Promise<Object>} Dettagli del recupero
   */
  async recoverStealthFunds(stealthAddress, senderPublicKey, signature, spendingPublicKey) {
    try {
      const payment = await this.gun
        .get("gun-eth")
        .get("stealth-payments")
        .get(stealthAddress)
        .then();

      if (!payment) {
        throw new Error("Stealth payment not found");
      }

      // Verifica che il recupero sia autorizzato
      const recoveryData = {
        stealthAddress,
        senderPublicKey,
        spendingPublicKey,
        signature,
        timestamp: Date.now()
      };

      await this.gun
        .get("gun-eth")
        .get("stealth-recoveries")
        .get(stealthAddress)
        .put(recoveryData);

      return recoveryData;
    } catch (error) {
      console.error("Error recovering stealth funds:", error);
      throw error;
    }
  }

  /**
   * Pubblica le chiavi stealth
   * @param {string} signature - Firma per l'autenticazione
   * @returns {Promise<Object>} Chiavi pubblicate
   */
  async publishStealthKeys(signature) {
    try {
      const pair = await SEA.pair();
      const publicKeys = {
        viewingPublicKey: pair.epub,
        spendingPublicKey: pair.pub,
        timestamp: Date.now()
      };

      await this.gun
        .get("gun-eth")
        .get("stealth-keys")
        .get(signature)
        .put(publicKeys);

      return publicKeys;
    } catch (error) {
      console.error("Error publishing stealth keys:", error);
      throw error;
    }
  }
}
