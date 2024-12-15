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
      // Recupera le chiavi pubbliche del destinatario
      const recipientData = await this.gun
        .get("gun-eth")
        .get("users")
        .get(recipientAddress)
        .get("publicKeys")
        .then();

      if (!recipientData) {
        throw new Error("Recipient public keys not found");
      }

      // Genera una coppia di chiavi effimere
      const ephemeralKeyPair = await SEA.pair();
      
      // Calcola l'indirizzo stealth usando le chiavi effimere e quelle del destinatario
      const stealthAddress = ethers.getAddress(
        ethers.keccak256(
          ethers.concat([
            ethers.toUtf8Bytes(recipientData.viewingPublicKey),
            ethers.toUtf8Bytes(ephemeralKeyPair.epub)
          ])
        )
      );

      return {
        stealthAddress,
        ephemeralPublicKey: ephemeralKeyPair.epub,
        viewingPublicKey: recipientData.viewingPublicKey,
        spendingPublicKey: recipientData.spendingPublicKey
      };
    } catch (error) {
      console.error("Error generating stealth address:", error);
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
