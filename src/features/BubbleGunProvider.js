/**
 * @typedef {Object} FileMetadata
 * @property {string} name - Name of the file
 * @property {string} owner - Address of file owner
 * @property {number} created - Creation timestamp
 * @property {number} updated - Last update timestamp
 * @property {string} filePath - File path
 * @property {number} size - File size
 * @property {Object} encryptionInfo - Encryption info
 * @property {string} encryptionInfo.ownerEpub - Owner's public key
 * @property {string} encryptionInfo.ownerAddress - Owner's address
 * @property {boolean} readOnly - Whether file is read-only
 */

/**
 * @typedef {Object} BubbleMetadata
 * @property {string} id - Unique bubble ID
 * @property {string} name - Name of the bubble
 * @property {string} owner - Address of bubble owner
 * @property {boolean} isPrivate - Whether bubble is private
 * @property {number} createdAt - Creation timestamp
 */

/**
 * @typedef {Object} FileDownloadResult
 * @property {string} content - Decrypted file content
 * @property {FileMetadata} metadata - File metadata
 */

/**
 * @typedef {Object} GrantPermissionOptions
 * @property {string} granteeEpub - Public encryption key of grantee
 */

import { BubbleBaseProvider } from "./BubbleBaseProvider.js";
import { getSigner } from "../gun-eth.js";
import { encrypt, decrypt, deriveSharedKey } from "../utils/encryption.js";

export class BubbleGunProvider extends BubbleBaseProvider {
  constructor(options) {
    super(options);

    // Configura il Gun user
    this.user = this.gun.user();
    this.user.auth(this.keypair);

    // Debug log
    console.log("GUNBubbleProvider initialized:", {
      hasGun: !!this.gun,
      hasUser: !!this.user,
      hasKeypair: !!this.keypair,
      hasBubbleRoot: !!this.bubbleRoot,
      gunOpts: this.gun._.opt,
    });

    // Verifica che Gun sia pronto
    this.gun.on("hi", (peer) => {
      console.log("Connected to peer:", peer);
    });

    this.gun.on("error", (error) => {
      console.error("Gun error:", error);
    });
  }

  /**
   * @typedef {Object} FileDownloadParams
   * @property {string} bubbleId - ID of the bubble
   * @property {string} fileName - Name of the file to download
   * @property {string} userAddress - Ethereum address of the user
   */

  /**
   * Handles file download
   * @param {string} bubbleId - ID of the bubble
   * @param {string} fileName - Name of the file to download
   * @param {string} userAddress - Ethereum address of the user
   */
  async handleFileDownload(bubbleId, fileName, userAddress) {
    try {
      if (!this.keypair) throw new Error("Keypair not initialized");

      console.log("\n=== Starting file download ===");
      console.log("Bubble ID:", bubbleId);
      console.log("File name:", fileName);
      console.log("User address:", userAddress);

      await this.verifyBubbleAccess(bubbleId, userAddress);

      const filePath = `bubbles/${bubbleId}/files/${fileName}`;
      console.log("Reading from path:", filePath);

      const fileData = await new Promise((resolve) => {
        this.gun.get(filePath).once((data) => {
          console.log("File data retrieved:", data);
          resolve(data);
        });
      });

      if (!fileData) {
        console.error("File not found at path:", filePath);
        throw new Error("File not found");
      }

      let content;
      const normalizedUserAddress = userAddress.toLowerCase();

      if (fileData.owner.toLowerCase() === normalizedUserAddress) {
        console.log("User is owner, decrypting with owner key");
        content = await decrypt(fileData.content, this.keypair);
      } else {
        console.log("User is not owner, looking for shared content");

        const sharedPath = `${filePath}/sharedWith/${normalizedUserAddress}`;
        console.log("Looking for shared data at:", sharedPath);

        const sharedData = await new Promise((resolve) => {
          this.gun.get(sharedPath).once((data) => {
            console.log("Shared data loaded:", data);
            resolve(data);
          });
        });

        if (!sharedData || !sharedData.content || !sharedData.ownerEpub) {
          console.error("Shared data not found or incomplete:", sharedData);
          throw new Error("Shared content not found");
        }

        try {
          // Use deriveSharedKey to get the shared key
          const sharedKeypair = await deriveSharedKey(
            sharedData.ownerEpub,
            this.keypair
          );
          console.log("Shared key derived");

          // Decrypt the content using the shared key
          content = await decrypt(sharedData.content, sharedKeypair);
          if (!content) {
            throw new Error("Failed to decrypt content");
          }
          console.log("Content decrypted successfully");
        } catch (error) {
          console.error("Decryption error:", {
            phase: error.message.includes("key")
              ? "key derivation"
              : "content decryption",
            error: error.message,
            sharedData: {
              hasContent: !!sharedData.content,
              hasOwnerEpub: !!sharedData.ownerEpub,
              contentLength: sharedData.content?.length,
            },
          });
          throw error;
        }
      }

      return {
        content,
        metadata: {
          name: fileData.name,
          owner: fileData.owner,
          filePath: fileData.filePath,
          created: fileData.created,
          updated: fileData.updated,
          size: fileData.size,
          readOnly: fileData.readOnly || false,
          encryptionInfo: fileData.encryptionInfo,
        },
      };
    } catch (error) {
      console.error("Error downloading file:", error);
      throw error;
    }
  }

