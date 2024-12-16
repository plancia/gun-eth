import {
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
  ethToGunAccount,
  createAndStoreEncryptedPair,
  getAndDecryptPair,
  decryptWithPassword,
  encryptWithPassword,
  encrypt,
  decrypt
} from './gun-eth.js';

const GunEth = {
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
  ethToGunAccount,
  createAndStoreEncryptedPair,
  getAndDecryptPair,
  decryptWithPassword,
  encryptWithPassword,
  encrypt,
  decrypt
};

// Esponi GunEth globalmente nel browser
if (typeof window !== 'undefined') {
  window.GunEth = GunEth;
}

export { GunEth }; 