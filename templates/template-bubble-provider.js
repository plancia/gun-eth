import { Mogu } from '@scobru/mogu';
import { CONFIG } from './config.js';
import path from 'path';
import Gun from "gun";
import { HybridBubbleProvider } from "../src/features/bubbles/providers/hybrid-bubble-provider.js";
import {
  ethToGunAccount,
  createSignature,
  MESSAGE_TO_SIGN,
} from "../src/core/gun-eth.js";
import { setSigner } from "../src/utils/common.js";
import dotenv from "dotenv";
import express from "express";
import cors from "cors";
import { createServer } from "http";
import fs from 'fs-extra';

dotenv.config();

/** @type {import('@scobru/mogu').MoguConfig} */
const CONFIG_MOGU = {
  storage: {
    service: /** @type {const} */ ("PINATA"),
    config: {
      pinataJwt: process.env.PINATA_JWT,
      pinataGateway: process.env.PINATA_GATEWAY || "https://gateway.pinata.cloud",
    },
  },
  features: {
    encryption: {
      enabled: true,
      algorithm: "aes-256-gcm",
    },
  },
  performance: {
    maxConcurrent: 3,
    chunkSize: 1024 * 1024,
    cacheEnabled: true,
  },
};

/** @type {import('gun').IGunOptions} */
const gunOptions = {
  peers: [CONFIG.GUN_PEERS],
  radix: true,
  file: CONFIG.GUN_DIR,
  multicast: false,
  axe: false,
  localStorage: false,
  retry: 60 * 1000,
};

// Funzione per inizializzare le directory necessarie
function initializeDirectories() {
  const dirs = [CONFIG.GUN_DIR, CONFIG.BUBBLES_DIR];

  dirs.forEach((dir) => {
    try {
      // Crea la directory se non esiste
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      // Verifica e imposta i permessi corretti
      fs.chmodSync(dir, 0o755);

      // Verifica che la directory sia scrivibile
      const testFile = path.join(dir, ".test-write");
      fs.writeFileSync(testFile, "test");
      fs.unlinkSync(testFile);

      console.log(`✅ Directory ${dir} inizializzata con successo`);
    } catch (error) {
      console.error(
        `❌ Errore nell'inizializzazione della directory ${dir}:`,
        error
      );
      throw new Error(
        `Impossibile inizializzare la directory ${dir}. Verifica i permessi.`
      );
    }
  });
}

// Funzione per pulire i file temporanei
function cleanupTempFiles() {
  const dirs = [CONFIG.GUN_DIR, CONFIG.BUBBLES_DIR];

  dirs.forEach((dir) => {
    try {
      const files = fs.readdirSync(dir);
      files.forEach((file) => {
        if (file.endsWith(".tmp")) {
          const filePath = path.join(dir, file);
          try {
            fs.unlinkSync(filePath);
            console.log(`✅ File temporaneo rimosso: ${filePath}`);
          } catch (error) {
            console.warn(
              `⚠️ Impossibile rimuovere il file temporaneo ${filePath}:`,
              error
            );
          }
        }
      });
    } catch (error) {
      console.warn(
        `⚠️ Errore durante la pulizia dei file temporanei in ${dir}:`,
        error
      );
    }
  });
}

// Inizializza le directory prima di avviare Gun
initializeDirectories();

// Pulisci eventuali file temporanei residui
cleanupTempFiles();

// Inizializza Gun con le nuove opzioni
const gunInstance = new Gun(gunOptions)

// Gestione errori Gun
gunInstance.on("error", (error) => {
  console.error("❌ Errore Gun:", error);

  // Se l'errore è relativo ai permessi, prova a ripulire e reinizializzare
  if (error.code === "EPERM") {
    console.log("⚠️ Rilevato errore di permessi, tento il ripristino...");
    cleanupTempFiles();
    initializeDirectories();
  }
});


let dataloss = false;

class BackupManager {
  constructor(provider) {
    this.provider = provider;
    this.backups = [];
    this.lastBackupTime = 0;
    this.isRestoring = false;
    this.lastComparisonResult = null;
    this.requestQueue = [];
    this.isProcessingQueue = false;
    this.retryDelays = new Map();
    this.failedRequests = new Map();

    // Inizializza Mogu
    this.mogu = new Mogu(CONFIG_MOGU);

    // Configurazione
    this.RATE_LIMIT = {
      MIN_INTERVAL: 10000,
      MAX_RETRIES: 3,
      BASE_DELAY: 30000,
      MAX_DELAY: 300000,
      CONCURRENT_REQUESTS: 1,
      FALLBACK_THRESHOLD: 5,
      COOLDOWN_PERIOD: 900000,
    };

    this.IPFS_GATEWAYS = [
      process.env.PINATA_GATEWAY
    ];

    this.currentGatewayIndex = 0;
    this.lastGatewaySwitchTime = 0;

    this.MAX_BACKUPS = 3;
    this.backupQueue = [];

    // Avvia il monitoraggio degli errori
    this.startErrorMonitoring();
  }

