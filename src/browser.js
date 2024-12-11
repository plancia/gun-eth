/**
 * @typedef {Object} BrowserGunEth
 * @property {typeof import('./core/gun-eth.js').GunEth} GunEth
 */

import { GunEth } from './core/gun-eth.js';

/** @type {BrowserGunEth} */
const browserGunEth = {
  GunEth
};

export default browserGunEth;