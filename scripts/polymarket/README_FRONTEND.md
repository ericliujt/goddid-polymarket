# Polymarket User Data - Frontend

A simple web frontend for verifying Polymarket user data using Flare's FDC (Flare Data Connector).

## Features

- ✅ Input user Ethereum address
- ✅ Fetches data from three Polymarket APIs:
  - Closed Positions (limit 10) → extracts `realizedPnl`
  - Value → extracts `value`
  - Activity (limit 1) → extracts `name`
- ✅ Prepares FDC attestation requests
- ✅ Real-time logging of all operations
- ✅ Displays extracted data and verification results

## Usage

### Step 1: Start the Backend Server

The backend server is required to deploy contracts and submit to blockchain:

```bash
cd scripts/polymarket
npm install
npm start
```

The server will run on `http://localhost:3001`

### Step 2: Open the Frontend

#### Option 1: Use the backend server (recommended)

The backend server also serves the frontend files. Just open:
```
http://localhost:3001
```

#### Option 2: Use a separate local server

```bash
# Using Python 3
cd scripts/polymarket
python3 -m http.server 8000

# Then open in browser:
# http://localhost:8000
```

**Note:** If using a separate server, make sure to update `BACKEND_URL` in `app.js` to point to `http://localhost:3001`

### Step 3: Use the Frontend

1. Enter a user address (default: `0xb1d9476e5a5ba938b57cf0a5dc7a91a114605ee1`)
2. Configure verifier URL and API key if needed
3. Click "Start FDC Verification"
4. Watch the logs and results appear in real-time
5. The frontend will automatically trigger Hardhat deployment after API verification

## What the Frontend Does

1. **Fetches Raw API Data**: Makes direct calls to Polymarket APIs to show the raw data
2. **Prepares FDC Requests**: Creates attestation requests for Flare's FDC verifier
3. **Shows Verification Status**: Displays whether each request is VALID or has errors
4. **Extracts Data**: Shows the extracted values (realizedPnl, value, name)
5. **Deploys Contract**: Automatically triggers Hardhat to deploy the contract via backend
6. **Submits to Blockchain**: Submits FDC requests to Flare network
7. **Retrieves Proofs**: Waits for voting rounds to finalize and retrieves proofs
8. **Stores Data On-Chain**: Calls the contract to store verified data

## Architecture

- **Frontend** (`index.html`, `app.js`): User interface and API calls
- **Backend** (`server.js`): Executes Hardhat commands and streams output
- **Hardhat Script** (`PolymarketUserData.ts`): Deploys contract and handles blockchain interactions

## Configuration

- **Verifier URL**: Default is `https://web2json-verifier-test.flare.rocks/`
- **API Key**: Default is `00000000-0000-0000-0000-000000000000` (test key)

## Troubleshooting

### CORS Errors
If you see CORS errors, make sure you're running the frontend from a local server (not file://)

### "INVALID: FETCH ERROR"
This means the Flare verifier cannot access the Polymarket API. This is a known issue - see `DEBUG_FETCH_ERROR.md` for details.

### "INVALID: ABI ENCODING ERROR"
This means the data format doesn't match the expected ABI. The frontend handles float-to-integer conversion automatically.

## Files

- `index.html` - Main HTML file with UI
- `app.js` - JavaScript logic for API calls and FDC verification
- `README_FRONTEND.md` - This file