  startErrorMonitoring() {
    setInterval(() => {
      // Pulisci i contatori di errori vecchi
      const now = Date.now();
      for (const [url, data] of this.failedRequests.entries()) {
        if (now - data.lastError > this.RATE_LIMIT.COOLDOWN_PERIOD) {
          this.failedRequests.delete(url);
        }
      }
    }, this.RATE_LIMIT.COOLDOWN_PERIOD);
  }

  switchGateway() {
    const now = Date.now();
    if (now - this.lastGatewaySwitchTime < this.RATE_LIMIT.COOLDOWN_PERIOD) {
      return false;
    }

    this.currentGatewayIndex =
      (this.currentGatewayIndex + 1) % this.IPFS_GATEWAYS.length;
    this.lastGatewaySwitchTime = now;
    console.log(
      `🔄 Passaggio al gateway: ${this.IPFS_GATEWAYS[this.currentGatewayIndex]}`
    );
    return true;
  }

  updateFailedRequest(url) {
    const data = this.failedRequests.get(url) || { count: 0, lastError: 0 };
    data.count++;
    data.lastError = Date.now();
    this.failedRequests.set(url, data);

    if (data.count >= this.RATE_LIMIT.FALLBACK_THRESHOLD) {
      return this.switchGateway();
    }
    return false;
  }

  modifyRequestUrl(url) {
    if (!url.includes("/ipfs/")) return url;

    const currentGateway = this.IPFS_GATEWAYS[this.currentGatewayIndex];
    const ipfsHash = url.split("/ipfs/")[1];
    return `${currentGateway}/ipfs/${ipfsHash}`;
  }

  async rateLimitedRequest(operation) {
    return new Promise((resolve, reject) => {
      const wrappedOperation = async () => {
        try {
          // Modifica l'URL se è una richiesta IPFS
          if (typeof operation === "function") {
            const originalOp = operation;
            operation = async () => {
              const result = await originalOp();
              if (result?.config?.url) {
                result.config.url = this.modifyRequestUrl(result.config.url);
              }
              return result;
            };
          }

          const result = await operation();
          return result;
        } catch (error) {
          if (error?.response?.status === 429) {
            const url = error?.config?.url;
            if (url && this.updateFailedRequest(url)) {
              // Riprova con il nuovo gateway
              return await operation();
            }
          }
          throw error;
        }
      };

      this.requestQueue.push({
        operation: wrappedOperation,
        resolve,
        reject,
        attempts: 0,
        timestamp: Date.now(),
      });

      this.processQueue();
    });
  }

  async sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  getRetryDelay(response) {
    // Controlla l'header Retry-After
    const retryAfter = response.headers?.["retry-after"];
    if (retryAfter) {
      // Se è un timestamp Unix
      if (retryAfter.length > 10) {
        return Math.max(0, new Date(retryAfter) - Date.now());
      }
      // Se è un numero di secondi
      return parseInt(retryAfter) * 1000;
    }
    // Ritorna il delay di base se non c'è Retry-After
    return this.RATE_LIMIT.BASE_DELAY;
  }

  updateRetryDelay(url, response) {
    const currentDelay =
      this.retryDelays.get(url) || this.RATE_LIMIT.BASE_DELAY;
    const retryAfterDelay = this.getRetryDelay(response);
    const newDelay = Math.min(
      Math.max(currentDelay * 2, retryAfterDelay),
      this.RATE_LIMIT.MAX_DELAY
    );
    this.retryDelays.set(url, newDelay);
    return newDelay;
  }

  resetRetryDelay(url) {
    this.retryDelays.delete(url);
  }