  /**
   * @typedef {Object} FileUploadOptions
   * @property {string} bubbleId - ID of the bubble
   * @property {string} fileName - Name of the file
   * @property {string} content - Content of the file
   * @property {string} userAddress - Address of the user
   */
  async handleFileUpload(bubbleId, fileName, content, userAddress) {
    try {
      console.log("\n=== Starting file upload ===");
      console.log("Bubble ID:", bubbleId);
      console.log("File name:", fileName);
      console.log("User address:", userAddress);

      if (!this.keypair) {
        throw new Error("Keypair not initialized");
      }

      await this.verifyBubbleAccess(bubbleId, userAddress);

      // Encrypt the content
      console.log("Encrypting content...");
      const encryptedContent = await encrypt(content, this.keypair);
      console.log("Content encrypted successfully");

      // Create the file metadata
      const fileMetadata = {
        name: fileName,
        owner: userAddress,
        content: encryptedContent,
        created: Date.now(),
        updated: Date.now(),
        readOnly: false,
        sharedWith: {},
      };

      console.log("Saving to GUN...");

      // Use a more direct approach with GUN
      return new Promise((resolve, reject) => {
        // Create the full path for the file
        const filePath = `bubbles/${bubbleId}/files/${fileName}`;
        console.log("File path:", filePath);

        // Save directly to the path as an object
        this.gun.get(filePath).put(fileMetadata, (ack) => {
          if (ack.err) {
            console.error("Save error:", ack.err);
            reject(new Error(ack.err));
            return;
          }

          console.log("Initial save successful, verifying...");

          // Verify the save
          this.gun.get(filePath).once((data) => {
            if (!data || !data.content) {
              console.error("Verification failed:", data);
              reject(new Error("File verification failed"));
              return;
            }

            console.log("File saved and verified successfully:", {
              name: data.name,
              owner: data.owner,
              hasContent: !!data.content,
              created: new Date(data.created).toISOString(),
            });

            resolve(fileMetadata);
          });
        });

        // Set a timeout for the verification
        setTimeout(() => {
          this.gun.get(filePath).once((data) => {
            if (data && data.content) {
              console.log("Save operation taking too long, checking state...");
              console.log("Data found after timeout, resolving...");
              resolve(fileMetadata);
            }
          });
        }, 5000);
      });
    } catch (error) {
      console.error("Error uploading file:", error);
      throw error;
    }
  }

