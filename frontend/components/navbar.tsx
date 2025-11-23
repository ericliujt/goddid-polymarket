'use client';

import { useState } from 'react';
import { usePrivy } from '@privy-io/react-auth';

interface NavbarProps {
  activeSection: 'lending' | 'staking' | 'demo';
  onSectionChange: (section: 'lending' | 'staking' | 'demo') => void;
}

export function Navbar({ activeSection, onSectionChange }: NavbarProps) {
  const { authenticated, login, logout } = usePrivy();
  const [isConnecting, setIsConnecting] = useState(false);

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

  return (
    <nav className="w-full backdrop-blur-xl sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex-shrink-0">
            <h1 
              className="text-3xl sm:text-4xl font-black text-zinc-900 drop-shadow-lg uppercase tracking-tight"
              style={{ 
                fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
                fontWeight: 900,
                letterSpacing: '-0.02em'
              }}
            >
              GODDID.MONEY
            </h1>
          </div>

          {/* Navigation Links */}
          <div className="flex items-center space-x-1">
            <button
              onClick={() => onSectionChange('lending')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeSection === 'lending'
                  ? 'bg-white/30 text-zinc-900 backdrop-blur-sm font-semibold'
                  : 'text-zinc-700 hover:text-zinc-900 hover:bg-white/20'
              }`}
            >
              Lending
            </button>
            <button
              onClick={() => onSectionChange('staking')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeSection === 'staking'
                  ? 'bg-white/30 text-zinc-900 backdrop-blur-sm font-semibold'
                  : 'text-zinc-700 hover:text-zinc-900 hover:bg-white/20'
              }`}
            >
              Staking
            </button>
            <button
              onClick={() => onSectionChange('demo')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeSection === 'demo'
                  ? 'bg-white/30 text-zinc-900 backdrop-blur-sm font-semibold'
                  : 'text-zinc-700 hover:text-zinc-900 hover:bg-white/20'
              }`}
            >
              Demo
            </button>
          </div>

          {/* Connect Wallet Button */}
          <div className="flex-shrink-0">
            {authenticated ? (
              <button
                onClick={handleLogout}
                className="px-4 py-2 bg-zinc-900/80 backdrop-blur-sm text-white rounded-lg hover:bg-zinc-900 transition-all text-sm font-medium border border-zinc-800/50"
              >
                Disconnect
              </button>
            ) : (
              <button
                onClick={handleLogin}
                disabled={isConnecting}
                className="px-4 py-2 bg-zinc-900/80 backdrop-blur-sm text-white rounded-lg hover:bg-zinc-900 disabled:opacity-50 disabled:cursor-not-allowed transition-all text-sm font-medium border border-zinc-800/50"
              >
                {isConnecting ? 'Connecting...' : 'Connect Wallet'}
              </button>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}

