/**
 * @typedef {Object} BrowserGunEth
 * @property {Object} GunEth
 * @property {function} GunEth.init
 * @property {function} GunEth.generatePassword
 * @property {function} GunEth.getSigner
 * @property {function} GunEth.verifySignature
 * @property {function} GunEth.initializeGun
 * @property {function} GunEth.setSigner
 * @property {function} GunEth.gunToEthAccount
 * @property {function} GunEth.decryptWithPassword
 * @property {function} GunEth.encryptWithPassword
 * @property {function} GunEth.encrypt
 * @property {function} GunEth.decrypt
 * @property {function} GunEth.ethToGunAccount
 * @property {function} GunEth.createSignature
 * @property {function} GunEth.generateRandomId
 * @property {function} GunEth.extendGun
 * @property {string} GunEth.MESSAGE_TO_SIGN
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
  decrypt
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
    decryptWithPassword,
    encryptWithPassword,
    encrypt,
    decrypt,
    ethToGunAccount,
    async init() {
      return this;
    }
  }
};

export default browserGunEth; 