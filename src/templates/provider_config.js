// @ts-check

/** @type {Object.<string, string|number|{[key: string]: string}>} */
export const CONFIG = {
  RPC_URL: process.env.RPC_URL,
  PRIVATE_KEY: process.env.PRIVATE_KEY,
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
