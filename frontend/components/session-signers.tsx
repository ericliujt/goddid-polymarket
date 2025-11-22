'use client';

import { usePrivy, useWallets, useCreateWallet } from '@privy-io/react-auth';
import { useSessionSigners } from '@privy-io/react-auth';
import { useState, useEffect } from 'react';
import {
  getStoredSessionIds,
  storeSessionId,
  removeSessionId,
  getSessionIdsForAddress,
  SessionIdData,
} from '@/lib/session-storage';

export function SessionSigners() {
  const { ready, authenticated, user } = usePrivy();
  const { wallets } = useWallets();
  const { createWallet } = useCreateWallet();
  const { addSessionSigners } = useSessionSigners();
  
  // Get default signer ID from environment variable
  const defaultSignerId = process.env.NEXT_PUBLIC_PRIVY_SIGNER_ID || '';
  
  const [signerId, setSignerId] = useState(defaultSignerId);
  const [selectedAddress, setSelectedAddress] = useState('');
  const [policyIds, setPolicyIds] = useState('');
  const [loading, setLoading] = useState(false);
  const [creatingWallet, setCreatingWallet] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [storedSessions, setStoredSessions] = useState<SessionIdData[]>([]);

  // Load stored session IDs on mount
  useEffect(() => {
    if (ready && authenticated) {
      const sessions = getStoredSessionIds();
      setStoredSessions(sessions);
    }
  }, [ready, authenticated]);

  // Get all wallets (both embedded and browser wallets)
  const allWallets = wallets;
  
  // Get embedded wallets (these are the only ones that support session signers)
  const embeddedWallets = wallets.filter(
    (wallet) => wallet.walletClientType === 'privy'
  );

  // Get browser wallets (exclude embedded wallets)
  const browserWallets = wallets.filter(
    (wallet) => wallet.walletClientType !== 'privy'
  );

  // Auto-select first embedded wallet if available (session signers only work with embedded wallets)
  useEffect(() => {
    if (embeddedWallets.length > 0 && !selectedAddress) {
      setSelectedAddress(embeddedWallets[0].address);
    } else if (browserWallets.length > 0 && !selectedAddress) {
      // Fallback to browser wallet, but show warning
      setSelectedAddress(browserWallets[0].address);
    }
  }, [embeddedWallets, browserWallets, selectedAddress]);

  const handleAddSessionSigner = async () => {
    if (!signerId.trim()) {
      setError('Please enter a signer ID');
      return;
    }

    if (!selectedAddress) {
      setError('Please select a wallet address');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const signers = [
        {
          signerId: signerId.trim(),
          policyIds: policyIds.trim() ? policyIds.split(',').map((id) => id.trim()) : [],
        },
      ];

      const result = await addSessionSigners({
        address: selectedAddress,
        signers,
      });

      // Store the session ID in local storage
      storeSessionId(selectedAddress, signerId.trim());

      // Update stored sessions
      const updatedSessions = getStoredSessionIds();
      setStoredSessions(updatedSessions);

      setSuccess(`Session signer added successfully for ${selectedAddress}`);
      setSignerId('');
      setPolicyIds('');
    } catch (err) {
      console.error('Error adding session signer:', err);
      setError(err instanceof Error ? err.message : 'Failed to add session signer');
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveSession = (address: string) => {
    removeSessionId(address);
    const updatedSessions = getStoredSessionIds();
    setStoredSessions(updatedSessions);
    setSuccess(`Session removed for ${address}`);
  };

  const handleCreateEmbeddedWallet = async () => {
    setCreatingWallet(true);
    setError(null);
    setSuccess(null);

    try {
      // Create an embedded wallet
      const wallet = await createWallet();
      setSuccess(`Embedded wallet created successfully: ${wallet.address}`);
      
      // Auto-select the newly created wallet
      if (wallet.address) {
        setSelectedAddress(wallet.address);
      }
      
      // The wallets list will automatically update via the useWallets hook
      // Give it a moment to refresh
      setTimeout(() => {
        // Force a re-render by checking wallets again
      }, 500);
    } catch (err) {
      console.error('Error creating embedded wallet:', err);
      setError(err instanceof Error ? err.message : 'Failed to create embedded wallet. Make sure embedded wallets are enabled in your Privy configuration.');
    } finally {
      setCreatingWallet(false);
    }
  };

  if (!ready) {
    return (
      <div className="p-4 border rounded-lg">
        <p>Loading Privy...</p>
      </div>
    );
  }

  if (!authenticated) {
    return (
      <div className="p-4 border rounded-lg bg-yellow-50 dark:bg-yellow-900/20">
        <p className="text-yellow-800 dark:text-yellow-200">
          Please connect your wallet to manage session signers.
        </p>
      </div>
    );
  }

  if (allWallets.length === 0) {
    return (
      <div className="p-4 border rounded-lg bg-yellow-50 dark:bg-yellow-900/20">
        <p className="text-yellow-800 dark:text-yellow-200">
          No wallets found. Please connect a wallet first.
        </p>
      </div>
    );
  }

  // Show warning if only browser wallets are available
  const hasOnlyBrowserWallets = embeddedWallets.length === 0 && browserWallets.length > 0;

  return (
    <div className="space-y-6 p-6 border rounded-lg bg-white dark:bg-zinc-900">
      <h2 className="text-2xl font-semibold text-black dark:text-zinc-50">
        Session Signers
      </h2>

      {/* Warning about browser wallets and create embedded wallet option */}
      {hasOnlyBrowserWallets && (
        <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
          <p className="text-blue-800 dark:text-blue-200 font-semibold mb-2">
            💡 Create an Embedded Wallet for Session Signers
          </p>
          <p className="text-blue-700 dark:text-blue-300 text-sm mb-3">
            Session signers can only be added to Privy embedded wallets, not external browser wallets like MetaMask.
            Create an embedded wallet below to use session signers.
          </p>
          <button
            onClick={handleCreateEmbeddedWallet}
            disabled={creatingWallet}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
          >
            {creatingWallet ? 'Creating Wallet...' : 'Create Embedded Wallet'}
          </button>
        </div>
      )}

      {/* Show available wallets info */}
      <div className="p-3 bg-zinc-50 dark:bg-zinc-800 rounded-lg mb-4">
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          <strong>Embedded Wallets:</strong> {embeddedWallets.length} (supports session signers)
        </p>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          <strong>Browser Wallets:</strong> {browserWallets.length} (does not support session signers)
        </p>
      </div>

      {/* Add Session Signer Form */}
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-black dark:text-zinc-50 mb-2">
            Select Wallet Address {embeddedWallets.length > 0 && <span className="text-green-600">(Embedded wallets only)</span>}
          </label>
          <select
            value={selectedAddress}
            onChange={(e) => setSelectedAddress(e.target.value)}
            className="w-full p-2 border rounded-lg bg-white dark:bg-zinc-800 text-black dark:text-zinc-50"
          >
            {embeddedWallets.length > 0 ? (
              embeddedWallets.map((wallet) => (
                <option key={wallet.address} value={wallet.address}>
                  {wallet.address} (Embedded - {wallet.walletClientType})
                </option>
              ))
            ) : (
              browserWallets.map((wallet) => (
                <option key={wallet.address} value={wallet.address} disabled>
                  {wallet.address} ({wallet.walletClientType}) - Not supported
                </option>
              ))
            )}
          </select>
          {embeddedWallets.length === 0 && (
            <div className="mt-2">
              <p className="text-xs text-red-600 dark:text-red-400 mb-2">
              No embedded wallets available. Session signers require embedded wallets.
              </p>
              <button
                onClick={handleCreateEmbeddedWallet}
                disabled={creatingWallet}
                className="px-3 py-1.5 bg-green-600 text-white rounded text-xs hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {creatingWallet ? 'Creating...' : 'Create Embedded Wallet'}
              </button>
            </div>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-black dark:text-zinc-50 mb-2">
            Signer ID (Key Quorum ID) *
          </label>
          <input
            type="text"
            value={signerId}
            onChange={(e) => setSignerId(e.target.value)}
            placeholder={defaultSignerId || "Enter signer ID"}
            className="w-full p-2 border rounded-lg bg-white dark:bg-zinc-800 text-black dark:text-zinc-50"
          />
          {defaultSignerId && (
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
              Using default signer ID from environment variable
            </p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-black dark:text-zinc-50 mb-2">
            Policy IDs (comma-separated, optional)
          </label>
          <input
            type="text"
            value={policyIds}
            onChange={(e) => setPolicyIds(e.target.value)}
            placeholder="policy-id-1, policy-id-2"
            className="w-full p-2 border rounded-lg bg-white dark:bg-zinc-800 text-black dark:text-zinc-50"
          />
        </div>

        <button
          onClick={handleAddSessionSigner}
          disabled={loading || !signerId.trim() || !selectedAddress || embeddedWallets.length === 0}
          className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Adding...' : embeddedWallets.length === 0 ? 'No Embedded Wallets Available' : 'Add Session Signer'}
        </button>
      </div>

      {/* Error and Success Messages */}
      {error && (
        <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <p className="text-red-800 dark:text-red-200 text-sm">{error}</p>
        </div>
      )}

      {success && (
        <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
          <p className="text-green-800 dark:text-green-200 text-sm">{success}</p>
        </div>
      )}

      {/* Stored Session IDs */}
      {storedSessions.length > 0 && (
        <div className="mt-6">
          <h3 className="text-lg font-semibold text-black dark:text-zinc-50 mb-3">
            Stored Session IDs
          </h3>
          <div className="space-y-2">
            {storedSessions.map((session, index) => (
              <div
                key={index}
                className="p-3 bg-zinc-50 dark:bg-zinc-800 rounded-lg flex justify-between items-start"
              >
                <div className="flex-1">
                  <p className="text-sm font-medium text-black dark:text-zinc-50">
                    Address: {session.address}
                  </p>
                  <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-1">
                    Signer ID: {session.signerId}
                  </p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-500 mt-1">
                    Added: {new Date(session.timestamp).toLocaleString()}
                  </p>
                </div>
                <button
                  onClick={() => handleRemoveSession(session.address)}
                  className="ml-4 px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

