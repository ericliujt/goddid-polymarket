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
            <h1 className="text-xl font-bold text-white drop-shadow-lg">
              Privy Demo
            </h1>
          </div>

          {/* Navigation Links */}
          <div className="flex items-center space-x-1">
            <button
              onClick={() => onSectionChange('lending')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeSection === 'lending'
                  ? 'bg-white/20 text-white backdrop-blur-sm'
                  : 'text-white/80 hover:text-white hover:bg-white/10'
              }`}
            >
              Lending
            </button>
            <button
              onClick={() => onSectionChange('staking')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeSection === 'staking'
                  ? 'bg-white/20 text-white backdrop-blur-sm'
                  : 'text-white/80 hover:text-white hover:bg-white/10'
              }`}
            >
              Staking
            </button>
            <button
              onClick={() => onSectionChange('demo')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeSection === 'demo'
                  ? 'bg-white/20 text-white backdrop-blur-sm'
                  : 'text-white/80 hover:text-white hover:bg-white/10'
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
                className="px-4 py-2 bg-white/20 backdrop-blur-sm text-white rounded-lg hover:bg-white/30 transition-all text-sm font-medium border border-white/30"
              >
                Disconnect
              </button>
            ) : (
              <button
                onClick={handleLogin}
                disabled={isConnecting}
                className="px-4 py-2 bg-white/20 backdrop-blur-sm text-white rounded-lg hover:bg-white/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all text-sm font-medium border border-white/30"
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

