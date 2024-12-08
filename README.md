# Gun-ETH 🔫

![Gun-ETH Logo](landing/assets/hero-image.webp)

Un potente plugin per Gun.js che estende le sue capacità aggiungendo funzionalità blockchain e crittografiche avanzate per creare applicazioni decentralizzate più sicure e private.

## ✨ Perché Gun-ETH?

- 🎯 **Estensione Potente**: Aggiunge funzionalità blockchain e crittografiche avanzate a Gun.js
- 🌐 **Integrazione Seamless**: Si integra perfettamente con Gun.js mantenendone la semplicità
- 🔒 **Privacy Avanzata**: Implementa transazioni stealth, proof chain e bolle crittografate
- 🚀 **Architettura Modulare**: API intuitive per implementare facilmente funzionalità Web3

## 🌟 Caratteristiche Principali

### 🔒 Stealth Chain
- Transazioni private con indirizzi stealth
- Massima privacy nelle comunicazioni
- Sistema di annunci on-chain

### ⛓️ Proof Chain
- Verifica crittografica dei dati
- Ancoraggio su blockchain
- Monitoraggio delle modifiche

### 🫧 Bolle Crittografate
- Container di dati sicuri
- Crittografia end-to-end
- Gestione avanzata delle autorizzazioni

### 🔐 Integrazione Web3
- Conversione seamless tra account Gun e Ethereum
- Supporto per firme e autenticazione
- Gestione completa delle chiavi

## 🚀 Quick Start

### Installazione

\`\`\`bash
npm install gun-eth
# o
yarn add gun-eth
\`\`\`

### Configurazione Base

\`\`\`javascript
// Inizializza Gun-Eth
import { GunEth } from 'gun-eth';
import Gun from 'gun';

// Configura Gun con i peers
const gun = Gun({
    peers: ['http://localhost:8765/gun']
});

// Inizializza GunEth
const gunEth = new GunEth(gun);
\`\`\`

## 📚 Documentazione

### 🔐 Integrazione Gun-Ethereum

#### Conversione ETH -> GUN
\`\`\`javascript
// Converti un account Ethereum in un account Gun
import { ethToGunAccount, createSignature, MESSAGE_TO_SIGN } from 'gun-eth';

// Crea una firma con il wallet Ethereum
const signature = await createSignature(MESSAGE_TO_SIGN);

// Converti in account Gun
const gunAccount = await ethToGunAccount(signature);
\`\`\`

#### Conversione GUN -> ETH
\`\`\`javascript
// Converti un account Gun in un account Ethereum
import { gunToEthAccount } from 'gun-eth';

const ethAccount = await gunToEthAccount(gunAccount);
\`\`\`

### 🔒 Stealth Chain

\`\`\`javascript
// Inizializza StealthChain
import { StealthChain } from 'gun-eth';

const stealthChain = new StealthChain(gun);

// Pubblica chiavi stealth
const signature = await createSignature(MESSAGE_TO_SIGN);
await stealthChain.publishStealthKeys(signature);

// Genera indirizzo stealth
const stealthInfo = await stealthChain.generateStealthAddress(
    recipientAddress,
    senderSignature
);
\`\`\`

### ⛓️ Proof Chain

\`\`\`javascript
// Inizializza ProofChain
import { ProofChain } from 'gun-eth';

const proofChain = new ProofChain(gun);

// Scrivi dati con prova
proofChain.proof(chain, null, data, (ack) => {
    if (ack.ok) {
        console.log("Node ID:", ack.nodeId);
        console.log("Transaction Hash:", ack.txHash);
    }
});

// Verifica integrità dati
gun.proof(chain, nodeId, null, (ack) => {
    if (ack.ok) {
        console.log("Verification passed");
    }
});
\`\`\`

### 🫧 Bolle Crittografate

\`\`\`javascript
// Inizializza provider
import { HybridBubbleProvider } from 'gun-eth';

const provider = new HybridBubbleProvider({
    rpcUrl: 'your-rpc-url',
    chain: 'your-network',
    gun: gunInstance,
    keypair: userKeypair
});

// Crea bolla crittografata
const bubble = await provider.handleCreateBubble({
    name: "Private Bubble",
    isPrivate: true,
    userAddress: userAddress
});

// Carica file nella bolla
await provider.handleFileUpload(
    bubble.id,
    fileName,
    content,
    userAddress
);

// Condividi bolla
await provider.handleGrantPermission(
    bubbleId,
    recipientAddress,
    ownerAddress,
    {
        granteeEpub: recipientPublicKey,
        metadata: {
            sharedAt: Date.now(),
            granterAddress: ownerAddress
        }
    }
);
\`\`\`

## 🏗️ Architettura Provider

Gun-ETH supporta diversi tipi di provider per la gestione dei dati:

### Base Provider
- Classe astratta per tutti i provider
- Definisce l'interfaccia base
- Implementazione personalizzabile

### GUN Provider
- Utilizza GUN per lo storage
- Storage diretto nel grafo GUN
- Ottimo per dati piccoli e frequenti

### Hybrid Provider
- Combina GUN con storage esterno
- Supporto per file di grandi dimensioni
- Flessibilità massima

## 📋 Templates

Il progetto include templates pronti all'uso per:

- Client implementation completa
- Provider implementation completa
- Gestione configurazioni
- Gestione errori
- Storage file decriptati

## 🤝 Contribuire

Le contribuzioni sono benvenute! Per favore leggi le linee guida per contribuire prima di iniziare.

## 📄 Licenza

MIT © 2024 Scobru
