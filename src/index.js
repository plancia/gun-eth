import {
  MESSAGE_TO_SIGN,
  generateRandomId,
  getSigner,
  generatePassword,
  verifySignature,
  initializeGun,
  extendGun,
  createSignature,
  setSigner,
  gunToEthAccount,
  ethToGunAccount,
  decryptWithPassword,
  encryptWithPassword,
  encrypt,
  decrypt,
  convertToEthAddress,
} from "./gun-eth.js";

import { StealthChain } from "./features/StealthChain.js";

const GunEth = {
  MESSAGE_TO_SIGN,
  generateRandomId,
  getSigner,
  generatePassword,
  verifySignature,
  initializeGun,
  extendGun,
  createSignature,
  setSigner,
  gunToEthAccount,
  ethToGunAccount,
  decryptWithPassword,
  encryptWithPassword,
  encrypt,
  decrypt,
  convertToEthAddress,
  StealthChain,
};

// Funzioni helper per StealthChain
GunEth.createStealthTransaction = async (
  provider,
  chainId,
  receiverViewingKey,
  receiverSpendingKey
) => {
  const stealthChain = new StealthChain(provider, chainId);

  // Verifica supporto chain
  const isSupported = await stealthChain.isOnSupportedChain();
  if (!isSupported) {
    await stealthChain.requestChainSwitch();
  }

  // Genera indirizzo stealth
  const stealthInfo = await stealthChain.generateStealthAddress(
    receiverViewingKey,
    receiverSpendingKey
  );

  // Crea annuncio
  const announcement = stealthChain.createStealthAnnouncement(
    stealthInfo.stealthAddress,
    stealthInfo.senderEphemeralPublicKey,
    receiverViewingKey,
    receiverSpendingKey
  );

  // Annuncia il pagamento
  const tx = await stealthChain.announceStealthPayment(
    announcement.stealthAddress,
    announcement.senderEphemeralKey,
    announcement.receiverViewingKey,
    announcement.receiverSpendingKey
  );

  return {
    stealthInfo,
    announcement,
    transaction: tx,
  };
};

GunEth.recoverStealthFunds = async (
  provider,
  chainId,
  stealthAddress,
  senderPublicKey,
  signature,
  spendingPublicKey
) => {
  const stealthChain = new StealthChain(provider, chainId);

  // Verifica supporto chain
  const isSupported = await stealthChain.isOnSupportedChain();
  if (!isSupported) {
    await stealthChain.requestChainSwitch();
  }

  // Recupera i fondi
  return await stealthChain.recoverStealthFunds(
    stealthAddress,
    senderPublicKey,
    signature,
    spendingPublicKey
  );
};

GunEth.getStealthPayments = async (
  provider,
  chainId,
  viewingKey,
  options = {}
) => {
  const stealthChain = new StealthChain(provider, chainId);

  // Verifica supporto chain
  const isSupported = await stealthChain.isOnSupportedChain();
  if (!isSupported) {
    await stealthChain.requestChainSwitch();
  }

  // Recupera i pagamenti
  return await stealthChain.getStealthPayments(viewingKey, options);
};

// @ts-ignore
if (typeof window !== "undefined") {
  // @ts-ignore
  window.GunEth = GunEth;
}

export { GunEth };
