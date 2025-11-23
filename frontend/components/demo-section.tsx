'use client';

import { usePrivy, useWallets } from '@privy-io/react-auth';
import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { getSessionIdsForAddress } from '@/lib/session-storage';
import { SessionSigners } from '@/components/session-signers';

// Coston2 testnet configuration
const COSTON2_CHAIN_ID = 114;

export function DemoSection() {
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
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-zinc-800 mx-auto"></div>
          <p className="mt-4 text-zinc-700">Initializing...</p>
        </div>
      </div>
    );
  }

  if (!authenticated) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="bg-white/10 backdrop-blur-xl rounded-2xl shadow-2xl p-8 border border-white/20">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-zinc-900 mb-4 drop-shadow-lg">
              Connect Your Wallet
            </h2>
            <p className="text-zinc-700">
              Please connect your wallet to access the demo section.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (embeddedWallets.length === 0) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="bg-white/10 backdrop-blur-xl rounded-2xl shadow-2xl p-8 border border-white/20">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-zinc-900 mb-4 drop-shadow-lg">
              No Embedded Wallet Found
            </h2>
            <p className="text-zinc-700">
              Please create an embedded wallet first to use the withdraw functionality.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-white/10 backdrop-blur-xl rounded-2xl shadow-2xl p-8 border border-white/20">
        {/* Header */}
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-zinc-900 mb-2 drop-shadow-lg">
            Privy Session Signer Demo
          </h2>
          <p className="text-zinc-700">
            Experience server-side transaction signing using Privy session signers
          </p>
        </div>

        {/* Session ID Display */}
        <div className="mb-6 p-4 bg-white/10 backdrop-blur-md rounded-xl border border-white/20">
          <h3 className="text-sm font-semibold text-zinc-800 mb-2">
            Privy Session Signer ID
          </h3>
          {signerId ? (
            <div className="flex items-center space-x-2">
              <code className="flex-1 px-3 py-2 bg-white/20 backdrop-blur-sm rounded border border-zinc-300/50 text-sm font-mono text-zinc-900 break-all">
                {signerId}
              </code>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(signerId);
                }}
                className="px-3 py-2 bg-zinc-900/80 backdrop-blur-sm text-white rounded-lg hover:bg-zinc-900 border border-zinc-800/50 text-sm transition-all"
              >
                Copy
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-amber-700">
                ⚠️ No session signer found. Please add a session signer to your embedded wallet first.
              </p>
              <div className="border-t border-zinc-300/50 pt-3">
                <SessionSigners />
              </div>
            </div>
          )}
        </div>

        {/* Wallet Info */}
        <div className="mb-6 p-4 bg-white/10 backdrop-blur-md rounded-xl border border-white/20">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-zinc-600 mb-1">Network</p>
              <p className="font-semibold text-zinc-900">
                Coston2 Testnet (Chain ID: {COSTON2_CHAIN_ID})
              </p>
            </div>
            <div>
              <p className="text-zinc-600 mb-1">Amount</p>
              <p className="font-semibold text-zinc-900">1 FLR</p>
            </div>
            <div className="md:col-span-2">
              <p className="text-zinc-600 mb-1">From Wallet</p>
              <p className="font-mono text-xs text-zinc-900 break-all">
                {selectedWalletAddress || 'No wallet selected'}
              </p>
            </div>
          </div>
        </div>

        {/* Wallet Selection */}
        {embeddedWallets.length > 1 && (
          <div className="mb-6">
            <label className="block text-sm font-medium text-zinc-900 mb-2">
              Select Wallet
            </label>
            <select
              value={selectedWalletAddress}
              onChange={(e) => setSelectedWalletAddress(e.target.value)}
              className="w-full p-3 border border-zinc-300/50 rounded-lg bg-white/20 backdrop-blur-sm text-zinc-900 font-mono focus:ring-2 focus:ring-zinc-500 focus:border-zinc-500 focus:outline-none"
            >
              {embeddedWallets.map((wallet) => (
                <option key={wallet.address} value={wallet.address} className="bg-white text-zinc-900">
                  {wallet.address}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Withdraw Form */}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-zinc-900 mb-2">
              Recipient Address *
            </label>
            <input
              type="text"
              value={recipientAddress}
              onChange={(e) => setRecipientAddress(e.target.value)}
              placeholder="0x..."
              className="w-full p-3 border border-zinc-300/50 rounded-lg bg-white/20 backdrop-blur-sm text-zinc-900 font-mono placeholder-zinc-500 focus:ring-2 focus:ring-zinc-500 focus:border-zinc-500 focus:outline-none"
            />
          </div>

          <button
            onClick={handleWithdraw}
            disabled={loading || !recipientAddress.trim() || !signerId}
            className="w-full px-6 py-3 bg-zinc-900/80 backdrop-blur-sm text-white rounded-lg hover:bg-zinc-900 disabled:opacity-50 disabled:cursor-not-allowed font-semibold text-lg transition-all shadow-lg hover:shadow-xl border border-zinc-800/50"
          >
            {loading ? (
              <span className="flex items-center justify-center">
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Processing...
              </span>
            ) : (
              'Withdraw 1 FLR'
            )}
          </button>
        </div>

        {/* Error and Success Messages */}
        {error && (
          <div className="mt-6 p-4 bg-red-100/80 backdrop-blur-sm border border-red-300/50 rounded-lg">
            <p className="text-red-800 text-sm">{error}</p>
          </div>
        )}

        {success && (
          <div className="mt-6 p-4 bg-green-100/80 backdrop-blur-sm border border-green-300/50 rounded-lg">
            <p className="text-green-800 text-sm font-semibold mb-2">{success}</p>
            {txHash && (
              <a
                href={`https://coston2-explorer.flare.network/tx/${txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-green-700 text-sm hover:underline inline-flex items-center"
              >
                View on Explorer: {txHash.slice(0, 10)}...{txHash.slice(-8)}
                <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

