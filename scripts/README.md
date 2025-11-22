# Scripts

This folder contains scripts for polymarket integration and fassets functionality.

# Directory structure

```
scripts
├── polymarket: scripts for Polymarket integration using FDC (Flare Data Connector)
├── fassets: scripts for interacting with Flare fassets (FXRP)
├── utils: core utility functions used by polymarket and fassets scripts
└── README.md
```

# Startup Guide

## Prerequisites

1. **Install Dependencies**

   ```bash
   npm install
   # or
   yarn install
   ```

2. **Set Up Environment Variables**

   Create a `.env` file in the project root with the following variables:

   ```env
   # Required: Wallet private key for signing transactions
   PRIVATE_KEY=your_private_key_here

   # Required for Polymarket scripts: FDC Verifier configuration
   WEB2JSON_VERIFIER_URL_TESTNET=https://verifier-url-here
   VERIFIER_API_KEY_TESTNET=your_api_key_here
   COSTON2_DA_LAYER_URL=https://da-layer-url-here

   # Optional: Polymarket user address (defaults to example address if not set)
   POLYMARKET_USER_ADDRESS=0xYourAddressHere

   # Optional: Flare RPC API key for better rate limits
   FLARE_RPC_API_KEY=your_rpc_api_key_here
   FLARESCAN_API_KEY=your_flarescan_api_key_here
   FLARE_EXPLORER_API_KEY=your_explorer_api_key_here
   ```

## Compilation

Before running any scripts, compile the Solidity contracts:

```bash
# Using npm
npx hardhat compile

# Using yarn
yarn hardhat compile
```

This will:
- Compile all `.sol` files in the `/contracts` folder
- Generate artifacts needed for script execution
- Generate TypeScript type definitions in `/typechain-types`

## Running Scripts

### Polymarket Scripts

#### 1. PolymarketUserData.ts

Fetches and stores Polymarket user data (closed positions, value, activity) using FDC:

```bash
# Using npm
npx hardhat run scripts/polymarket/PolymarketUserData.ts --network coston2

# Using yarn
yarn hardhat run scripts/polymarket/PolymarketUserData.ts --network coston2

# With custom user address
POLYMARKET_USER_ADDRESS=0xYourAddress npx hardhat run scripts/polymarket/PolymarketUserData.ts --network coston2
```

**What it does:**
- Prepares FDC attestation requests for closed positions, value, and activity
- Submits requests to the Flare network
- Waits for voting rounds to finalize
- Retrieves proofs from the DA Layer
- Deploys `PolymarketUserDataStore` contract
- Stores verified user data on-chain

#### 2. PolymarketPosition.ts

Fetches and stores Polymarket position data:

```bash
# Using npm
npx hardhat run scripts/polymarket/PolymarketPosition.ts --network coston2

# Using yarn
yarn hardhat run scripts/polymarket/PolymarketPosition.ts --network coston2
```

**What it does:**
- Prepares FDC attestation request for position data
- Submits request and retrieves proof
- Deploys `PolymarketPositionList` contract
- Stores verified position data on-chain

**Available Networks:**
- `coston2` (testnet) - Recommended for testing
- `coston` (testnet)
- `songbird` (canary network)
- `flare` (mainnet)

### FAssets Scripts

For detailed information about FAssets scripts, see [scripts/fassets/README.md](./fassets/README.md).

**Example: Get FXRP contract address**

```bash
npx hardhat run scripts/fassets/getFXRP.ts --network coston2
```

**Example: Execute minting**

```bash
npx hardhat run scripts/fassets/executeMinting.ts --network coston2
```

**Example: Get settings**

```bash
npx hardhat run scripts/fassets/settings.ts --network coston2
```

## Troubleshooting

### Compilation Errors

If you encounter compilation errors:

1. **Clean and recompile:**
   ```bash
   npx hardhat clean
   npx hardhat compile
   ```

2. **Check Solidity version:** Ensure contracts use compatible Solidity versions (0.8.25)

### Runtime Errors

1. **Insufficient funds:** Make sure your wallet has enough native tokens for gas fees
2. **Network connection:** Verify your RPC endpoint is accessible
3. **Environment variables:** Double-check all required `.env` variables are set
4. **API access:** For Polymarket scripts, ensure the verifier can access the Polymarket API

### Common Issues

- **"INVALID: FETCH ERROR"** in Polymarket scripts: The Flare verifier may not be able to access the Polymarket API. This might require whitelisting the verifier's IP address.
- **Type errors:** Run `npx hardhat compile` to regenerate TypeScript types
- **Network not found:** Check `hardhat.config.ts` for available networks

## Additional Resources

- [Flare Developer Hub](https://dev.flare.network/)
- [Hardhat Documentation](https://hardhat.org/docs)
- [FDC Guides](https://dev.flare.network/fdc/guides/hardhat)
- [FAssets Overview](https://dev.flare.network/fassets/overview)
