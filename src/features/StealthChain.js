// @ts-check
import { ethers } from "ethers";
import { deriveSharedKey } from "../utils/encryption.js";
import SEA from "gun/sea.js";

export class StealthChain {
  /**
   * Genera un indirizzo stealth per il destinatario
   * @param {string} receiverViewingKey - Chiave pubblica di visualizzazione del destinatario
   * @param {string} receiverSpendingKey - Chiave pubblica di spesa del destinatario
   * @returns {Promise<Object>} Indirizzo stealth generato e chiavi associate
   */
  async generateStealthAddress(receiverViewingKey, receiverSpendingKey) {
    try {
      // Genera una nuova coppia di chiavi effimere del mittente
      const senderEphemeralPair = await SEA.pair();

      if (!senderEphemeralPair || !senderEphemeralPair.epub) {
        throw new Error("Failed to generate sender's ephemeral keypair");
      }

      // Deriva il segreto condiviso usando la viewing key del destinatario
      const sharedSecret = await deriveSharedKey(
        receiverViewingKey,
        senderEphemeralPair
      );

      if (!sharedSecret) {
        throw new Error("Failed to derive shared secret");
      }

      // Deriva l'indirizzo stealth usando le chiavi del destinatario
      const { stealthAddress, stealthPrivateKey } = this.deriveStealthAddress(
        sharedSecret,
        receiverSpendingKey,
        senderEphemeralPair.epub,
        receiverViewingKey
      );

      return {
        stealthAddress,
        senderEphemeralPublicKey: senderEphemeralPair.epub,
        sharedSecret,
        stealthPrivateKey,
      };
    } catch (error) {
      console.error("Error in generateStealthAddress:", error);
      throw error;
    }
  }

  /**
   * Deriva un indirizzo stealth dai parametri forniti
   * @param {string} sharedSecret - Segreto condiviso tra mittente e destinatario
   * @param {string} receiverSpendingKey - Chiave pubblica di spesa del destinatario
   * @param {string} senderEphemeralKey - Chiave pubblica effimera del mittente
   * @param {string} receiverViewingKey - Chiave pubblica di visualizzazione del destinatario
   * @returns {Object} Indirizzo stealth e chiavi derivate
   */
  deriveStealthAddress(
    sharedSecret,
    receiverSpendingKey,
    senderEphemeralKey,
    receiverViewingKey
  ) {
    try {
      // Funzione migliorata per convertire base64 in hex
      const base64ToHex = (base64) => {
        try {
          // Rimuovi il punto e prendi la prima parte
          const parts = base64.split(".");
          const cleanBase64 = parts[0];

          // Sostituisci i caratteri speciali di base64url con base64 standard
          const standardBase64 = cleanBase64
            .replace(/-/g, "+")
            .replace(/_/g, "/");

          // Aggiungi il padding se necessario
          const padding = "=".repeat((4 - (standardBase64.length % 4)) % 4);
          const paddedBase64 = standardBase64 + padding;

          // Decodifica base64 in binario
          const raw = atob(paddedBase64);

          // Converti binario in hex
          let hex = "";
          for (let i = 0; i < raw.length; i++) {
            const hexByte = raw.charCodeAt(i).toString(16).padStart(2, "0");
            hex += hexByte;
          }

          return "0x" + hex;
        } catch (error) {
          console.error("Errore nella conversione base64 a hex:", error);
          throw new Error(
            `Impossibile convertire la chiave da base64 a hex: ${error.message}`
          );
        }
      };

      // Converti tutti i valori in hex
      const sharedSecretHex = base64ToHex(sharedSecret);
      const receiverSpendingKeyHex = base64ToHex(receiverSpendingKey);
      const senderEphemeralKeyHex = base64ToHex(senderEphemeralKey);
      const receiverViewingKeyHex = base64ToHex(receiverViewingKey);

      // Genera la chiave privata stealth combinando tutti i parametri
      const stealthPrivateKey = ethers.keccak256(
        ethers.concat([
          ethers.getBytes(sharedSecretHex),
          ethers.getBytes(receiverSpendingKeyHex),
          ethers.getBytes(senderEphemeralKeyHex),
          ethers.getBytes(receiverViewingKeyHex),
        ])
      );

      // Crea il wallet stealth
      const stealthWallet = new ethers.Wallet(stealthPrivateKey);

      return {
        stealthPrivateKey,
        stealthAddress: stealthWallet.address,
        wallet: stealthWallet,
      };
    } catch (error) {
      console.error("Error in deriveStealthAddress:", error);
      throw error;
    }
  }

  /**
   * Crea un annuncio di pagamento stealth
   * @param {string} stealthAddress - Indirizzo stealth generato
   * @param {string} senderEphemeralKey - Chiave pubblica effimera del mittente
   * @param {string} receiverViewingKey - Chiave pubblica di visualizzazione del destinatario
   * @param {string} receiverSpendingKey - Chiave pubblica di spesa del destinatario
   */
  createStealthAnnouncement(
    stealthAddress,
    senderEphemeralKey,
    receiverViewingKey,
    receiverSpendingKey
  ) {
    return {
      stealthAddress,
      senderEphemeralKey,
      receiverViewingKey,
      receiverSpendingKey,
      timestamp: Date.now(),
    };
  }

  /**
   * Recupera i fondi stealth
   * @param {string} stealthAddress - Indirizzo stealth
   * @param {string} senderPublicKey - Chiave pubblica del mittente
   * @param {string} signature - Firma per l'autenticazione
   * @param {string} spendingPublicKey - Chiave pubblica di spesa
   * @returns {Object} Dettagli del recupero
   */
  createRecoveryData(
    stealthAddress,
    senderPublicKey,
    signature,
    spendingPublicKey
  ) {
    return {
      stealthAddress,
      senderPublicKey,
      spendingPublicKey,
      signature,
      timestamp: Date.now(),
    };
  }
}
