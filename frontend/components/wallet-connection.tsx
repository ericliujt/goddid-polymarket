'use client';

import { usePrivy, useWallets } from '@privy-io/react-auth';
import { useState } from 'react';

export function WalletConnection() {
  const { ready, authenticated, login, logout, user } = usePrivy();
  const { wallets } = useWallets();
  const [isConnecting, setIsConnecting] = useState(false);

  // Get browser wallets only (exclude embedded wallets)
  const browserWallets = wallets.filter(
    (wallet) => wallet.walletClientType !== 'privy'
  );

  const handleLogin = async () => {
    setIsConnecting(true);
    try {
      await login();
    } catch (error) {
      console.error('Login error:', error);
    } finally {
      setIsConnecting(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  if (!ready) {
    return (
      <div className="p-4 border rounded-lg">
        <p className="text-zinc-600 dark:text-zinc-400">Initializing...</p>
      </div>
    );
  }

  if (!authenticated) {
    return (
      <div className="p-4 border rounded-lg bg-white dark:bg-zinc-900">
        <h3 className="text-lg font-semibold text-black dark:text-zinc-50 mb-3">
          Connect Wallet
        </h3>
        <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-4">
          Connect your browser wallet to get started.
        </p>
        <button
          onClick={handleLogin}
          disabled={isConnecting}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isConnecting ? 'Connecting...' : 'Connect Wallet'}
        </button>
      </div>
    );
  }

  return (
    <div className="p-4 border rounded-lg bg-white dark:bg-zinc-900">
      <div className="flex justify-between items-start mb-4">
        <h3 className="text-lg font-semibold text-black dark:text-zinc-50">
          Connected Wallets
        </h3>
        <button
          onClick={handleLogout}
          className="px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700"
        >
          Disconnect
        </button>
      </div>

      {browserWallets.length === 0 ? (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          No browser wallets connected.
        </p>
      ) : (
        <div className="space-y-2">
          {browserWallets.map((wallet) => (
            <div
              key={wallet.address}
              className="p-3 bg-zinc-50 dark:bg-zinc-800 rounded-lg"
            >
              <p className="text-sm font-medium text-black dark:text-zinc-50">
                {wallet.walletClientType || 'Unknown Wallet'}
              </p>
              <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-1 font-mono">
                {wallet.address}
              </p>
            </div>
          ))}
        </div>
      )}

      {user && (
        <div className="mt-4 pt-4 border-t border-zinc-200 dark:border-zinc-700">
          <p className="text-xs text-zinc-500 dark:text-zinc-500">
            User ID: {user.id}
          </p>
        </div>
      )}
    </div>
  );
}


