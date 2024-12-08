/**
 * @typedef {Object} BubbleClientOptions
 * @property {string} providerUrl - URL del provider del servizio bubble
 * @property {Object} signer - Signer Ethereum per autenticare le richieste
 * @property {string} signer.address - Indirizzo Ethereum del signer
 * @property {Object} keypair - Coppia di chiavi per crittografia
 * @property {string} keypair.epub - Chiave pubblica di crittografia
 * @property {string} keypair.epriv - Chiave privata di crittografia
 * @property {string} [contractAddress] - Optional custom contract address
 * @property {Object} [contractAbi] - Optional custom contract ABI
 */

/**
 * @typedef {Object} BubbleCreateOptions
 * @property {boolean} [isPrivate] - Se la bubble deve essere privata
 */

/**
 * @typedef {Object} BubbleShareOptions
 * @property {string} granteeEpub - Public key of recipient
 */

/**
 * @typedef {Object} BubbleMetadata
 * @property {string} id - ID della bubble
 * @property {string} name - Nome della bubble
 * @property {string} owner - Indirizzo del proprietario
 * @property {boolean} isPrivate - Se la bubble è privata
 * @property {number} createdAt - Timestamp di creazione
 */

/**
 * @typedef {Object} FileMetadata
 * @property {string} name - Nome del file
 * @property {number} size - Dimensione in bytes
 * @property {string} owner - Indirizzo del proprietario
 * @property {number} created - Timestamp di creazione
 * @property {number} updated - Timestamp ultimo aggiornamento
 */

/**
 * @typedef {Object} BubbleWriteResult
 * @property {string} content - Contenuto criptato
 * @property {FileMetadata} metadata - Metadati del file
 */

/**
 * @typedef {Object} BubbleReadResult
 * @property {string} content - Contenuto criptato
 * @property {FileMetadata} metadata - Metadati del file
 */

/**
 * @typedef {Object} BubbleShareResult
 * @property {boolean} success - Se la condivisione è avvenuta con successo
 */

import { encrypt, decrypt } from '../../../utils/encryption.js';

/**
 * Client per interagire con il servizio Bubble
 */
export class BubbleClient {
  /**
   * @param {BubbleClientOptions} options
   */
  constructor(options) {
    const { providerUrl, signer, keypair, contractAddress, contractAbi } = options;
    
    // Assicurati che providerUrl sia una stringa
    this.baseUrl = typeof providerUrl === 'string' ? providerUrl : '';
    
    // Rimuovi la trailing slash se presente
    if (this.baseUrl.endsWith('/')) {
      this.baseUrl = this.baseUrl.slice(0, -1);
    }

    this.signer = signer;
    this.keypair = keypair;
    this.contractAddress = contractAddress;
    this.contractAbi = contractAbi;
  }

  /**
   * Inizializza la sessione bubble
   * @returns {Promise<boolean>}
   */
  async initBubbleSession() {
    // Non c'è più bisogno di inizializzare l'utente GUN
    // poiché stiamo usando il keypair derivato da Ethereum
    return true;
  }

  /**
   * Crea una nuova bubble
   * @param {string} name - Nome della bubble
   * @param {BubbleCreateOptions} [options] - Opzioni di creazione
   * @returns {Promise<BubbleMetadata>}
   */
  async createBubble(name, options = {}) {
    const response = await fetch(`${this.baseUrl}/bubble`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name,
        isPrivate: options.isPrivate || true,
        userAddress: this.signer.address,
        contractAddress: this.contractAddress,
        contractAbi: this.contractAbi
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to create bubble');
    }

    return response.json();
  }

