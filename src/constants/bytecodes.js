import { createRequire } from 'module';
const require = createRequire(import.meta.url);

// Importa il bytecode dagli artifacts
const StealthAnnouncer = require('../../artifacts/contracts/StealthAnnouncer.sol/StealthAnnouncer.json');

// Esporta il bytecode del contratto StealthAnnouncer
export const StealthAnnouncerBytecode = StealthAnnouncer.bytecode;

// Esporta anche altri bytecode se necessario
// export const BubbleRegistryBytecode = BubbleRegistry.bytecode;
// export const BubbleProxyBytecode = BubbleProxy.bytecode;
// export const ProofOfIntegrityBytecode = ProofOfIntegrity.bytecode; 