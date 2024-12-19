// @ts-check

import { ethers } from "ethers";
import SEA from "gun/sea.js";

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
              if (data && data.publicKeys) {
                // I dati sono già nella struttura corretta
                resolve(data);
              } else {
                console.log("[generateStealthAddress] Dati utente non validi o mancanti");
                resolve(null);
              }
            });
          
          setTimeout(() => {
            console.log("[generateStealthAddress] Timeout nella ricerca utente");
            resolve(null);
          }, 3000);
        });

        console.log("[generateStealthAddress] UserData recuperato:", userData);

        if (!userData || !userData.publicKeys) {
          // Proviamo a cercare usando il pub dell'utente
          userData = await new Promise((resolve) => {
            this.gun
              .get("gun-eth")
              .get("users")
              .map()
              .once((data) => {
                if (data && data.pub && data.publicKeys) {
                  resolve(data);
                }
              });
            
            setTimeout(() => resolve(null), 3000);
          });
        }

        if (!userData || !userData.publicKeys) {
          throw new Error(`Nessun utente trovato per l'indirizzo Ethereum: ${recipientAddress}`);
        }

        // Usiamo la chiave pubblica corretta per la generazione dell'indirizzo stealth
        userPub = userData.publicKeys.spendingPublicKey;
        console.log("[generateStealthAddress] Chiave pubblica estratta:", userPub);
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

      // Genera una coppia di chiavi effimere
      const ephemeralKeyPair = await SEA.pair();
      
      // Calcola l'indirizzo stealth usando le chiavi effimere e quelle del destinatario
      const stealthAddress = ethers.getAddress(
        ethers.keccak256(
          ethers.concat([
            ethers.toUtf8Bytes(stealthKeys.viewingPublicKey),
            ethers.toUtf8Bytes(ephemeralKeyPair.epub)
          ])
        )
      );

      console.log("[generateStealthAddress] Indirizzo stealth generato:", stealthAddress);

      return {
        stealthAddress,
        ephemeralPublicKey: ephemeralKeyPair.epub,
        viewingPublicKey: stealthKeys.viewingPublicKey,
        spendingPublicKey: stealthKeys.spendingPublicKey
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
   * @param {string} signature - Firma per l'autenticazione
   * @returns {Promise<Object>} Dettagli dell'annuncio
   */
  async announceStealthPayment(stealthAddress, senderPublicKey, spendingPublicKey, signature) {
    try {
      const timestamp = Date.now();
      const announcement = {
        stealthAddress,
        senderPublicKey,
        spendingPublicKey,
        timestamp,
        signature
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
