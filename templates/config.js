// @ts-check

/** @type {Object.<string, string|number|{[key: string]: string}>} */
export const CONFIG = {
  RPC_URL: process.env.RPC_URL || "http://127.0.0.1:8545",
  PRIVATE_KEY: process.env.PRIVATE_KEY || "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
  CHAIN: process.env.CHAIN || "localhost",
  BACKUP_INTERVAL: Number(process.env.BACKUP_INTERVAL) || 60, // 5 minuti in ms
  MAX_BACKUPS: Number(process.env.MAX_BACKUPS) || 5,
  PINATA_JWT: process.env.PINATA_JWT || "",
  GUN_PEERS: process.env.GUN_PEERS || "http://localhost:8765/gun",
  GUN_DIR: process.env.GUN_DIR || "radata",
  BUBBLES_DIR: process.env.BUBBLES_DIR || "bubbles",
  BACKUP_TYPES: {
    BUBBLE: "bubbles",
    GUN: "radata",
  },
}; 