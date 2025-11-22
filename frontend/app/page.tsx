'use client';

import { WalletConnection } from '@/components/wallet-connection';
import { SessionSigners } from '@/components/session-signers';
import { Withdraw } from '@/components/withdraw';

export default function Home() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex min-h-screen w-full max-w-4xl flex-col items-center justify-center py-16 px-8">
        <div className="w-full space-y-8">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-black dark:text-zinc-50 mb-4">
              Privy Wallet Integration
            </h1>
            <p className="text-lg text-zinc-600 dark:text-zinc-400">
              Connect your browser wallet and manage session signers
            </p>
          </div>

          <WalletConnection />
          <SessionSigners />
          <Withdraw />
        </div>
      </main>
    </div>
  );
}
