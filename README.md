# goddid.money – Polymarket Credit Protocol

## 🚀 Overview
**goddid.money** converts a Polymarket trader’s verified trading history into an on chain credit profile and enables borrowing FXRP against their performance. The protocol integrates **Flare Data Connector (FDC)** for trust minimized Polymarket ingestion, **FAssets synthetic XRP** for lending liquidity, **Pyth Entropy** for anti gaming loan variability, and **Privy’s embedded wallet with session signer** for deterministic enforcement. Users receive a real credit rating based on their Polymarket history and borrow directly into a Privy controlled wallet.

---

## ⚙️ Core Features

### 🔗 Trust Minimized Polymarket Ingestion
- Uses **Flare’s Data Connector** to fetch verifiable Web2 data from Polymarket.
- Backend constructs a Web2Json request with a jq post processor.
- Returns ABI encoded payload and Merkle proof verified on chain.
- On chain oracle contracts store validated positions and trades.

### 📊 Quantitative On Chain Credit Scoring
- Computes ROI, volatility normalized return, win rate, profit factor, drawdown, HHI concentration, and dead share.
- Produces performance and risk subscores.
- Transforms them via logistic PD model into a **300 to 850** credit score.
- Score determines LTV and borrowing power.

### 🎲 Pyth Entropy Loan Randomization
- Each loan quote consumes verifiable randomness.
- Randomness introduces controlled LTV and max borrow variation.
- Prevents deterministic loan farming.
- Removes backend and miner influence from credit pricing.

### 💸 Synthetic XRP Lending via FAssets (FXRP)
- Borrowing occurs in **FXRP**, synthetic XRP minted through Flare’s FAssets system.
- Liquidity comes from an external XRP provider who deposits native XRP, converts it into FXRP, and seeds the lending pool.
- Pool is modular and can later be swapped for LP vaults, AMMs, or external yield strategies.

### 🛡 Privy Embedded Wallet + Delegated Execution
- Every user receives a **Privy embedded wallet** and a **session signer**.
- Session signer handles amortization pulls, collateral checks, liquidation, default writeoffs, and blacklist updates.
- Enables offline enforcement and removes the need for custom escrow logic.
- Saved the project from writing an entire custody and enforcement subsystem in hackathon constraints.

### 🌐 Clean Next.js Frontend
- Real time credit display
- Borrow, withdraw, and wallet connection modules
- Privy provider integrated with session signer initialization
- TSX component architecture

---

## 🛠 Tech Stack

### Blockchain
- Flare FDC, Web2Json, Merkle verified ingestion  
- FAssets + FXRP synthetic XRP  
- Pyth Entropy randomness  
- XRPL address binding and flows  
- Hardhat (TypeScript)  
- Solidity contracts for:
  - Credit scoring engine  
  - Polymarket oracle  
  - FXRP pool  
  - FAssets interactions  

### Backend + Scripts
- TypeScript + ethers v6  
- Flare Periphery Contracts  
- Polymarket ingestion scripts  
- FXRP minting, swapping, redeeming  
- Credit engine runners  

### Frontend
- Next.js  
- React + TSX  
- Privy embedded wallet  
- Client side lending UI  

---

## 🏎 Running the Project

### 1. Install Dependencies
```bash
yarn
# or
npm install --force
# Project Runbook & Architecture Notes
```
## 2. Configure Environment
cp .env.example .env  
Add PRIVATE_KEY, XRPL details, Privy keys

## 3. Start Frontend
yarn dev  
open http://localhost:3000

Start using our lending protocol!

## Optional
### Compile Contracts
npx hardhat compile

### Run Polymarket Ingestion
npx hardhat run scripts/polymarket/PolymarketUserData.ts --network coston2  
npx hardhat run scripts/polymarket/PolymarketPosition.ts --network coston2

### Compute Credit Score
npx hardhat run scripts/creditEngine/submitPolymarketData.ts --network coston2  
npx hardhat run scripts/creditEngine/runCreditScore.ts --network coston2

## 🤝 Why Flare
Flare provided verifiable Web2 ingestion through FDC and the synthetic XRP system through FAssets and FXRP, letting the protocol operate entirely on chain with real Polymarket data.

## 🧩 Why Privy
Privy replaced an entire escrow and enforcement subsystem by giving us embedded wallets and session signer delegated execution, letting the protocol handle repayments, liquidation, and debt recovery without user approvals.

## 👥 Team
**Team: goddid.money**  
Zayaan, Pravesh, Konrad, Eric
