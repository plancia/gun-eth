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
  createAndStoreEncryptedPair,
  getAndDecryptPair,
  decryptWithPassword,
  encryptWithPassword,
  encrypt,
  decrypt
} from './gun-eth.js';

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
  createAndStoreEncryptedPair,
  getAndDecryptPair,
  decryptWithPassword,
  encryptWithPassword,
  encrypt,
  decrypt,
  async init(options = {}) {
    try {
      // Configurazione di default
      const defaultOptions = {
        peers: ['http://localhost:8765/gun'],
        localStorage: false,
        radisk: true,
        ...options
      };

      // Inizializza Gun
      let gun;
      try {
        gun = initializeGun(defaultOptions);
      } catch (error) {
        console.error("Errore nell'inizializzazione di Gun:", error);
        throw new Error("Impossibile inizializzare Gun");
      }

      // Verifica la connessione con MetaMask
      try {
        const signer = await getSigner();
        if (!signer) {
          throw new Error("MetaMask non disponibile");
        }
        
        // Verifica che possiamo ottenere l'indirizzo
        const address = await signer.getAddress();
        if (!address) {
          throw new Error("Impossibile ottenere l'indirizzo Ethereum");
        }
        
        console.log("MetaMask connesso con indirizzo:", address);
      } catch (error) {
        console.error("Errore nella connessione con MetaMask:", error);
        throw new Error("Impossibile connettersi a MetaMask");
      }

      return this;
    } catch (error) {
      console.error("Errore durante l'inizializzazione di GunEth:", error);
      throw error;
    }
  }
};

// Esponi GunEth globalmente nel browser
if (typeof window !== 'undefined') {
  window.GunEth = GunEth;
}

export { GunEth }; 