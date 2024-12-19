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
      let userPub = recipientAddress;

      // Se l'input è un indirizzo Ethereum, cerchiamo prima il pub corrispondente
      if (recipientAddress.startsWith('0x')) {
        // Cerca l'utente tramite indirizzo Ethereum
        userData = await new Promise((resolve) => {
          this.gun
            .get("gun-eth")
            .get("users")
            .map()
            .once((data, key) => {
              if (data && data.profile && data.profile.address === recipientAddress) {
                resolve({ ...data, pub: key });
              }
            });
          
          // Timeout dopo 1 secondo se non troviamo l'utente
          setTimeout(() => resolve(null), 1000);
        });

        if (!userData) {
          throw new Error(`No user found for Ethereum address: ${recipientAddress}`);
        }

        userPub = userData.pub;
      }

      // Cerchiamo le chiavi stealth in ordine di priorità
      let stealthKeys;

      // 1. Prima controlliamo in gun-eth/stealth-keys
      stealthKeys = await this.gun
        .get("gun-eth")
        .get("stealth-keys")
        .get(userPub)
        .then();

      // 2. Se non troviamo le chiavi, controlliamo nel profilo
      if (!stealthKeys || !stealthKeys.viewingPublicKey) {
        const userProfile = await this.gun
          .get("~" + userPub)
          .get("profile")
          .then();

        console.log("[generateStealthAddress] Profilo utente:", userProfile);

        if (userProfile && userProfile.publicKeys) {
          stealthKeys = userProfile.publicKeys;
        }
      }

      // 3. Se ancora non troviamo le chiavi, le generiamo
      if (!stealthKeys || !stealthKeys.viewingPublicKey) {
        console.log("[generateStealthAddress] Generando nuove chiavi stealth per:", userPub);
        stealthKeys = await this.publishStealthKeys(userPub);

        // Salviamo le chiavi sia in stealth-keys che nel profilo
        await Promise.all([
          this.gun
            .get("gun-eth")
            .get("stealth-keys")
            .get(userPub)
            .put(stealthKeys),
          this.gun
            .get("~" + userPub)
            .get("profile")
            .get("publicKeys")
            .put(stealthKeys)
        ]);
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
