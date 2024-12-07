// @ts-nocheck
import { ethers } from 'ethers';
import { PROOF_OF_INTEGRITY_ADDRESS, STEALTH_ANNOUNCER_ADDRESS, getAddressesForChain, isLocalEnvironment } from '../constants/abis.js';

let contractAddresses = {
  PROOF_OF_INTEGRITY_ADDRESS,
  STEALTH_ANNOUNCER_ADDRESS,
};

/**
 * @typedef {import('ethers').Eip1193Provider} EthereumProvider
 */



/** @typedef {Window & { ethereum?: EthereumProvider }} WindowWithEthereum */


const window = globalThis.window;

// Singleton for signer management
class SignerManager {
  static instance = null;
  static provider = null;
  static signer = null;
  static rpcUrl = "";
  static privateKey = "";

  static getInstance() {
    if (!SignerManager.instance) {
      SignerManager.instance = new SignerManager();
    }
    return SignerManager.instance;
  }

  static async getSigner() {
    if (SignerManager.signer) {
      return SignerManager.signer;
    }

    if (SignerManager.rpcUrl && SignerManager.privateKey) {
      SignerManager.provider = new ethers.JsonRpcProvider(SignerManager.rpcUrl);
      const wallet = new ethers.Wallet(SignerManager.privateKey, SignerManager.provider);
      // Create a proxy instead of modifying the wallet directly
      SignerManager.signer = new Proxy(wallet, {
        get(target, prop) {
          if (prop === 'address') {
            return target.address;
          }
          if (prop === 'privateKey') {
            return SignerManager.privateKey;
          }
          return target[prop];
        }
      });
      return SignerManager.signer;
    }

    if (typeof window !== "undefined" && window?.ethereum) { 
      /** @type {WindowWithEthereum} */
      const windowWithEthereum = window;
      await windowWithEthereum.ethereum?.request({ method: "eth_requestAccounts" });
      const browserProvider = new ethers.BrowserProvider(windowWithEthereum.ethereum);
      const signer = await browserProvider.getSigner();
      // Create a proxy for the browser signer as well
      SignerManager.signer = new Proxy(signer, {
        get(target, prop) {
          if (prop === 'address') {
            return target.getAddress();
          }
          if (prop === 'privateKey') {
            return '';
          }
          return target[prop];
        }
      });
      return SignerManager.signer;
    }

    throw new Error("No valid Ethereum provider found. Call setSigner first.");
  }

  static setSigner(newRpcUrl, newPrivateKey) {
    SignerManager.rpcUrl = newRpcUrl;
    SignerManager.privateKey = newPrivateKey;
    SignerManager.provider = new ethers.JsonRpcProvider(newRpcUrl);
    const wallet = new ethers.Wallet(newPrivateKey, SignerManager.provider);
    // Create a proxy for the new signer
    SignerManager.signer = new Proxy(wallet, {
      get(target, prop) {
        if (prop === 'address') {
          return target.address;
        }
        if (prop === 'privateKey') {
          return SignerManager.privateKey;
        }
        return target[prop];
      }
    });
    console.log("Signer configured with address:", wallet.address);
    return SignerManager.instance;
  }
}

export function generateRandomId() {
  return ethers.hexlify(ethers.randomBytes(32));
}

export function getContractAddresses(chain = 'localhost') {
  if (isLocalEnvironment && contractAddresses) {
    console.log('Using local contract addresses:', contractAddresses);
    return contractAddresses;
  }

  const chainConfig = getAddressesForChain(chain);
  console.log(`Using ${chain} configuration:`, chainConfig);
  return {
    PROOF_OF_INTEGRITY_ADDRESS: chainConfig.PROOF_OF_INTEGRITY_ADDRESS,
    STEALTH_ANNOUNCER_ADDRESS: chainConfig.STEALTH_ANNOUNCER_ADDRESS
  };
}

export function setSigner(newRpcUrl, newPrivateKey) {
  return SignerManager.setSigner(newRpcUrl, newPrivateKey);
}

export async function getSigner(chain = 'localhost') {
  return SignerManager.getSigner();
} 
