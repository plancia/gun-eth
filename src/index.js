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
  decryptWithPassword,
  encryptWithPassword,
  encrypt,
  decrypt,
  convertToEthAddress,
} from "./gun-eth.js";

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
  decryptWithPassword,
  encryptWithPassword,
  encrypt,
  decrypt,
  convertToEthAddress,
};

// @ts-ignore
if (typeof window !== "undefined") {
  // @ts-ignore
  window.GunEth = GunEth;
}

export { GunEth };
