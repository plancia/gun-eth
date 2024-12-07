// @ts-check
import { BaseBubbleProvider } from './base-bubble-provider.js';
import { getSigner } from "../../../core/gun-eth.js";
import * as fs from 'node:fs/promises';
import * as path from 'path';
import { encrypt, decrypt, deriveSharedKey } from '../../../utils/encryption.js';

const BUBBLE_ROOT = './bubbles';

/**
 * Options for initializing a HybridBubbleProvider
 * @typedef {Object} HybridBubbleProviderOptions
 * @property {string} rpcUrl - RPC URL for the provider
 * @property {string} contractAddress - Address of the bubble registry contract
 * @property {Object} [contractAbi] - ABI of the bubble registry contract
 * @property {Object} gun - Gun instance
 * @property {Object} keypair - Key pair for encryption
 */

/**
 * Extended Gun node with additional file metadata
 * @typedef {Object} ExtendedGunNode
 * @property {string} filePath - Path to the file on disk
 * @property {string} owner - Address of file owner
 * @property {string} content - Encrypted file content
 * @property {string} [name] - File name
 * @property {number} [created] - Creation timestamp
 * @property {number} [updated] - Last update timestamp
 * @property {number} [size] - File size in bytes
 * @property {{ ownerEpub: string, ownerAddress: string }} [encryptionInfo] - Encryption metadata
 */
/** @typedef {import('./base-bubble-provider.js').BubbleProviderOptions} BubbleProviderOptions */
/** @typedef {import('./base-bubble-provider.js').FileMetadata} FileMetadata */
/** @typedef {import('./gun-bubble-provider.js').FileDownloadResult} FileDownloadResult */
/** @typedef {import('./base-bubble-provider.js').DeleteResult} DeleteResult */

/** @typedef {Object} GunNode */
/** @typedef {GunNode & ExtendedGunNode} FileGunNode */


export class HybridBubbleProvider extends BaseBubbleProvider {
  /**
   * @param {BubbleProviderOptions} options
   */
  constructor(options) {
    super(options);
    this.ensureDirectory(BUBBLE_ROOT);
  }

  /**
   * @param {import("fs").PathLike} dir
   */
  async ensureDirectory(dir) {
    try {
      await fs.access(dir);
    } catch {
      await fs.mkdir(dir, { recursive: true });
    }
  }

  getFilePath(bubbleId, fileName) {
    return path.join(BUBBLE_ROOT, bubbleId, fileName);
  }

  /**
   * @param {string} bubbleId
   * @param {string} fileName
   * @param {string} content
   * @param {string} userAddress
   * @returns {Promise<FileMetadata>}
   */
  async handleFileUpload(bubbleId, fileName, content, userAddress) {
    try {
      console.log("\n=== Starting file upload ===");
      console.log("Bubble ID:", bubbleId);
      console.log("File name:", fileName);
      console.log("User address:", userAddress);
      
      await this.verifyBubbleAccess(bubbleId, userAddress);

      // Create bubble directory if it doesn't exist
      const bubblePath = path.join(BUBBLE_ROOT, bubbleId);
      await this.ensureDirectory(bubblePath);

      // Save encrypted content to filesystem
      const fsPath = this.getFilePath(bubbleId, fileName);
      await fs.writeFile(fsPath, content);  // Save encrypted content directly
      console.log("Encrypted file saved to:", fsPath);

      // Create file metadata
      const metadata = {
        name: fileName,
        owner: userAddress,
        filePath: fsPath,
        created: Date.now(),
        updated: Date.now(),
        size: content.length,
        encryptionInfo: {  // Encryption info
          ownerEpub: this.keypair.epub,
          ownerAddress: userAddress
        }
      };

      // Save metadata to GUN
      const gunPath = `bubbles/${bubbleId}/files/${fileName}`;
      await new Promise((resolve, reject) => {
        this.gun.get(gunPath).put(metadata, ack => {
          if (ack.err) {
            console.error("Error saving metadata:", ack.err);
            reject(new Error(ack.err));
          } else {
            console.log("Metadata saved successfully");
            resolve();
          }
        });
      });

      return metadata;

    } catch (error) {
      console.error('Error uploading file:', error);
      throw error;
    }
  }

