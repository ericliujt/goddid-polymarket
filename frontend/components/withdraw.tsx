'use client';

import { usePrivy, useWallets } from '@privy-io/react-auth';
import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { getSessionIdsForAddress } from '@/lib/session-storage';

// Coston2 testnet configuration
const COSTON2_CHAIN_ID = 114;

export function Withdraw() {
  const { ready, authenticated, user } = usePrivy();
  const { wallets } = useWallets();
  
  const [recipientAddress, setRecipientAddress] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [selectedWalletAddress, setSelectedWalletAddress] = useState('');
  const [signerId, setSignerId] = useState('');

  // Get embedded wallets (these are the ones we can withdraw from)
  const embeddedWallets = wallets.filter(
    (wallet) => wallet.walletClientType === 'privy'
  );

  // Load session signer ID for the selected wallet
  useEffect(() => {
    if (selectedWalletAddress && embeddedWallets.length > 0) {
      const sessions = getSessionIdsForAddress(selectedWalletAddress);
      if (sessions.length > 0) {
        setSignerId(sessions[0].signerId);
      } else {
        setSignerId('');
      }
    }
  }, [selectedWalletAddress, embeddedWallets]);

  // Auto-select first embedded wallet
  useEffect(() => {
    if (embeddedWallets.length > 0 && !selectedWalletAddress) {
      setSelectedWalletAddress(embeddedWallets[0].address);
    }
  }, [embeddedWallets, selectedWalletAddress]);

  const handleWithdraw = async () => {
    if (!recipientAddress.trim()) {
      setError('Please enter a recipient address');
      return;
    }

    if (!ethers.isAddress(recipientAddress.trim())) {
      setError('Invalid Ethereum address');
      return;
    }

    if (!selectedWalletAddress) {
      setError('No embedded wallet selected');
      return;
    }

    if (!signerId) {
      setError('No session signer found for this wallet. Please add a session signer first.');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);
    setTxHash(null);

    try {
      // Call the backend API to sign and send the transaction using the session signer
      const response = await fetch('/api/withdraw', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: user?.id, // Send user ID (DID) to find the user's wallets
          walletAddress: selectedWalletAddress,
          recipientAddress: recipientAddress.trim(),
          signerId: signerId,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to process withdrawal');
      }

      setTxHash(data.txHash);
      setSuccess(`Transaction confirmed! Block: ${data.blockNumber}`);
      
    } catch (err) {
      console.error('Error withdrawing:', err);
      setError(err instanceof Error ? err.message : 'Failed to withdraw. Please check your wallet and try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!ready) {
    return (
      <div className="p-4 border rounded-lg">
        <p className="text-zinc-600 dark:text-zinc-400">Loading...</p>
      </div>
    );
  }

  if (!authenticated) {
    return (
      <div className="p-4 border rounded-lg bg-yellow-50 dark:bg-yellow-900/20">
        <p className="text-yellow-800 dark:text-yellow-200">
          Please connect your wallet to withdraw tokens.
        </p>
      </div>
    );
  }

  if (embeddedWallets.length === 0) {
    return (
      <div className="p-4 border rounded-lg bg-yellow-50 dark:bg-yellow-900/20">
        <p className="text-yellow-800 dark:text-yellow-200">
          No embedded wallet found. Please create an embedded wallet first to withdraw tokens.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6 border rounded-lg bg-white dark:bg-zinc-900">
      <h2 className="text-2xl font-semibold text-black dark:text-zinc-50">
        Withdraw FLR (Coston2)
      </h2>

      <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
        <p className="text-sm text-blue-800 dark:text-blue-200">
          <strong>Network:</strong> Coston2 Testnet (Chain ID: {COSTON2_CHAIN_ID})
        </p>
        <p className="text-sm text-blue-800 dark:text-blue-200 mt-1">
          <strong>Amount:</strong> 1 FLR
        </p>
        <p className="text-sm text-blue-800 dark:text-blue-200 mt-1">
          <strong>From:</strong> {selectedWalletAddress || 'No wallet selected'}
        </p>
        {signerId && (
          <p className="text-sm text-blue-800 dark:text-blue-200 mt-1">
            <strong>Using Session Signer:</strong> {signerId}
          </p>
        )}
        {!signerId && selectedWalletAddress && (
          <p className="text-sm text-yellow-800 dark:text-yellow-200 mt-1">
            ⚠️ No session signer found. Please add a session signer first.
          </p>
        )}
      </div>

      {embeddedWallets.length > 1 && (
        <div>
          <label className="block text-sm font-medium text-black dark:text-zinc-50 mb-2">
            Select Wallet
          </label>
          <select
            value={selectedWalletAddress}
            onChange={(e) => setSelectedWalletAddress(e.target.value)}
            className="w-full p-2 border rounded-lg bg-white dark:bg-zinc-800 text-black dark:text-zinc-50"
          >
            {embeddedWallets.map((wallet) => (
              <option key={wallet.address} value={wallet.address}>
                {wallet.address}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-black dark:text-zinc-50 mb-2">
            Recipient Address *
          </label>
          <input
            type="text"
            value={recipientAddress}
            onChange={(e) => setRecipientAddress(e.target.value)}
            placeholder="0x..."
            className="w-full p-2 border rounded-lg bg-white dark:bg-zinc-800 text-black dark:text-zinc-50 font-mono"
          />
        </div>

        <button
          onClick={handleWithdraw}
          disabled={loading || !recipientAddress.trim()}
          className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
        >
          {loading ? 'Processing...' : 'Withdraw 1 FLR'}
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
          {txHash && (
            <p className="text-green-700 dark:text-green-300 text-xs mt-2">
              <a
                href={`https://coston2-explorer.flare.network/tx/${txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:no-underline"
              >
                View on Explorer: {txHash.slice(0, 10)}...{txHash.slice(-8)}
              </a>
            </p>
          )}
        </div>
      )}
    </div>
  );
}

