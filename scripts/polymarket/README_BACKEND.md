# Polymarket Backend Server

Backend server that executes Hardhat commands to deploy contracts and interact with Flare FDC.

## Setup

1. Install dependencies:
```bash
cd scripts/polymarket
npm install
```

2. Start the server:
```bash
npm start
```

The server will run on `http://localhost:3001`

## How It Works

1. **Frontend** makes API calls to prepare FDC requests
2. **Frontend** calls `/api/run-hardhat` endpoint with user address
3. **Backend** spawns a Hardhat process to run `PolymarketUserData.ts`
4. **Backend** streams all output (stdout/stderr) back to frontend in real-time
5. **Frontend** displays all logs and results

## API Endpoints

### POST `/api/run-hardhat`
Runs the Hardhat script to deploy contract and submit FDC requests.

**Request Body:**
```json
{
  "userAddress": "0xb1d9476e5a5ba938b57cf0a5dc7a91a114605ee1",
  "network": "coston2"
}
```

**Response:**
Server-Sent Events (SSE) stream with real-time logs:
- `type: "stdout"` - Standard output from Hardhat
- `type: "stderr"` - Error output from Hardhat
- `type: "close"` - Process completed
- `type: "error"` - Backend error

### GET `/api/health`
Health check endpoint.

## Environment Variables

The backend uses the same `.env` file from the project root. Make sure it's configured with:
- `PRIVATE_KEY` - Your wallet private key
- `WEB2JSON_VERIFIER_URL_TESTNET` - Verifier URL
- `VERIFIER_API_KEY_TESTNET` - Verifier API key
- `COSTON2_DA_LAYER_URL` - DA Layer URL

## Notes

- The server runs Hardhat commands in the project root directory
- All Hardhat output is streamed to the frontend in real-time
- The user address is passed via `POLYMARKET_USER_ADDRESS` environment variable
- Make sure you have sufficient funds in your wallet for gas fees