  /**
   * Handles file download
   * @param {string} bubbleId
   * @param {string} fileName
   * @param {string} userAddress
   * @returns {Promise<FileDownloadResult>}
   */
  async handleFileDownload(bubbleId, fileName, userAddress) {
    try {
      await this.verifyBubbleAccess(bubbleId, userAddress);

      console.log("Downloading file:", fileName);
      console.log("Using keypair:", {
        hasEpub: !!this.keypair?.epub,
        hasEpriv: !!this.keypair?.epriv
      });

      const metadata = /** @type {FileGunNode} */ (/** @type {unknown} */ (await this.getGunNode(`bubbles/${bubbleId}/files/${fileName}`)));
      if (!metadata || !metadata.filePath) {
        throw new Error('File not found');
      }

      console.log("File metadata:", {
        name: metadata.name,
        owner: metadata.owner,
        encryptionInfo: metadata.encryptionInfo ? {
          hasOwnerEpub: !!metadata.encryptionInfo.ownerEpub,
          ownerAddress: metadata.encryptionInfo.ownerAddress
        } : 'No encryption info'
      });

      // Read encrypted content
      const encryptedContent = await fs.readFile(metadata.filePath, 'utf8');
      console.log("Read encrypted content from:", metadata.filePath);

      // Return encrypted content and metadata
      // Client will handle decryption
      return { 
        content: encryptedContent,
        metadata: {
          name: metadata.name || '',
          owner: metadata.owner || '',
          filePath: metadata.filePath || '',
          created: metadata.created || Date.now(),
          updated: metadata.updated || Date.now(),
          size: metadata.size || 0,
          readOnly: metadata.readOnly || false,
          encryptionInfo: metadata.encryptionInfo || {
            ownerEpub: '',
            ownerAddress: ''
          }
        }
      };

    } catch (error) {
      console.error('Error downloading file:', error);
      throw error;
    }
  }

  async handleGrantPermission(bubbleId, targetAddress, granterAddress, options = {}) {
    try {
      if (!options.granteeEpub) {
        throw new Error("Grantee epub key is required");
      }

      await this.verifyBubbleOwnership(bubbleId, granterAddress);
      await this.grantOnChainAccess(bubbleId, targetAddress);

      // Get list of files in bubble
      const bubblePath = path.join(BUBBLE_ROOT, bubbleId);
      const files = await fs.readdir(bubblePath);
      console.log("Files in bubble:", files);

      // For each file in bubble
      for (const fileName of files) {
        // Skip metadata and already shared files
        if (fileName === 'metadata.json' || fileName.startsWith('shared_')) {
          continue;
        }

        try {
          // Read encrypted file
          const filePath = path.join(bubblePath, fileName);
          const encryptedContent = await fs.readFile(filePath, 'utf8');
          console.log("Read encrypted file:", fileName);

          // Decrypt with owner's key
          const decryptedContent = await decrypt(encryptedContent, this.keypair);
          console.log("Original content decrypted");

          // Derive shared key for recipient
          const sharedKey = await deriveSharedKey(options.granteeEpub, this.keypair);
          console.log("Shared key derived");

          // Encrypt content with shared key
          const reEncryptedContent = await encrypt(decryptedContent, sharedKey);
          console.log("Content re-encrypted with shared key");

          // Save shared file
          const sharedFilePath = path.join(
            bubblePath,
            `shared_${targetAddress.toLowerCase()}_${fileName}`
          );
          await fs.writeFile(sharedFilePath, reEncryptedContent);
          console.log("Shared file written to:", sharedFilePath);

          // Save sharing metadata to GUN
          const sharedData = {
            address: targetAddress,
            grantedAt: Date.now(),
            ownerEpub: this.keypair.epub,
            filePath: sharedFilePath
          };

          await this.putGunData(`bubbles/${bubbleId}/files/${fileName}/sharedWith/${targetAddress.toLowerCase()}`, sharedData);
          console.log("Shared metadata saved for:", fileName);
        } catch (error) {
          console.error(`Error processing file ${fileName}:`, error);
        }
      }

      return { success: true };

    } catch (error) {
      console.error("Error in handleGrantPermission:", error);
      throw error;
    }
  }

  async handleCreateBubble(params) {
    const { name, isPrivate, userAddress } = params;
    
    if (!name || typeof isPrivate !== 'boolean' || !userAddress) {
      throw new Error('Invalid parameters for bubble creation');
    }

    try {
      console.log("Starting bubble creation...");
      console.log("Parameters:", params);

      // Get signer
      console.log("Getting signer...");
      const signer = await getSigner();
      
      // Create bubble on-chain
      console.log("Creating bubble on-chain...");
      
      const contractWithSigner = /** @type {any} */ (this.contract.connect(signer));
      const tx = await contractWithSigner.createBubble(name, isPrivate);
      console.log("Transaction sent:", tx.hash);
      
      console.log("Waiting for transaction...");
      const receipt = await tx.wait();
      
      // Extract bubble ID from event
      console.log("Parsing event...");
      const event = receipt.logs.find(log => {
        try {
          const parsedLog = this.contract.interface.parseLog(log);
          return parsedLog.name === 'BubbleCreated';
        } catch (e) {
          return false;
        }
      });

      if (!event) {
        throw new Error('Bubble creation event not found');
      }

      const parsedEvent = this.contract.interface.parseLog(event);
      const bubbleId = parsedEvent.args[0];
      console.log("Bubble ID:", bubbleId);

      // Create metadata
      const metadata = {
        id: bubbleId,
        name,
        owner: userAddress,
        isPrivate,
        createdAt: Date.now()
      };

      // Create bubble directory
      const bubblePath = path.join(BUBBLE_ROOT, bubbleId);
      await this.ensureDirectory(bubblePath);

      // Save metadata to both GUN and FS
      await Promise.all([
        // Save to GUN
        this.putGunData(`bubbles/${bubbleId}`, metadata),
        
        // Save to FS
        fs.writeFile(
          path.join(bubblePath, 'metadata.json'),
          JSON.stringify(metadata, null, 2)
        )
      ]);

      console.log("Bubble created successfully:", metadata);
      return metadata;

    } catch (error) {
      console.error('Error creating bubble:', error);
      throw error;
    }
  }