  /**
   * Scrive un file nella bubble
   * @param {string} bubbleId - ID della bubble
   * @param {string} fileName - Nome del file
   * @param {string} content - Contenuto del file
   * @returns {Promise<BubbleWriteResult>}
   */
  async writeBubble(bubbleId, fileName, content) {
    try {
      console.log("\n=== Starting writeBubble ===");
      console.log("Bubble ID:", bubbleId);
      console.log("File name:", fileName);
      console.log("User address:", this.signer.address);

      // Il client cripta il contenuto
      const encryptedContent = await encrypt(content, this.keypair);
      console.log("Content encrypted by client");

      const response = await fetch(`${this.baseUrl}/bubble/${bubbleId}/write`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          fileName,
          content: encryptedContent, // Invia il contenuto già criptato
          userAddress: this.signer.address,
          encryptionKey: {  // Aggiungi info sulla chiave usata
            epub: this.keypair.epub,
            ownerAddress: this.signer.address
          }
        })
      });

      if (!response.ok) {
        const error = await response.json();
        console.error("Write bubble API error:", error);
        throw new Error(error.message || 'Failed to write to bubble');
      }

      const result = await response.json();
      console.log("File written successfully:", {
        fileName,
        hasContent: !!result.content,
        metadata: result.metadata
      });

      return result;

    } catch (error) {
      console.error("Error writing to bubble:", error);
      throw new Error('Failed to write to bubble');
    }
  }

  /**
   * Legge un file dalla bubble
   * @param {string} bubbleId - ID della bubble
   * @param {string} fileName - Nome del file
   * @returns {Promise<BubbleReadResult>}
   */
  async readBubble(bubbleId, fileName) {
    try {
      console.log("\n=== Starting readBubble ===");
      console.log("Bubble ID:", bubbleId);
      console.log("File name:", fileName);
      console.log("User address:", this.signer.address);
      console.log("User keypair:", { 
        hasEpub: !!this.keypair?.epub, 
        hasEpriv: !!this.keypair?.epriv 
      });

      if (!this.keypair || !this.keypair.epub || !this.keypair.epriv) {
        throw new Error('Invalid user keypair');
      }

      if (!fileName) {
        throw new Error('File name is required');
      }

      const queryParams = new URLSearchParams({
        userAddress: this.signer.address,
        fileName: fileName  // Rimuovi il default
      });

      const response = await fetch(
        `${this.baseUrl}/bubble/${bubbleId}?${queryParams}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );

      if (!response.ok) {
        const error = await response.json();
        console.error("API error:", error);
        throw new Error('Failed to read bubble: ' + (error.message || 'Unknown error'));
      }

      const result = await response.json();
      console.log("API response:", {
        hasContent: !!result.content,
        metadata: result.metadata
      });

      if (!result.content) {
        throw new Error('No content found in bubble');
      }

      // Decripta il contenuto se è criptato
      if (result.metadata?.encrypted) {
        console.log("Content is encrypted, decrypting...");
        result.content = await decrypt(result.content, this.keypair);
        console.log("Content decrypted successfully");
      }

      return result;

    } catch (error) {
      console.error("Error reading bubble:", error);
      throw error;
    }
  }

  /**
   * Condivide una bubble con un altro utente
   * @param {string} bubbleId - ID della bubble
   * @param {string} granteeAddress - Indirizzo del destinatario
   * @param {BubbleShareOptions} [options] - Opzioni di condivisione
   * @returns {Promise<BubbleShareResult>}
   */
  async shareBubble(bubbleId, granteeAddress, options = { granteeEpub: '' }) {
    try {
      console.log("\n=== Starting shareBubble ===");
      console.log("Bubble ID:", bubbleId);
      console.log("Grantee address:", granteeAddress);
      console.log("Options:", {
        hasGranteeEpub: !!options.granteeEpub,
        hasGranterKeypair: !!this.keypair,
        hasCustomContract: !!this.contractAddress
      });
      
      if (!this.keypair || !this.keypair.epub || !this.keypair.epriv) {
        throw new Error('Invalid granter keypair');
      }

      if (!options.granteeEpub) {
        throw new Error('Grantee epub key is required');
      }

      const response = await fetch(`${this.baseUrl}/bubble/${bubbleId}/share`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          granteeAddress,
          granterAddress: this.signer.address,
          granteeEpub: options.granteeEpub,
          granterKeypair: {
            epub: this.keypair.epub,
            epriv: this.keypair.epriv
          },
          contractAddress: this.contractAddress,
          contractAbi: this.contractAbi
        })
      });

      if (!response.ok) {
        const error = await response.json();
        console.error("Share bubble API error:", error);
        throw new Error(error.message || 'Failed to share bubble');
      }

      const result = await response.json();
      console.log("Share operation successful:", result);

      return result;
    } catch (error) {
      console.error("Error sharing bubble:", error);
      throw new Error('Failed to share bubble');
    }
  }

  /**
   * Elimina una bubble
   * @param {string} bubbleId - ID della bubble
   * @param {Object} [options] - Opzioni aggiuntive
   * @param {string} [options.userAddress] - Indirizzo dell'utente (opzionale, default: this.signer.address)
   * @returns {Promise<{success: boolean}>}
   */
  async deleteBubble(bubbleId, options = {}) {
    const { userAddress = this.signer.address } = options;
    const response = await fetch(`${this.baseUrl}/bubble/${bubbleId}?userAddress=${userAddress}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('Delete bubble error response:', error);
      throw new Error('Failed to delete bubble');
    }

    return response.json();
  }
} 