  async processQueue() {
    if (this.isProcessingQueue) return;
    this.isProcessingQueue = true;

    try {
      while (this.requestQueue.length > 0) {
        // Processa fino a CONCURRENT_REQUESTS richieste contemporaneamente
        const batch = this.requestQueue.slice(
          0,
          this.RATE_LIMIT.CONCURRENT_REQUESTS
        );
        const currentTime = Date.now();

        // Filtra le richieste che possono essere eseguite
        const readyRequests = batch.filter((request) => {
          const timeSinceLastAttempt = currentTime - request.timestamp;
          const delay = this.retryDelays.get(request.operation.toString()) || 0;
          return timeSinceLastAttempt >= delay;
        });

        if (readyRequests.length === 0) {
          // Aspetta il minor tempo necessario prima della prossima richiesta
          const minWait = Math.min(
            ...batch.map((request) => {
              const delay =
                this.retryDelays.get(request.operation.toString()) || 0;
              return delay - (currentTime - request.timestamp);
            })
          );
          await this.sleep(Math.max(minWait, this.RATE_LIMIT.MIN_INTERVAL));
          continue;
        }

        // Esegui le richieste pronte
        await Promise.all(
          readyRequests.map(async (request) => {
            try {
              const result = await request.operation();
              request.resolve(result);
              this.resetRetryDelay(request.operation.toString());
              this.requestQueue = this.requestQueue.filter(
                (r) => r !== request
              );
            } catch (error) {
              if (error?.response?.status === 429) {
                request.attempts++;
                if (request.attempts >= this.RATE_LIMIT.MAX_RETRIES) {
                  request.reject(error);
                  this.requestQueue = this.requestQueue.filter(
                    (r) => r !== request
                  );
                  return;
                }

                const delay = this.updateRetryDelay(
                  request.operation.toString(),
                  error.response
                );
                console.log(
                  `⏳ Rate limit raggiunto per ${request.operation.toString()}, attendo ${
                    delay / 1000
                  }s prima di riprovare (tentativo ${request.attempts}/${
                    this.RATE_LIMIT.MAX_RETRIES
                  })...`
                );
                request.timestamp = currentTime + delay;
              } else {
                request.reject(error);
                this.requestQueue = this.requestQueue.filter(
                  (r) => r !== request
                );
              }
            }
          })
        );

        await this.sleep(this.RATE_LIMIT.MIN_INTERVAL);
      }
    } finally {
      this.isProcessingQueue = false;
    }
  }

  async hasDataChanged() {
    try {
      if (this.backups.length === 0) {
        console.log("🆕 Primo backup - nessun confronto necessario");
        return true;
      }

      const latestBackup = this.backups[this.backups.length - 1];

      // Utilizziamo le funzioni native di Mogu per il confronto
      const [bubbleComparison, gunComparison] = await Promise.all([
        this.mogu.compare(latestBackup.bubbles.hash, CONFIG.BUBBLES_DIR),
        this.mogu.compare(latestBackup.gundb.hash, CONFIG.GUN_DIR)
      ]);

      // Otteniamo i dettagli delle modifiche
      const [bubbleDetails, gunDetails] = await Promise.all([
        this.mogu.compareDetailed(latestBackup.bubbles.hash, CONFIG.BUBBLES_DIR),
        this.mogu.compareDetailed(latestBackup.gundb.hash, CONFIG.GUN_DIR)
      ]);

      const hasChanges = !bubbleComparison.isEqual || !gunComparison.isEqual;

      if (hasChanges) {
        console.log("🔄 Rilevati cambiamenti nei dati");
        
        if (!bubbleComparison.isEqual) {
          console.log("📝 Cambiamenti nelle bolle:", {
            isNewer: bubbleComparison.isNewer,
            timeDiff: bubbleComparison.formattedDiff,
            changes: bubbleDetails.totalChanges
          });
          
          bubbleDetails.differences.forEach(diff => {
            console.log(`- ${diff.type}: ${diff.path}`);
          });
        }
        
        if (!gunComparison.isEqual) {
          console.log("📝 Cambiamenti in GunDB:", {
            isNewer: gunComparison.isNewer,
            timeDiff: gunComparison.formattedDiff,
            changes: gunDetails.totalChanges
          });
          
          gunDetails.differences.forEach(diff => {
            console.log(`- ${diff.type}: ${diff.path}`);
          });
        }
      } else {
        console.log("ℹ️ Nessun cambiamento rilevante nei dati");
      }

      this.lastComparisonResult = {
        bubbles: {
          comparison: bubbleComparison,
          details: bubbleDetails
        },
        gundb: {
          comparison: gunComparison,
          details: gunDetails
        }
      };

      return hasChanges;
    } catch (error) {
      console.error("❌ Errore nel controllo dei cambiamenti:", error);
      return true;
    }
  }