  /**
   * @typedef {Object} GrantPermissionOptions
   * @property {string} granteeEpub - Public encryption key of grantee
   */
  async handleGrantPermission(
    bubbleId,
    targetAddress,
    granterAddress,
    options = {}
  ) {
    try {
      console.log("\n=== Starting handleGrantPermission ===");

      if (!options.granteeEpub) {
        throw new Error("Grantee epub key is required");
      }

      await this.verifyBubbleOwnership(bubbleId, granterAddress);
      await this.grantOnChainAccess(bubbleId, targetAddress);

      const filesPath = `bubbles/${bubbleId}/files`;
      console.log("Files path:", filesPath);

      const fileData = await this.getGunNode(`${filesPath}/secret.txt`);
      console.log("File data:", fileData);

      if (!fileData || !fileData.content) {
        console.log("No file content found");
        return { success: true };
      }

      try {
        // Decrypt the original content
        const decryptedContent = await decrypt(fileData.content, this.keypair);
        console.log("Original content decrypted");

        // Use deriveSharedKey to get the shared key
        const sharedKeypair = await deriveSharedKey(
          options.granteeEpub,
          this.keypair
        );
        console.log("Shared key derived successfully");

        // Encrypt the content with the shared key
        const encryptedContent = await encrypt(decryptedContent, sharedKeypair);
        console.log("Content re-encrypted with shared key");

        const sharedPath = `${filesPath}/secret.txt/sharedWith/${targetAddress.toLowerCase()}`;
        console.log("Saving shared data at:", sharedPath);

        const sharedData = {
          address: targetAddress,
          grantedAt: Date.now(),
          content: encryptedContent,
          ownerEpub: this.keypair.epub,
        };

        await this.putGunData(sharedPath, sharedData);
        console.log("Shared data saved successfully");

        return { success: true };
      } catch (error) {
        console.error("Error processing file:", error);
        throw error;
      }
    } catch (error) {
      console.error("Error in handleGrantPermission:", error);
      throw error;
    }
  }

  /**
   * @typedef {Object} BubbleParams
   * @property {string} name - The name of the bubble
   * @property {boolean} isPrivate - Whether the bubble is private
   * @property {string} userAddress - The address of the user creating the bubble
   */

  /**
   * Handles the creation of a new bubble.
   * @param {BubbleParams} params - The parameters for bubble creation
   */
  async handleCreateBubble(params) {
    const { name, isPrivate, userAddress } = params;

    if (!name || typeof isPrivate !== "boolean" || !userAddress) {
      throw new Error("Invalid parameters for bubble creation");
    }

    try {
      console.log("Starting bubble creation...");
      console.log("Parameters:", params);

      // Get the signer
      console.log("Getting signer...");
      const signer = await getSigner();

      // Create the bubble on-chain
      console.log("Creating bubble on-chain...");
      const contractWithSigner = this.contract.connect(signer);
      const tx = await contractWithSigner.createBubble(name, isPrivate);
      console.log("Transaction sent:", tx.hash);

      console.log("Waiting for transaction...");
      const receipt = await tx.wait();

      // Extract the bubble ID from the event
      console.log("Parsing event...");
      const event = receipt.logs.find((log) => {
        try {
          const parsedLog = this.contract.interface.parseLog(log);
          return parsedLog.name === "BubbleCreated";
        } catch (e) {
          return false;
        }
      });

      if (!event) {
        throw new Error("Bubble creation event not found");
      }

      const parsedEvent = this.contract.interface.parseLog(event);
      const bubbleId = parsedEvent.args[0];
      console.log("Bubble ID:", bubbleId);

      // Create the metadata
      const metadata = {
        id: bubbleId,
        name,
        owner: userAddress,
        isPrivate,
        createdAt: Date.now(),
      };

      // Save the metadata to GUN
      console.log("Saving metadata to GUN...");
      await new Promise((resolve, reject) => {
        this.gun
          .get("bubbles")
          .get(bubbleId)
          .put(metadata, (ack) => {
            if (ack.err) {
              console.error("GUN save error:", ack.err);
              reject(new Error(ack.err));
            } else {
              console.log("GUN save successful");
              resolve();
            }
          });
      });

      console.log("Metadata saved successfully:", metadata);
      return metadata;
    } catch (error) {
      console.error("Error creating bubble:", error);
      throw error;
    }
  }

