import { ethers } from "ethers";
import Gun from "gun";

export interface KeyPair {
  epriv?: string;
  epub?: string;
  priv?: string;
  pub?: string;
}

export interface ExtendedSigner extends ethers.Signer {
  address: string;
  privateKey: string;
  provider: Object;
}

export interface GunExtended extends Gun {
  get: (path: string) => any;
  put: (data: any) => void;
  set: (data: any) => void;
  map: () => any;
  on: (event: string, callback: Function) => any;
  once: (callback: (data: any, key: string) => void) => void;
  verifySignature: (message: string, signature: string) => Promise<string>;
  _: {
    opt: any;
  };
  user: () => any;
}

export interface FileGunNode {
  name: string;
  owner: string;
  filePath: string;
  created: number;
  updated: number;
  size: number;
  readOnly?: boolean;
  encryptionInfo: {
    ownerEpub: string;
    ownerAddress: string;
  };
}

export interface StealthPayment {
  stealthAddress: string;
  senderPublicKey: string;
  spendingPublicKey: string;
  timestamp: number;
  source: 'onChain' | 'offChain' | 'both';
  id?: string;
  wallet?: ethers.Wallet;
}

export interface StealthOptions {
  source?: 'onChain' | 'offChain' | 'both';
  chain?: string;
} 