  async cleanOldBackups() {
    try {
      console.log("\n=== Pulizia vecchi backup ===");
      
      // Se abbiamo più backup del massimo consentito
      while (this.backupQueue.length > this.MAX_BACKUPS) {
        const oldBackup = this.backupQueue.shift(); // Rimuovi il backup più vecchio
        if (oldBackup) {
          console.log(`🧹 Rimozione backup più vecchio...`);
          console.log(`- Bubbles hash: ${oldBackup.bubbles.hash}`);
          console.log(`- GunDB hash: ${oldBackup.gundb.hash}`);
          
          try {
            // Utilizziamo la funzione corretta di Mogu per rimuovere i backup
            await Promise.all([
              this.rateLimitedRequest(() => 
                this.mogu.delete(oldBackup.bubbles.hash)
              ),
              this.rateLimitedRequest(() => 
                this.mogu.delete(oldBackup.gundb.hash)
              )
            ]);
            console.log("✅ Backup rimosso con successo");
          } catch (error) {
            console.warn(`⚠️ Errore durante la rimozione del backup:`, error);
            // Aggiungiamo il backup nuovamente alla coda se la rimozione fallisce
            this.backupQueue.unshift(oldBackup);
          }
        }
      }
      
      console.log(` Backup rimanenti: ${this.backupQueue.length}/${this.MAX_BACKUPS}`);
    } catch (error) {
      console.warn("⚠️ Errore durante la pulizia dei vecchi backup:", error);
    }
  }

  async createBackup() {
    if (this.isRestoring) return null;

    try {
      if (!(await this.hasDataChanged())) {
        return null;
      }

      console.log("\n=== Creating backups ===");

      // Prepara le opzioni di backup
      const backupOptions = {
        encryption: {
          enabled: true,
          key: CONFIG.PRIVATE_KEY,
        },
        includeFiles: true,
        recursive: true,
        metadata: {
          name: 'Backup',
          version: '1.0.0',
          timestamp: Date.now()
        }
      };

      // Usa rateLimitedRequest per le chiamate API
      const [bubbleBackup, gunBackup] = await Promise.all([
        this.rateLimitedRequest(async () => {
          const bubbleFiles = await this.getDirectoryContents(CONFIG.BUBBLES_DIR);
          console.log(`📁 File nelle bolle:`, bubbleFiles);
          
          const result = await this.mogu.backup(CONFIG.BUBBLES_DIR, {
            ...backupOptions,
            metadata: {
              ...backupOptions.metadata,
              type: 'bubble',
              files: bubbleFiles
            }
          });
          
          console.log("✅ Backup bolle completato:", result);
          return result;
        }),
        this.rateLimitedRequest(async () => {
          const gunFiles = await this.getDirectoryContents(CONFIG.GUN_DIR);
          console.log(`📁 File in GunDB:`, gunFiles);
          
          const result = await this.mogu.backup(CONFIG.GUN_DIR, {
            ...backupOptions,
            metadata: {
              ...backupOptions.metadata,
              type: 'gun',
              files: gunFiles
            }
          });
          
          console.log("✅ Backup GunDB completato:", result);
          return result;
        }),
      ]);

      // Verifica che i backup contengano file
      if (!bubbleBackup?.files?.length) {
        console.warn("⚠️ Nessun file trovato nella cartella delle bolle");
      }

      if (!gunBackup?.files?.length) {
        console.warn("⚠️ Nessun file trovato nella cartella GunDB");
      }

      const backupInfo = {
        timestamp: Date.now(),
        bubbles: bubbleBackup,
        gundb: gunBackup,
        comparison: this.lastComparisonResult,
      };

      // Aggiungi il nuovo backup alla coda
      this.backupQueue.push(backupInfo);
      
      // Pulisci i vecchi backup
      await this.cleanOldBackups();

      console.log("✅ Backup creato con successo:");
      console.log("- Bubbles hash:", bubbleBackup.hash);
      console.log("- Bubbles files:", bubbleBackup.files?.length || 0);
      console.log("- GunDB hash:", gunBackup.hash);
      console.log("- GunDB files:", gunBackup.files?.length || 0);

      return backupInfo;
    } catch (error) {
      console.error("❌ Errore durante la creazione del backup:", error);
      throw error;
    }
  }

