# Gun-ETH 🔫

<img src="landing/assets/hero-image.webp" alt="Gun-ETH Logo" width="300">

A powerful Gun.js plugin that extends its capabilities by adding advanced blockchain and cryptographic features to create more secure and private decentralized applications.

## ✨ Why Gun-ETH?

- 🎯 **Powerful Extension**: Adds advanced blockchain and cryptographic features to Gun.js
- 🌐 **Seamless Integration**: Perfectly integrates with Gun.js while maintaining simplicity
- 🔒 **Advanced Privacy**: Implements stealth transactions, encrypted bubbles, and secure key management
- 🚀 **Modern Architecture**: Intuitive APIs for easy Web3 functionality implementation
- ⛓️ **Smart Contracts**: Built-in contracts for stealth transactions and bubble management

## 🚀 Quick Start

### Installation

```bash
npm install gun-eth
# or
yarn add gun-eth
```

### Basic Configuration

```javascript
import Gun from "gun";
import { initializeGun, extendGun, setSigner } from "gun-eth";
import { ethers } from "ethers";

// Option 1: Initialize a new Gun instance with extensions
const gun = initializeGun({
  peers: ["http://localhost:8765/gun"],
});

// Option 2: Extend an existing Gun instance
const existingGun = Gun({
  peers: ["http://localhost:8765/gun"],
});
extendGun(existingGun);

// Configure signer with provider
const provider = new ethers.JsonRpcProvider("RPC_URL");
await setSigner("RPC_URL", "PRIVATE_KEY");

// Now you can use all Gun-ETH features
const signature = await createSignature(MESSAGE_TO_SIGN);
const account = await ethToGunAccount();
```

### Signer Configuration

Gun-ETH provides two ways to configure the signer:

1. **Manual Configuration (Recommended for Production)**

```javascript
import { setSigner, getSigner } from "gun-eth";

// Configure with explicit RPC URL and private key
await setSigner("https://your-rpc-url", "your-private-key");

// Get the configured signer
const signer = await getSigner();
```

2. **MetaMask Integration (Development-Friendly)**

```javascript
import { getSigner } from "gun-eth";

// Will automatically use MetaMask if available
try {
  const signer = await getSigner();
  console.log("Connected with address:", await signer.getAddress());
} catch (error) {
  console.error("No valid provider found");
}
```

## 📚 Documentation

### 🔐 Gun-Ethereum Integration

#### ETH -> GUN Conversion

```javascript
// Create signature with Ethereum wallet
const signature = await createSignature(MESSAGE_TO_SIGN);

// Convert to Gun account (isSecondary = false for primary account)
const gunAccount = await ethToGunAccount();

// The account contains:
{
  pub: string,                    // Gun public key
  internalWalletAddress: string,  // Internal wallet address
  internalWalletPk: string,      // Internal wallet private key
  pair: Object,                  // Original Gun keypair
  v_pair: Object,                // Viewing keypair
  s_pair: Object,                // Spending keypair
  viewingPublicKey: string,      // Viewing public key
  spendingPublicKey: string,     // Spending public key
  env_pair: string,              // Encrypted original pair
  env_v_pair: string,            // Encrypted viewing pair
  env_s_pair: string             // Encrypted spending pair
}
```

#### GUN -> ETH Conversion

```javascript
// Convert Gun keypair to Ethereum account
const gunKeyPair = await SEA.pair();
const signature = await createSignature(MESSAGE_TO_SIGN);
const password = await generatePassword(signature);

const account = await gunToEthAccount(gunKeyPair, password);

// The account contains:
{
  pub: string,                    // Gun public key
  internalWalletAddress: string,  // Internal wallet address
  internalWalletPk: string,      // Internal wallet private key
  pair: Object,                  // Original Gun keypair
  v_pair: Object,                // Viewing keypair
  s_pair: Object,                // Spending keypair
  viewingPublicKey: string,      // Viewing public key
  spendingPublicKey: string,     // Spending public key
  env_pair: string,              // Encrypted original pair
  env_v_pair: string,            // Encrypted viewing pair
  env_s_pair: string             // Encrypted spending pair
}
```

### 🔒 StealthChain

```javascript
import { StealthChain } from "gun-eth";

// Option 1: Off-chain only (no provider needed)
const stealthChain = new StealthChain();

// Option 2: Full on-chain functionality
const provider = new ethers.JsonRpcProvider("RPC_URL");
const stealthChain = new StealthChain(provider, "polygon");

// Basic stealth operations (work in both modes)
const stealthInfo = await stealthChain.generateStealthAddress(
  receiverViewingKey,
  receiverSpendingKey
);

const announcement = stealthChain.createStealthAnnouncement(
  stealthInfo.stealthAddress,
  stealthInfo.senderEphemeralPublicKey,
  receiverViewingKey,
  receiverSpendingKey
);

// On-chain operations (require provider and chainId)
if (stealthChain.isOnChainEnabled()) {
  // Announce payment on-chain
  await stealthChain.announcePaymentOnChain(
    stealthInfo.stealthAddress,
    stealthInfo.senderEphemeralKey,
    receiverViewingKey,
    receiverSpendingKey
  );

  // Get current fee
  const fee = await stealthChain.getCurrentFee();

  // Monitor announcements
  stealthChain.listenToNewAnnouncements((announcement) => {
    console.log("New announcement:", announcement);
  });
}
```

### ⛓️ Smart Contracts

Currently deployed on Polygon Mainnet:

```javascript
{
  StealthAnnouncer: "0xD0CDbD17E4f2DDCE27B51721095048302768434f",
  BubbleRegistry: "0xc70DC231B9690D9dA988f6D4E518356eE9e45cd9"
}
```

### 🫧 Encrypted Bubbles

```javascript
// Initialize Bubble Client
const bubbleClient = new BubbleClient({
  providerUrl: "http://localhost:3000/api",
  signer: signer,
  keypair: {
    epub: "your-encryption-public-key",
    epriv: "your-encryption-private-key",
  },
});

// Create and manage bubbles
const bubble = await bubbleClient.createBubble("My Bubble", {
  isPrivate: true,
});

// Write encrypted content
await bubbleClient.writeBubble(bubble.id, "secret.txt", "My secret content");

// Read and decrypt content
const result = await bubbleClient.readBubble(bubble.id, "secret.txt");
```

## 🏗️ Project Structure

```
src/
├── index.js          # Main entry point
├── gun-eth.js        # Core Gun-ETH functionality
├── browser.js        # Browser-specific code
├── features/         # Main features
│   ├── StealthChain/ # Stealth transaction implementation
│   └── BubbleClient/ # Encrypted bubble functionality
├── contracts/        # Smart contracts
│   ├── stealthChain/ # StealthAnnouncer contract
│   └── bubbleChain/  # BubbleRegistry contract
├── templates/        # Ready-to-use templates
├── utils/           # Utility functions
└── types/           # TypeScript definitions
```

## 🤝 Contributing

Contributions are welcome! Please:

1. 🍴 Fork the repository
2. 🌿 Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. 💾 Commit your changes (`git commit -m 'Add: amazing feature'`)
4. 📤 Push to the branch (`git push origin feature/AmazingFeature`)
5. 🔄 Open a Pull Request

## 📄 Support

If you find this project useful, consider supporting its development:

```
ETH: 0xb542E27732a390f509fD1FF6844a8386fe320f7f
```

## 👤 Author

Created by [scobru](https://github.com/scobru)

Released by **Plancia Foundation**

## 📄 License

MIT © 2024 Plancia Foundation
