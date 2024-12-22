/**
 * @typedef {Object} BrowserGunEth
 * @property {Object} GunEth
 * @property {string} GunEth.MESSAGE_TO_SIGN
 * @property {function} GunEth.generateRandomId
 * @property {function} GunEth.getSigner
 * @property {function} GunEth.generatePassword
 * @property {function} GunEth.verifySignature
 * @property {function} GunEth.initializeGun
 * @property {function} GunEth.extendGun
 * @property {function} GunEth.createSignature
 * @property {function} GunEth.setSigner
 * @property {function} GunEth.gunToEthAccount
 * @property {function} GunEth.ethToGunAccount
 * @property {function} GunEth.decryptWithPassword
 * @property {function} GunEth.encryptWithPassword
 * @property {function} GunEth.encrypt
 * @property {function} GunEth.decrypt
 * @property {function} GunEth.convertToEthAddress
 */

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
} from './gun-eth.js';

/** @type {BrowserGunEth} */
const browserGunEth = {
  GunEth: {
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
    convertToEthAddress
  }
};

/** @type {any} */
const window = globalThis;

if (typeof window !== "undefined") {
  window.GunEth = browserGunEth.GunEth;
}

export default browserGunEth; 