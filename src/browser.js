/**
 * @typedef {Object} BrowserGunEth
 * @property {typeof import('./core/gun-eth.js').GunEth} GunEth
 * @property {typeof import('./features/proof/ProofChain.js').ProofChain} ProofChain
 */

// Import only browser-required modules
import { GunEth } from './core/gun-eth.js';
import { ProofChain } from './features/proof/ProofChain.js';

/** @type {BrowserGunEth} */
const browserGunEth = {
  GunEth,
  ProofChain
};

export default browserGunEth;