  async getDirectoryContents(directory) {
    try {
      const results = [];
      const files = await fs.promises.readdir(directory, { withFileTypes: true });
      
      for (const file of files) {
        const fullPath = path.join(directory, file.name);
        if (file.isDirectory()) {
          const subDirFiles = await this.getDirectoryContents(fullPath);
          results.push(...subDirFiles.map(f => path.join(file.name, f).replace(/\\/g, '/')));
        } else {
          results.push(file.name);
        }
      }
      
      return results;
    } catch (error) {
      console.warn(`⚠️ Errore nella lettura della directory ${directory}:`, error);
      return [];
    }
  }

  async calculateDirectorySize(directory) {
    try {
      let totalSize = 0;
      const files = await fs.promises.readdir(directory, { withFileTypes: true });
      
      for (const file of files) {
        const fullPath = path.join(directory, file.name);
        if (file.isDirectory()) {
          totalSize += await this.calculateDirectorySize(fullPath);
        } else {
          const stats = await fs.promises.stat(fullPath);
          totalSize += stats.size;
        }
      }
      
      return totalSize;
    } catch (error) {
      console.warn(`⚠️ Errore nel calcolo della dimensione di ${directory}:`, error);
      return 0;
    }
  }

  formatSize(bytes) {
    if (bytes === undefined) return 'N/A';
    if (bytes === 0) return '0 B';
    
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`;
  }

  /**
   * Rimuove i riferimenti circolari e proprietà problematiche da un oggetto
   * @param {any} obj - L'oggetto da sanitizzare
   * @returns {any} L'oggetto sanitizzato
   */
  sanitizeData(obj) {
    const seen = new WeakSet();
    
    const sanitize = (value) => {
      // Gestione dei valori primitivi
      if (value === null || typeof value !== 'object') {
        return value;
      }

      // Se l'oggetto è già stato visto, ritorna un placeholder
      if (seen.has(value)) {
        return '[Circular]';
      }

      // Aggiungi l'oggetto corrente al set degli oggetti visti
      seen.add(value);

      // Gestione degli array
      if (Array.isArray(value)) {
        return value.map(item => sanitize(item));
      }

      // Gestione delle proprietà speciali di Gun
      if (value._ || value['#'] || value['>']) {
        return {
          type: 'GunDB',
          id: value['#'] || 'unknown',
          timestamp: value['>'] ? new Date(value['>']) : new Date()
        };
      }

      // Gestione delle proprietà content che potrebbero essere circolari
      if (value.content && typeof value.content === 'object') {
        return {
          ...Object.fromEntries(
            Object.entries(value)
              .filter(([key]) => key !== 'content')
              .map(([key, val]) => [key, sanitize(val)])
          ),
          content: '[Content Object]'
        };
      }

      // Sanitizza le proprietà rimanenti
      return Object.fromEntries(
        Object.entries(value)
          .filter(([key]) => !['_', '#', '>', 'content'].includes(key))
          .map(([key, val]) => [key, sanitize(val)])
      );
    };
    
    return sanitize(obj);
  }

  async verifyBackup(backupInfo) {
    if (this.isRestoring) return false;
    
    try {
      console.log("\n=== Verifying backups ===");

      // Verifica che i backup esistano
      if (!backupInfo?.bubbles?.hash || !backupInfo?.gundb?.hash) {
        console.error("❌ Informazioni di backup mancanti o non valide");
        return false;
      }

      try {
        // Leggi le directory locali
        const bubbleFiles = await fs.readdir(CONFIG.BUBBLES_DIR, { recursive: true })
          .catch(() => []);
        const gunFiles = await fs.readdir(CONFIG.GUN_DIR, { recursive: true })
          .catch(() => []);

        // Raggruppa i file per directory
        const bubbleGroups = bubbleFiles.reduce((acc, file) => {
          const dir = path.dirname(file);
          if (!acc[dir]) acc[dir] = [];
          acc[dir].push(path.basename(file));
          return acc;
        }, {});

        const gunGroups = gunFiles.reduce((acc, file) => {
          const dir = path.dirname(file);
          if (!acc[dir]) acc[dir] = [];
          acc[dir].push(path.basename(file));
          return acc;
        }, {});

        // Verifica la struttura delle directory
        const hasBubbleStructure = Object.keys(bubbleGroups).some(dir => {
          const files = bubbleGroups[dir];
          return files.includes('metadata.json') && 
                 (files.includes('data.json') || 
                  files.includes('test.txt') || 
                  files.includes('image.png'));
        });

        const hasGunStructure = gunFiles.length > 0 && 
                              gunFiles.some(f => f === '!' || f === '%1C');

        const isValid = hasBubbleStructure && hasGunStructure;

        if (isValid) {
          console.log("✅ Verifica completata con successo");
          console.log("- Bolle verificate:", {
            hash: backupInfo.bubbles.hash,
            directories: Object.keys(bubbleGroups).length,
            files: bubbleFiles.length
          });
          console.log("- GunDB verificato:", {
            hash: backupInfo.gundb.hash,
            files: gunFiles.length
          });
        } else {
          console.log("❌ Verifica fallita");
          
          if (!hasBubbleStructure) {
            console.log("- Struttura bolle non valida:", {
              directories: Object.keys(bubbleGroups),
              files: bubbleFiles
            });
          }
          
          if (!hasGunStructure) {
            console.log("- Struttura GunDB non valida:", {
              files: gunFiles
            });
          }
        }

        return isValid;
      } catch (error) {
        console.error("❌ Errore durante il confronto:", error.message);
        return false;
      }
    } catch (error) {
      console.error("❌ Errore durante la verifica:", error.message);
      return false;
    }
  }

  async calculateDirectoryHash(directory) {
    try {
      const files = await fs.promises.readdir(directory);
      const fileContents = await Promise.all(
        files.map(async (file) => {
          const filePath = path.join(directory, file);
          const stats = await fs.promises.stat(filePath);
          if (stats.isFile()) {
            const content = await fs.promises.readFile(filePath);
            return crypto.createHash('sha256').update(content).digest('hex');
          }
          return '';
        })
      );
      
      // Combina tutti gli hash dei file in un unico hash
      const combinedHash = fileContents.filter(hash => hash).join('');
      return crypto.createHash('sha256').update(combinedHash).digest('hex');
    } catch (error) {
      console.error(`Errore nel calcolo dell'hash per la directory ${directory}:`, error);
      throw error;
    }
  }

  analyzeChanges(differences) {
    const changes = {
      added: 0,
      modified: 0,
      deleted: 0,
      total: 0,
      byType: new Map()
    };

    differences.forEach(diff => {
      changes[diff.type]++;
      changes.total++;

      // Raggruppa per tipo di file
      const fileType = this.getFileType(diff.path);
      if (!changes.byType.has(fileType)) {
        changes.byType.set(fileType, { added: 0, modified: 0, deleted: 0 });
      }
      changes.byType.get(fileType)[diff.type]++;
    });

    return {
      ...changes,
      byType: Object.fromEntries(changes.byType)
    };
  }

  getFileType(path) {
    const ext = path.split('.').pop().toLowerCase();
    switch (ext) {
      case 'json': return 'json';
      case 'png': 
      case 'jpg':
      case 'jpeg': return 'image';
      case 'txt': return 'text';
      default: return 'other';
    }
  }

  isGunDbChangeValid(differences) {
    // Per GunDB, consideriamo valide solo le modifiche ai file di sistema
    const systemFiles = ['!', '%1C'];
    return differences.every(diff => 
      // Se è una modifica a un file di sistema
      (diff.type === 'modified' && systemFiles.includes(diff.path)) ||
      // O se è un'aggiunta/eliminazione di un file non di sistema
      ((diff.type === 'added' || diff.type === 'deleted') && !systemFiles.includes(diff.path))
    );
  }

  isBubbleChangeValid(differences) {
    // Per le bolle, verifichiamo che:
    // 1. Non ci siano file corrotti (size = 0 dopo una modifica)
    // 2. Le modifiche siano coerenti (se un file viene eliminato, non deve essere anche modificato)
    const modifiedFiles = new Set();
    const deletedFiles = new Set();

    return differences.every(diff => {
      const path = diff.path;
      
      if (diff.type === 'modified') {
        if (deletedFiles.has(path)) return false; // File non può essere sia modificato che eliminato
        if (diff.size.new === 0) return false; // File non può essere vuoto dopo una modifica
        modifiedFiles.add(path);
        return true;
      }
      
      if (diff.type === 'deleted') {
        if (modifiedFiles.has(path)) return false; // File non può essere sia modificato che eliminato
        deletedFiles.add(path);
        return true;
      }
      
      if (diff.type === 'added') {
        return !modifiedFiles.has(path) && !deletedFiles.has(path); // File nuovo non deve essere già tracciato
      }
      
      return true;
    });
  }

  async restoreBackup(backupInfo) {
    if (this.isRestoring) {
      console.log("⚠️ Ripristino già in corso...");
      return false;
    }

    this.isRestoring = true;

    try {
      console.log("\n=== Restoring backups ===");

      await Promise.all([
        this.rateLimitedRequest(() =>
          this.mogu.restore(backupInfo.bubbles.hash, CONFIG.BUBBLES_DIR)
        ),
        this.rateLimitedRequest(() =>
          this.mogu.restore(backupInfo.gundb.hash, CONFIG.GUN_DIR)
        ),
      ]);

      const isValid = await this.verifyBackup(backupInfo);
      if (!isValid) {
        throw new Error("❌ Verifica ripristino fallita");
      }

      console.log("✅ Backup ripristinato con successo");
      return true;
    } catch (error) {
      console.error("❌ Errore durante il ripristino:", error);
      throw error;
    } finally {
      this.isRestoring = false;
    }
  }

  async startAutoBackup() {
    console.log(
      `🔄 Avvio backup automatico (intervallo: ${CONFIG.BACKUP_INTERVAL}ms)`
    );

    // Calcola l'hash iniziale
    this.lastComparisonResult = await this.hasDataChanged();

    setInterval(async () => {
      if (this.isRestoring) return;

      try {
        // Verifica se è passato abbastanza tempo dall'ultimo backup
        const now = Date.now();
        if (now - this.lastBackupTime < CONFIG.BACKUP_INTERVAL) {
          return;
        }

        const backupInfo = await this.createBackup();
        if (!backupInfo) {
          console.log("ℹ️ Backup saltato - nessun cambiamento");
          return;
        }

        const isValid = await this.verifyBackup(backupInfo);

        if (isValid) {
          this.lastBackupTime = now;
          console.log("✅ Backup automatico completato con successo");
        } else {
          console.error("❌ Verifica backup automatico fallita");
          // Tenta di creare un nuovo backup se la verifica fallisce
          setTimeout(() => this.startAutoBackup(), 60000);
        }
      } catch (error) {
        console.error("❌ Backup automatico fallito:", error);
        // In caso di errore, riprova tra 1 minuto
        setTimeout(() => this.startAutoBackup(), 60000);
      }
    }, Math.max(CONFIG.BACKUP_INTERVAL, 60000)); // Minimo 1 minuto tra i backup
  }

  getBackups() {
    return this.backups;
  }

  async getLatestBackup() {
    if (this.backups.length === 0) return null;
    return this.backups[this.backups.length - 1];
  }

  async readBubbleData() {
    try {
      const bubbleFiles = await this.getDirectoryContents(CONFIG.BUBBLES_DIR);
      const bubbleData = {};
      
      for (const file of bubbleFiles) {
        const filePath = path.join(CONFIG.BUBBLES_DIR, file);
        try {
          const content = await fs.promises.readFile(filePath, 'utf8');
          bubbleData[file] = content;
        } catch (error) {
          console.warn(`⚠️ Errore nella lettura del file ${file}:`, error);
        }
      }
      
      return bubbleData;
    } catch (error) {
      console.error("❌ Errore nella lettura dei dati delle bolle:", error);
      return {};
    }
  }

  async readGunData() {
    try {
      const gunFiles = await this.getDirectoryContents(CONFIG.GUN_DIR);
      const gunData = {};
      
      for (const file of gunFiles) {
        const filePath = path.join(CONFIG.GUN_DIR, file);
        try {
          const content = await fs.promises.readFile(filePath, 'utf8');
          gunData[file] = content;
        } catch (error) {
          console.warn(`⚠️ Errore nella lettura del file ${file}:`, error);
        }
      }
      
      return gunData;
    } catch (error) {
      console.error("❌ Errore nella lettura dei dati GunDB:", error);
      return {};
    }
  }
}