  /**
   * Handles file deletion
   * @param {string} bubbleId
   * @param {string} fileName
   * @param {string} userAddress
   * @returns {Promise<DeleteResult>}
   */
  async handleDeleteFile(bubbleId, fileName, userAddress) {
    try {
      console.log("\n=== Starting file deletion ===");
      console.log("Bubble ID:", bubbleId);
      console.log("File name:", fileName);
      console.log("User address:", userAddress);

      await this.verifyBubbleAccess(bubbleId, userAddress);

      const metadata = /** @type {FileGunNode} */ (/** @type {unknown} */ (
        await this.getGunNode(`bubbles/${bubbleId}/files/${fileName}`)
      ));

      if (!metadata || !metadata.filePath) {
        throw new Error('File not found');
      }

      // Verify user is owner
      if (!metadata?.owner || metadata.owner.toLowerCase() !== userAddress?.toLowerCase()) {
        throw new Error('Only file owner can delete files');
      }

      // Delete file from filesystem
      if (metadata?.filePath) {
        await fs.unlink(metadata.filePath);
        console.log("File deleted from filesystem");
      }

      // Delete shared files
      const bubblePath = metadata.filePath ? path.dirname(metadata.filePath) : '';
      const files = await fs.readdir(bubblePath);
      const deletePromises = files
        .filter(file => file.startsWith('shared_') && file.endsWith(fileName))
        .map(file => fs.unlink(path.join(bubblePath, file))
          .then(() => console.log("Shared file deleted:", file))
          .catch(err => console.error("Error deleting shared file:", file, err))
        );
      
      await Promise.all(deletePromises);

      // Delete from GUN with timeout
      const filePath = `bubbles/${bubbleId}/files/${fileName}`;
      await Promise.race([
        new Promise((resolve, reject) => {
          // Delete shared data first
          this.gun.get(`${filePath}/sharedWith`).map().once((data, key) => {
            if (key !== '_') {
              this.gun.get(`${filePath}/sharedWith`).get(key).put({ _: { '#': null } });
            }
          });

          // Delete main file data - usando un oggetto vuoto invece di null
          this.gun.get(filePath).put({ 
            _: { '#': null },
            name: null,
            owner: null,
            content: null,
            created: null,
            updated: null,
            readOnly: null,
            sharedWith: null,
            filePath: null
          }, ack => {
            if (ack.err) reject(new Error(ack.err));
            else resolve(true);
          });
        }),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('GUN deletion timeout')), 5000)
        )
      ]);

      console.log("File metadata cleared from GUN");
      return { success: true };

    } catch (error) {
      console.error('Error in handleDeleteFile:', error);
      throw error;
    }
  }

  /**
   * Handles bubble deletion
   * @param {string} bubbleId
   * @param {string} userAddress
   * @returns {Promise<DeleteResult>}
   */
  async handleDeleteBubble(bubbleId, userAddress) {
    try {
      console.log("\n=== Starting bubble deletion ===");
      console.log("Bubble ID:", bubbleId);
      console.log("User address:", userAddress);

      await this.verifyBubbleOwnership(bubbleId, userAddress);

      // Delete bubble directory from filesystem
      const bubblePath = path.join(BUBBLE_ROOT, bubbleId);
      try {
        await fs.rm(bubblePath, { recursive: true, force: true });
        console.log("Bubble directory deleted from filesystem");
      } catch (error) {
        console.error("Error deleting bubble directory:", error);
      }

      // Safely delete data from GUN
      const gunBubblePath = `bubbles/${bubbleId}`;

      // Delete shared data for each file first
      const files = await this.getGunNode(`${gunBubblePath}/files`);
      if (files) {
        for (const fileName in files) {
          if (fileName === '_') continue;
          
          // Set shared data to null
          await new Promise(resolve => {
            this.gun.get(`${gunBubblePath}/files/${fileName}/sharedWith`).map().once((data, key) => {
              if (key !== '_') {
                this.gun.get(`${gunBubblePath}/files/${fileName}/sharedWith`).get(key).put({ _: { '#': null } });
              }
            });
            resolve();
          });

          // Set file metadata to null
          await new Promise(resolve => {
            this.gun.get(`${gunBubblePath}/files/${fileName}`).put({ _: { '#': null } }, ack => {
              resolve();
            });
          });
        }
      }

      // Set bubble metadata to null
      await new Promise(resolve => {
        this.gun.get(gunBubblePath).put({ _: { '#': null } }, ack => {
          resolve();
        });
      });

      console.log("Bubble data cleared from GUN");
      return { success: true };

    } catch (error) {
      console.error('Error in handleDeleteBubble:', error);
      throw error;
    }
  }
} 