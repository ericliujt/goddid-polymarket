# Privy Integration Setup

This project includes Privy integration for browser wallet connections and session signer management.

## Features

- **Browser-only wallets**: Only supports wallets available in the browser (MetaMask, WalletConnect, Coinbase Wallet, etc.)
- **No email login**: Email authentication is disabled
- **No embedded wallets**: Embedded wallets are disabled
- **Session signers**: Add and manage session signers for user wallets
- **Local storage**: Session IDs are stored in browser local storage

## Setup

1. **Get your Privy App ID**
   - Go to [Privy Dashboard](https://dashboard.privy.io)
   - Create a new app or use an existing one
   - Copy your App ID

2. **Configure environment variables**
   - Create a `.env.local` file in the `frontend` directory
   - Add the following environment variables:
     ```
     # Required for frontend
     NEXT_PUBLIC_PRIVY_APP_ID=your-privy-app-id-here
     
     # Optional: Default signer ID (pre-populates the signer ID field)
     NEXT_PUBLIC_PRIVY_SIGNER_ID=your-signer-id-here
     
     # Optional: For server-side operations (if needed)
     PRIVY_APP_SECRET=your-app-secret-here
     PRIVY_WALLET_AUTH_PRIVATE_KEY=wallet-auth:your-private-key-here
     ```

3. **Configure Session Signers in Privy Dashboard**
   - Follow the [Privy Session Signers guide](https://docs.privy.io/wallets/using-wallets/session-signers/configure-session-signers)
   - Generate an authorization key (key quorum ID)
   - This will be the `signerId` you use when adding session signers

## Components

### `PrivyProvider`
Wraps the application and provides Privy context. Configured to:
- Only allow browser wallets
- Disable embedded wallets
- Disable email login

### `WalletConnection`
Component for connecting/disconnecting browser wallets. Shows:
- Connect button when not authenticated
- List of connected wallets when authenticated
- Disconnect button

### `SessionSigners`
Component for managing session signers:
- Add session signers to connected wallets
- View stored session IDs from local storage
- Remove session IDs from local storage

### `session-storage.ts`
Utility functions for managing session IDs in local storage:
- `getStoredSessionIds()`: Get all stored session IDs
- `storeSessionId(address, signerId)`: Store a session ID
- `removeSessionId(address)`: Remove a session ID
- `getSessionIdsForAddress(address)`: Get session IDs for a specific address
- `clearAllSessionIds()`: Clear all session IDs

## Usage

1. **Connect a wallet**: Use the `WalletConnection` component to connect a browser wallet
2. **Add session signer**: 
   - Select a connected wallet address
   - Enter the signer ID (key quorum ID from Privy Dashboard)
   - Optionally add policy IDs (comma-separated)
   - Click "Add Session Signer"
3. **View stored sessions**: All session IDs are automatically stored in local storage and displayed in the component
4. **Remove sessions**: Click the "Remove" button next to any stored session

## Local Storage

Session IDs are stored in local storage under the key `privy_session_ids`. The data structure is:

```typescript
interface SessionIdData {
  address: string;
  signerId: string;
  timestamp: number;
}
```

## API Reference

### `useSessionSigners` Hook

The `SessionSigners` component uses the `useSessionSigners` hook from `@privy-io/react-auth`:

```typescript
const { addSessionSigners } = useSessionSigners();

await addSessionSigners({
  address: string,
  signers: {
    signerId: string,
    policyIds?: string[]
  }[]
});
```

## Notes

- Only browser wallets are supported (no embedded wallets)
- Email login is disabled
- Session IDs are stored locally in the browser
- The signer ID must match the key quorum ID configured in the Privy Dashboard