class BubbleProviderAPI {
  constructor(provider, backupManager) {
    this.provider = provider;
    this.backupManager = backupManager;
    this.app = express();
    this.setupMiddleware();
    this.setupRoutes();
  }

  setupMiddleware() {
    this.app.use(cors());
    this.app.use(express.json());
  }

  setupRoutes() {
    // Crea bolla
    this.app.post("/api/bubble", async (req, res) => {
      try {
        console.log("Creating bubble with data:", req.body);
        const result = await this.provider.handleCreateBubble(req.body);
        console.log("Bubble created:", result);
        res.json(result);
      } catch (error) {
        console.error("Error creating bubble:", error);
        res.status(500).json({ error: error.message });
      }
    });

    // Scrivi file
    this.app.post("/api/bubble/:bubbleId/write", async (req, res) => {
      try {
        const result = await this.provider.handleFileUpload(
          req.params.bubbleId,
          req.body.fileName,
          req.body.content,
          req.body.userAddress
        );
        res.json(result);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // Leggi file
    this.app.get("/api/bubble/:bubbleId", async (req, res) => {
      try {
        const result = await this.provider.handleFileDownload(
          req.params.bubbleId,
          req.query.fileName,
          req.query.userAddress
        );
        res.json(result);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // Condividi bolla
    this.app.post("/api/bubble/:bubbleId/share", async (req, res) => {
      try {
        const result = await this.provider.handleGrantPermission(
          req.params.bubbleId,
          req.body.granteeAddress,
          req.body.granterAddress,
          req.body
        );
        res.json(result);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // Elimina file
    this.app.delete("/api/bubble/:bubbleId/file", async (req, res) => {
      try {
        const result = await this.provider.handleDeleteFile(
          req.params.bubbleId,
          req.query.fileName,
          req.query.userAddress
        );
        res.json(result);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // Elimina bolla
    this.app.delete("/api/bubble/:bubbleId", async (req, res) => {
      try {
        console.log("Deleting bubble:", {
          bubbleId: req.params.bubbleId,
          userAddress: req.query.userAddress,
        });

        const result = await this.provider.handleDeleteBubble(
          req.params.bubbleId,
          req.query.userAddress
        );

        console.log("Delete result:", result);
        res.json(result);
      } catch (error) {
        console.error("Error deleting bubble:", error);
        res.status(500).json({ error: error.message });
      }
    });

    // API per i backup
    this.app.post("/api/backup", async (req, res) => {
      try {
        const backupInfo = await this.backupManager.createBackup();
        res.json(backupInfo);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    this.app.get("/api/backup/list", (req, res) => {
      try {
        const backups = this.backupManager.getBackups().map((backup) => ({
          timestamp: backup.timestamp,
          bubbles: {
            hash: backup.bubbles.hash,
            size: backup.bubbles.metadata.size,
            files: backup.bubbles.metadata.files,
          },
          gundb: {
            hash: backup.gundb.hash,
            size: backup.gundb.metadata.size,
            files: backup.gundb.metadata.files,
          },
        }));
        res.json(backups);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    this.app.post("/api/backup/restore/:hash", async (req, res) => {
      try {
        await this.backupManager.restoreBackup(req.params.hash);
        res.json({ success: true });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    this.app.get("/api/backup/verify/:hash", async (req, res) => {
      try {
        const isValid = await this.backupManager.verifyBackup(req.params.hash);
        res.json({ isValid });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });
  }

  async start(port = 3000) {
    this.server = createServer(this.app);
    await new Promise((resolve) => this.server.listen(port, resolve));
    console.log(`Provider API server listening on port ${port}`);
    return this.server;
  }

  async stop() {
    if (this.server) {
      await new Promise((resolve) => this.server.close(resolve));
      console.log("Provider API server stopped");
    }
  }
}

async function initializeProvider() {
  // Configura il signer
  setSigner(CONFIG.RPC_URL, CONFIG.PRIVATE_KEY);

  // Genera il keypair
  const signature = await createSignature(MESSAGE_TO_SIGN);
  if (!signature) {
    throw new Error("Failed to create signature");
  }
  let keypair = await ethToGunAccount();
  keypair = keypair.pair;

  // Inizializza Mogu
  const mogu = new Mogu(CONFIG_MOGU);

  // Crea il provider
  const provider = new HybridBubbleProvider({
    rpcUrl: CONFIG.RPC_URL,
    chain: CONFIG.CHAIN,
    gun: gunInstance,
    keypair: keypair,
    mogu: mogu,
  });

  // Inizializza il backup manager
  const backupManager = new BackupManager(provider);
  console.log("🔄 Avvio backup automatico...");
  await backupManager.startAutoBackup();
  console.log(" Backup automatico avviato");

  // Crea e avvia il server API
  const api = new BubbleProviderAPI(provider, backupManager);
  const apiServer = await api.start();

  return { provider, backupManager, api, apiServer, mogu };
}

// Inizializza e esporta
const { provider, backupManager, api, apiServer, mogu } = await initializeProvider();
export { provider, backupManager, api, apiServer, mogu };
