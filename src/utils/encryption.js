import SEA from 'gun/sea.js';

/**
 * @typedef {Object|string} KeyPair
 * @property {string} [epriv] - Private encryption key
 * @property {string} [epub] - Public encryption key
 * @property {string} [pub] - Optional public key
 * @property {string} [priv] - Optional private key
 */

/**
 * Encrypts data using SEA encryption
 * @param {string|Object} data - Data to encrypt
 * @param {KeyPair} keypair - Keypair for encryption
 * @returns {Promise<string>} Encrypted data
 * @throws {Error} If encryption fails
 */
export async function encrypt(data, keypair) {
  try {
    const dataToEncrypt = typeof data === 'object' ? JSON.stringify(data) : data;
    const encrypted = await SEA.encrypt(dataToEncrypt, keypair);
    
    if (!encrypted) {
      throw new Error('Encryption failed');
    }

    return encrypted;
  } catch (error) {
    console.error('Encryption error:', error);
    throw error;
  }
}

/**
 * Decrypts data using SEA decryption
 * @param {string} data - Encrypted data to decrypt
 * @param {KeyPair} keypair - Keypair for decryption
 * @returns {Promise<string|Object>} Decrypted data
 * @throws {Error} If decryption fails
 */
export async function decrypt(data, keypair) {
  try {
    const decrypted = await SEA.decrypt(data, keypair);
    if (!decrypted) {
      console.log("Decryption returned null");
      throw new Error('Decryption failed');
    }

    try {
      return typeof decrypted === 'string' ? JSON.parse(decrypted) : decrypted;
    } catch {
      return decrypted;
    }
  } catch (error) {
    console.error('Decryption error:', error);
    console.error('Data:', data);
    console.error('Keypair:', {
      hasEpriv: !!keypair?.epriv,
      hasEpub: !!keypair?.epub,
      hasPub: !!keypair?.pub,
      hasPriv: !!keypair?.priv
    });
    throw error;
  }
}

/**
 * Derives a shared secret key between two keypairs
 * @param {string} recipientEpub - Recipient's public encryption key
 * @param {KeyPair} senderKeypair - Sender's keypair
 * @returns {Promise<string>} Derived shared key
 * @throws {Error} If key derivation fails
 */
export async function deriveSharedKey(recipientEpub, senderKeypair) {
  try {
    if (!recipientEpub || !senderKeypair || !senderKeypair.epriv) {
      throw new Error('Invalid parameters for shared key derivation');
    }

    const sharedKey = await SEA.secret(recipientEpub, senderKeypair);
    if (!sharedKey) {
      throw new Error('Failed to derive shared key');
    }

    return sharedKey
  } catch (error) {
    console.error('Error deriving shared key:', error);
    throw error;
  }
} 