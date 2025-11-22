'use client';

import { PrivyProvider as PrivyProviderBase } from '@privy-io/react-auth';
import { ReactNode } from 'react';

interface PrivyProviderProps {
  children: ReactNode;
}

export function PrivyProvider({ children }: PrivyProviderProps) {
  // Get Privy App ID from environment variables
  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;

  // Validate app ID before rendering
  if (!appId || appId.trim() === '') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-red-50 dark:bg-red-900/20">
        <div className="p-6 border border-red-200 dark:border-red-800 rounded-lg bg-white dark:bg-zinc-900">
          <h2 className="text-xl font-semibold text-red-800 dark:text-red-200 mb-2">
            Privy Configuration Error
          </h2>
          <p className="text-red-700 dark:text-red-300">
            NEXT_PUBLIC_PRIVY_APP_ID is not set. Please add it to your .env.local file.
          </p>
          <p className="text-sm text-red-600 dark:text-red-400 mt-2">
            Make sure to restart the Next.js dev server after adding environment variables.
          </p>
        </div>
      </div>
    );
  }

  return (
    <PrivyProviderBase
      appId={appId}
      config={{
        // Allow both browser wallets and embedded wallets
        // Note: Session signers ONLY work with embedded wallets
        loginMethods: ['wallet'],
        embeddedWallets: {
          // Enable embedded wallets - REQUIRED for session signers
          // Session signers can ONLY be added to embedded wallets, not browser wallets
          // Setting to 'all' ensures embedded wallets are always created for all users
          createOnLogin: 'all',
        },
        // Disable email login
        appearance: {
          theme: 'light',
          accentColor: '#676FFF',
        },
        // Configure wallet options - browser wallets
        walletConnectors: [
          'metamask',
          'wallet_connect',
          'coinbase_wallet',
          'rainbow',
          'zerion',
          'imtoken',
          'trust',
        ],
      }}
    >
      {children}
    </PrivyProviderBase>
  );
}

