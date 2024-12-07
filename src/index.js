import { GunEth } from "./core/gun-eth.js";
import { ProofChain } from "./features/proof/ProofChain.js";
import { StealthChain } from "./features/stealth/StealthChain.js";
import { GUNBubbleProvider } from "./features/bubbles/providers/gun-bubble-provider.js";

/**
 * @typedef {Object} BubbleProviderOptions
 * @property {string} rpcUrl - RPC URL for the provider
 * @property {string} contractAddress - Contract address
 * @property {Object} [contractAbi] - Contract ABI
 * @property {Object} gun - Gun instance
 * @property {Object} keypair - Encryption keypair
 * @property {string} keypair.epub - Public key
 * @property {string} keypair.epriv - Private key
 */

/**
 * @typedef {Object} GunNode
 * @property {string} [name]
 * @property {string} [owner]
 * @property {string} [filePath]
 * @property {string} [content]
 * @property {number} [created]
 * @property {number} [updated]
 * @property {number} [size]
 * @property {boolean} [readOnly]
 * @property {Object} [encryptionInfo]
 * @property {string} encryptionInfo.ownerEpub
 * @property {string} encryptionInfo.ownerAddress
 */

/**
 * @typedef {Object} EthereumProvider
 * @property {(request: { method: string; params?: any[] | Record<string, any> }) => Promise<any>} request
 * @property {string} [chainId]
 * @property {boolean} [isMetaMask]
 */

/**
 * @typedef {Object} FileMetadata
 * @property {string} name
 * @property {string} owner
 * @property {string} filePath
 * @property {number} created
 * @property {number} updated
 * @property {number} size
 * @property {boolean} readOnly
 */

export { GunEth, ProofChain, StealthChain, GUNBubbleProvider };