  /**
   * @typedef {Object} DeleteFileOptions
   * @property {string} bubbleId - The ID of the bubble
   * @property {string} fileName - The name of the file to delete
   * @property {string} userAddress - The address of the user requesting the deletion
   */
  async handleDeleteFile(bubbleId, fileName, userAddress) {
    try {
      console.log("\n=== Starting file deletion ===");
      console.log("Bubble ID:", bubbleId);
      console.log("File name:", fileName);
      console.log("User address:", userAddress);

      // Verify access
      await this.verifyBubbleAccess(bubbleId, userAddress);

      // Build the file path
      const filePath = `bubbles/${bubbleId}/files/${fileName}`;
      console.log("Deleting file at path:", filePath);

      // Load the file data to verify ownership
      const fileData = await new Promise((resolve) => {
        this.gun.get(filePath).once(resolve);
      });

      if (!fileData) {
        throw new Error("File not found");
      }

      // Verify that the user is the owner
      if (fileData.owner.toLowerCase() !== userAddress.toLowerCase()) {
        throw new Error("Only file owner can delete files");
      }

      // Delete the file and its metadata
      return new Promise((resolve, reject) => {
        // First delete the shared data
        const sharedWithNode = this.gun.get(filePath).get("sharedWith");
        sharedWithNode.map().once((data, key) => {
          if (key !== "_") {
            sharedWithNode.get(key).put(null);
          }
        });

        // Then delete the file itself by setting all fields to null
        const fileNode = this.gun.get(filePath);
        const nullData = {
          name: null,
          owner: null,
          content: null,
          created: null,
          updated: null,
          readOnly: null,
          sharedWith: null,
        };

        fileNode.put(nullData, (ack) => {
          if (ack.err) {
            console.error("Error nullifying file data:", ack.err);
            reject(new Error(ack.err));
            return;
          }

          // Remove the file reference from the bubble's file list
          this.gun
            .get(`bubbles/${bubbleId}/files`)
            .get(fileName)
            .put(null, (ack) => {
              if (ack.err) {
                console.error("Error removing file reference:", ack.err);
                reject(new Error(ack.err));
                return;
              }

              console.log("File deleted successfully");
              resolve({ success: true });
            });
        });
      });
    } catch (error) {
      console.error("Error deleting file:", error);
      throw error;
    }
  }

  /**
   * @typedef {Object} DeleteBubbleResult
   * @property {boolean} success - Indicates if the bubble was successfully deleted
   */

  /**
   * Deletes a bubble and all its contents.
   * @param {string} bubbleId - The ID of the bubble to delete.
   * @param {string} userAddress - The address of the user requesting the deletion.
   * @returns {Promise<DeleteBubbleResult>} - The result of the deletion operation.
   */
  async handleDeleteBubble(bubbleId, userAddress) {
    try {
      console.log("\n=== Starting bubble deletion ===");
      console.log("Bubble ID:", bubbleId);
      console.log("User address:", userAddress);

      // Verify bubble ownership
      await this.verifyBubbleOwnership(bubbleId, userAddress);

      // Build the bubble path
      const bubblePath = `bubbles/${bubbleId}`;
      console.log("Deleting bubble at path:", bubblePath);

      // Delete the bubble and all its contents
      return new Promise((resolve, reject) => {
        // First delete all files in the bubble
        this.gun
          .get(bubblePath)
          .get("files")
          .map()
          .once((fileData, fileName) => {
            if (fileName === "_") return;

            // Delete shared data for each file
            this.gun
              .get(bubblePath)
              .get("files")
              .get(fileName)
              .get("sharedWith")
              .map()
              .once((sharedData, sharedAddress) => {
                if (sharedAddress === "_") return;

                // Set shared data to null
                this.gun
                  .get(bubblePath)
                  .get("files")
                  .get(fileName)
                  .get("sharedWith")
                  .get(sharedAddress)
                  .put(null);
              });

            // Set file metadata to null
            this.gun.get(bubblePath).get("files").get(fileName).put({
              name: null,
              owner: null,
              content: null,
              created: null,
              updated: null,
              readOnly: null,
              sharedWith: null,
            });
          });

        // Then set bubble metadata to null
        this.gun.get(bubblePath).put(
          {
            id: null,
            name: null,
            owner: null,
            isPrivate: null,
            createdAt: null,
            files: null,
          },
          (ack) => {
            if (ack.err) {
              console.error("Error nullifying bubble data:", ack.err);
              reject(new Error(ack.err));
              return;
            }

            console.log("Bubble data nullified successfully");
            resolve({ success: true });
          }
        );
      });
    } catch (error) {
      console.error("Error deleting bubble:", error);
      throw error;
    }
  }
}
