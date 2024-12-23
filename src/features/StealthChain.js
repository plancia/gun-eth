// @ts-check
import { ethers } from "ethers";
import { deriveSharedKey } from "../utils/encryption.js";
import stealthAnnouncer_abi from "../contracts/stealthChain/stealthAnnouncer_abi.json";
import addresses from "../contracts/addresses.js";
import SEA from "gun/sea.js";

// Funzioni di utilità
function base64ToHex(base64) {
  try {
    // Rimuovi il punto e prendi la prima parte
    const parts = base64.split(".");
    const cleanBase64 = parts[0];

    // Sostituisci i caratteri speciali di base64url con base64 standard
    const standardBase64 = cleanBase64.replace(/-/g, "+").replace(/_/g, "/");

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
}

function deriveStealthPrivateKey(sharedSecretHex, receiverSpendingKeyHex) {
  return ethers.keccak256(
    ethers.concat([
      ethers.getBytes(sharedSecretHex),
      ethers.getBytes(receiverSpendingKeyHex),
    ])
  );
}

function deriveStealthAddress(
  stealthPrivateKey,
  senderEphemeralKeyHex,
  receiverViewingKeyHex
) {
  const wallet = new ethers.Wallet(stealthPrivateKey);
  return wallet.address;
}

export class StealthChain {
  constructor(provider = null, chainId = null) {
    this.provider = provider;
    this.chainId = chainId;
    this.contract = null;

    // Initialize contract only if provider and chainId are provided
    if (provider && chainId) {
      if (!addresses[chainId]?.stealthAnnouncer) {
        throw new Error(`Chain ${chainId} not supported`);
      }
      this.contract = new ethers.Contract(
        addresses[chainId].stealthAnnouncer,
        stealthAnnouncer_abi,
        provider
      );
    }

    // Mapping delle chain supportate
    this.supportedChains = {
      polygon: {
        chainId: "0x89", // 137 in hex
        name: "Polygon Mainnet",
        rpcUrl: "https://polygon-rpc.com",
        explorerUrl: "https://polygonscan.com",
      },
    };
  }

  /**
   * Verifica se l'istanza è configurata per operazioni on-chain
   * @returns {boolean}
   */
  isOnChainEnabled() {
    return !!(this.provider && this.chainId && this.contract);
  }

  /**
   * Verifica che l'istanza sia configurata per operazioni on-chain
   * @throws {Error} Se l'istanza non è configurata per operazioni on-chain
   */
  requireOnChain() {
    if (!this.isOnChainEnabled()) {
      throw new Error("Provider and chainId required for on-chain operations");
    }
  }

  /**
   * Verifica se la chain corrente è supportata
   * @returns {Promise<boolean>}
   */
  async isOnSupportedChain() {
    try {
      const network = await this.provider.getNetwork();
      return (
        network.chainId.toString(16) ===
        this.supportedChains[this.chainId].chainId
      );
    } catch (error) {
      console.error("Errore nella verifica della chain:", error);
      return false;
    }
  }

  /**
   * Richiede il cambio di chain
   * @returns {Promise<void>}
   */
  async requestChainSwitch() {
    try {
      const chainConfig = this.supportedChains[this.chainId];
      await this.provider.send("wallet_switchEthereumChain", [
        { chainId: chainConfig.chainId },
      ]);
    } catch (error) {
      if (error.code === 4902) {
        // Chain non aggiunta al wallet
        await this.addChainToWallet();
      } else {
        throw error;
      }
    }
  }

  /**
   * Aggiunge la chain al wallet
   * @returns {Promise<void>}
   */
  async addChainToWallet() {
    const chainConfig = this.supportedChains[this.chainId];
    await this.provider.send("wallet_addEthereumChain", [
      {
        chainId: chainConfig.chainId,
        chainName: chainConfig.name,
        rpcUrls: [chainConfig.rpcUrl],
        blockExplorerUrls: [chainConfig.explorerUrl],
        nativeCurrency: {
          name: "MATIC",
          symbol: "MATIC",
          decimals: 18,
        },
      },
    ]);
  }

  /**
   * Genera un indirizzo stealth
   * @param {string} receiverViewingKey - Chiave pubblica di visualizzazione del destinatario
   * @param {string} receiverSpendingKey - Chiave pubblica di spesa del destinatario
   * @returns {Promise<Object>} Informazioni sull'indirizzo stealth generato
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
   * @param {string} senderEphemeralPublicKey - Chiave pubblica effimera del mittente
   * @param {string} receiverViewingKey - Chiave pubblica di visualizzazione del destinatario
   * @returns {Object} Informazioni sull'indirizzo stealth derivato
   */
  deriveStealthAddress(
    sharedSecret,
    receiverSpendingKey,
    senderEphemeralPublicKey,
    receiverViewingKey
  ) {
    try {
      const sharedSecretHex = base64ToHex(sharedSecret);
      const receiverSpendingKeyHex = base64ToHex(receiverSpendingKey);
      const senderEphemeralKeyHex = base64ToHex(senderEphemeralPublicKey);
      const receiverViewingKeyHex = base64ToHex(receiverViewingKey);

      // Deriva l'indirizzo stealth
      const stealthPrivateKey = deriveStealthPrivateKey(
        sharedSecretHex,
        receiverSpendingKeyHex
      );
      const stealthAddress = deriveStealthAddress(
        stealthPrivateKey,
        senderEphemeralKeyHex,
        receiverViewingKeyHex
      );

      // Crea il wallet stealth
      const wallet = new ethers.Wallet(stealthPrivateKey);

      return {
        stealthPrivateKey,
        stealthAddress,
        wallet,
      };
    } catch (error) {
      console.error("Error in deriveStealthAddress:", error);
      throw error;
    }
  }

  /**
   * Crea un annuncio di pagamento stealth
   * @param {string} stealthAddress - Indirizzo stealth generato
   * @param {string} senderEphemeralPublicKey - Chiave pubblica effimera del mittente
   * @param {string} receiverViewingKey - Chiave pubblica di visualizzazione del destinatario
   * @param {string} receiverSpendingKey - Chiave pubblica di spesa del destinatario
   * @returns {Object} Dati dell'annuncio
   */
  createStealthAnnouncement(
    stealthAddress,
    senderEphemeralPublicKey,
    receiverViewingKey,
    receiverSpendingKey
  ) {
    return {
      stealthAddress,
      senderEphemeralKey: senderEphemeralPublicKey,
      receiverViewingKey,
      receiverSpendingKey,
    };
  }

  /**
   * Crea i dati per il recupero dei fondi
   * @param {string} stealthAddress - Indirizzo stealth da cui recuperare i fondi
   * @param {string} senderPublicKey - Chiave pubblica del mittente
   * @param {string} signature - Firma per l'autenticazione
   * @param {string} spendingPublicKey - Chiave pubblica di spesa
   * @returns {Object} Dati per il recupero
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
      signature,
      spendingPublicKey,
    };
  }

  /**
   * Annuncia un nuovo pagamento stealth sulla blockchain con verifica della chain
   * @param {string} senderPublicKey - Chiave pubblica del mittente
   * @param {string} spendingPublicKey - Chiave pubblica di spesa
   * @param {string} stealthAddress - Indirizzo stealth generato
   * @returns {Promise<ethers.ContractTransaction>}
   */
  async announcePaymentOnChain(
    senderPublicKey,
    spendingPublicKey,
    stealthAddress
  ) {
    this.requireOnChain();
    try {
      // Verifica che siamo sulla chain corretta
      const isCorrectChain = await this.isOnSupportedChain();
      if (!isCorrectChain) {
        throw new Error(
          `Per favore passa alla ${
            this.supportedChains[this.chainId].name
          } per continuare`
        );
      }

      const devFee = await this.contract.devFee();
      const tx = await this.contract.announcePayment(
        senderPublicKey,
        spendingPublicKey,
        stealthAddress,
        { value: devFee }
      );
      return await tx.wait();
    } catch (error) {
      console.error("Errore nell'annuncio del pagamento:", error);
      throw error;
    }
  }

  /**
   * Recupera tutti gli annunci in un determinato range
   * @param {number} fromIndex - Indice iniziale
   * @param {number} toIndex - Indice finale
   * @returns {Promise<Array>}
   */
  async getAnnouncementsInRange(fromIndex, toIndex) {
    this.requireOnChain();
    try {
      return await this.contract.getAnnouncementsInRange(fromIndex, toIndex);
    } catch (error) {
      console.error("Errore nel recupero degli annunci:", error);
      throw error;
    }
  }

  /**
   * Recupera il numero totale di annunci
   * @returns {Promise<number>}
   */
  async getTotalAnnouncements() {
    this.requireOnChain();
    try {
      return await this.contract.getAnnouncementsCount();
    } catch (error) {
      console.error("Errore nel recupero del conteggio degli annunci:", error);
      throw error;
    }
  }

  /**
   * Recupera il fee corrente per gli annunci
   * @returns {Promise<ethers.BigNumberish>}
   */
  async getCurrentFee() {
    this.requireOnChain();
    try {
      return await this.contract.devFee();
    } catch (error) {
      console.error("Errore nel recupero del fee:", error);
      throw error;
    }
  }

  /**
   * Ascolta gli eventi di nuovi annunci
   * @param {Function} callback - Funzione da chiamare quando viene rilevato un nuovo annuncio
   * @returns {ethers.Contract} L'istanza del contratto per rimuovere il listener
   */
  listenToNewAnnouncements(callback) {
    this.requireOnChain();
    try {
      this.contract.on(
        "StealthPaymentAnnounced",
        (
          senderPublicKey,
          spendingPublicKey,
          stealthAddress,
          timestamp,
          event
        ) => {
          callback({
            senderPublicKey,
            spendingPublicKey,
            stealthAddress,
            timestamp: timestamp.toString(),
            transactionHash: event.transactionHash,
          });
        }
      );
      return this.contract;
    } catch (error) {
      console.error("Errore nell'ascolto degli eventi:", error);
      throw error;
    }
  }

  /**
   * Verifica se un indirizzo stealth è stato annunciato
   * @param {string} stealthAddress - Indirizzo stealth da verificare
   * @returns {Promise<boolean>}
   */
  async isStealthAddressAnnounced(stealthAddress) {
    try {
      const count = await this.getTotalAnnouncements();
      const batchSize = 100;

      for (let i = 0; i < count; i += batchSize) {
        const toIndex = Math.min(i + batchSize - 1, count - 1);
        const announcements = await this.getAnnouncementsInRange(i, toIndex);

        if (
          announcements.some(
            (a) =>
              a.stealthAddress.toLowerCase() === stealthAddress.toLowerCase()
          )
        ) {
          return true;
        }
      }

      return false;
    } catch (error) {
      console.error("Errore nella verifica dell'indirizzo stealth:", error);
      throw error;
    }
  }

  /**
   * Ottiene l'URL dell'explorer per una transazione
   * @param {string} txHash - Hash della transazione
   * @returns {string} URL dell'explorer
   */
  getExplorerUrl(txHash) {
    return `${this.supportedChains[this.chainId].explorerUrl}/tx/${txHash}`;
  }

  /**
   * Annuncia un pagamento stealth sulla blockchain
   * @param {string} stealthAddress - Indirizzo stealth generato
   * @param {string} senderEphemeralKey - Chiave pubblica effimera del mittente
   * @param {string} receiverViewingKey - Chiave pubblica di visualizzazione del destinatario
   * @param {string} receiverSpendingKey - Chiave pubblica di spesa del destinatario
   * @returns {Promise<ethers.ContractTransaction>} Transazione di annuncio
   */
  async announceStealthPayment(
    stealthAddress,
    senderEphemeralKey,
    receiverViewingKey,
    receiverSpendingKey
  ) {
    try {
      // Verifica che siamo sulla chain corretta
      const isCorrectChain = await this.isOnSupportedChain();
      if (!isCorrectChain) {
        throw new Error(
          `Per favore passa alla ${
            this.supportedChains[this.chainId].name
          } per continuare`
        );
      }

      // Crea l'annuncio
      const announcement = this.createStealthAnnouncement(
        stealthAddress,
        senderEphemeralKey,
        receiverViewingKey,
        receiverSpendingKey
      );

      // Invia la transazione onchain
      const tx = await this.contract.announceStealthPayment(
        announcement.stealthAddress,
        announcement.senderEphemeralKey,
        announcement.receiverViewingKey,
        announcement.receiverSpendingKey
      );

      // Attendi la conferma
      await tx.wait();

      return tx;
    } catch (error) {
      console.error("Error in announceStealthPayment:", error);
      throw error;
    }
  }

  /**
   * Recupera i pagamenti stealth dalla blockchain
   * @param {string} viewingKey - Chiave di visualizzazione del destinatario
   * @param {Object} options - Opzioni di recupero
   * @param {number} [options.fromBlock=0] - Blocco di partenza per la ricerca
   * @param {number|string} [options.toBlock] - Blocco finale per la ricerca
   * @returns {Promise<Array>} Lista dei pagamenti stealth
   */
  async getStealthPayments(
    viewingKey,
    options = { fromBlock: 0, toBlock: "latest" }
  ) {
    try {
      // Verifica che siamo sulla chain corretta
      const isCorrectChain = await this.isOnSupportedChain();
      if (!isCorrectChain) {
        throw new Error(
          `Per favore passa alla ${
            this.supportedChains[this.chainId].name
          } per continuare`
        );
      }

      // Recupera gli eventi dalla blockchain
      const filter = this.contract.filters.StealthPayment();
      const events = await this.contract.queryFilter(
        filter,
        options.fromBlock,
        options.toBlock
      );

      // Filtra e decodifica gli eventi
      const payments = events
        .map((event) => {
          // Verifica che l'evento sia di tipo EventLog
          if (!("args" in event)) return null;

          const args = event.args;
          if (!args) return null;

          const {
            stealthAddress,
            senderEphemeralKey,
            receiverViewingKey,
            receiverSpendingKey,
          } = args;

          // Verifica se il pagamento è per questo destinatario
          if (receiverViewingKey === viewingKey) {
            return {
              stealthAddress,
              senderEphemeralKey,
              receiverViewingKey,
              receiverSpendingKey,
              blockNumber: event.blockNumber,
              transactionHash: event.transactionHash,
            };
          }
          return null;
        })
        .filter(Boolean);

      return payments;
    } catch (error) {
      console.error("Error in getStealthPayments:", error);
      throw error;
    }
  }

  /**
   * Recupera i fondi da un indirizzo stealth
   * @param {string} stealthAddress - Indirizzo stealth da cui recuperare i fondi
   * @param {string} senderPublicKey - Chiave pubblica del mittente
   * @param {string} signature - Firma per l'autenticazione
   * @param {string} spendingPublicKey - Chiave pubblica di spesa
   * @returns {Promise<ethers.ContractTransaction>} Transazione di recupero
   */
  async recoverStealthFunds(
    stealthAddress,
    senderPublicKey,
    signature,
    spendingPublicKey
  ) {
    try {
      // Verifica che siamo sulla chain corretta
      const isCorrectChain = await this.isOnSupportedChain();
      if (!isCorrectChain) {
        throw new Error(
          `Per favore passa alla ${
            this.supportedChains[this.chainId].name
          } per continuare`
        );
      }

      // Crea i dati di recupero
      const recoveryData = this.createRecoveryData(
        stealthAddress,
        senderPublicKey,
        signature,
        spendingPublicKey
      );

      // Invia la transazione onchain
      const tx = await this.contract.recoverStealthFunds(
        recoveryData.stealthAddress,
        recoveryData.senderPublicKey,
        recoveryData.signature,
        recoveryData.spendingPublicKey
      );

      // Attendi la conferma
      await tx.wait();

      return tx;
    } catch (error) {
      console.error("Error in recoverStealthFunds:", error);
      throw error;
    }
  }
}
