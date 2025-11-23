'use client';

import { useState, useEffect } from 'react';
import { usePrivy, useWallets } from '@privy-io/react-auth';
import { ethers } from 'ethers';

interface NavbarProps {
  activeSection: 'lending' | 'staking' | 'demo';
  onSectionChange: (section: 'lending' | 'staking' | 'demo') => void;
}

// Chain ID to name mapping
const CHAIN_NAMES: Record<number, string> = {
  1: 'Ethereum Mainnet',
  114: 'Coston2 Testnet',
  14: 'Flare Mainnet',
  16: 'Coston Testnet',
  19: 'Songbird',
};

const toHexChainId = (chainId: number): `0x${string}` =>
  `0x${chainId.toString(16)}` as `0x${string}`;

const COSTON2_CHAIN_ID = 114;
const FLARE_MAINNET_CHAIN_ID = 14;

const COSTON2_NETWORK = {
  chainId: toHexChainId(COSTON2_CHAIN_ID),
  chainName: 'Coston2',
  nativeCurrency: {
    name: 'Coston2',
    symbol: 'C2FLR',
    decimals: 18,
  },
  rpcUrls: ['https://coston2-api.flare.network/ext/C/rpc'],
  blockExplorerUrls: ['https://coston2-explorer.flare.network'],
};

export function Navbar({ activeSection, onSectionChange }: NavbarProps) {
  const { authenticated, login, logout } = usePrivy();
  const { wallets } = useWallets();
  const [isConnecting, setIsConnecting] = useState(false);
  const [showWalletInfo, setShowWalletInfo] = useState(false);
  const [currentChainId, setCurrentChainId] = useState<number | null>(null);
  const [walletAddress, setWalletAddress] = useState<string>('');
  const [isSwitchingNetwork, setIsSwitchingNetwork] = useState(false);

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
      setShowWalletInfo(false);
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  // Get wallet info and chain ID
  useEffect(() => {
    if (authenticated && wallets.length > 0) {
      const updateWalletInfo = async () => {
        try {
          const wallet = wallets[0];
          setWalletAddress(wallet.address);

          // Get chain ID
          let chainId: number | null = null;
          
          if ('chainId' in wallet && wallet.chainId) {
            chainId = typeof wallet.chainId === 'string' 
              ? parseInt(wallet.chainId, 16) 
              : Number(wallet.chainId);
          } else if (typeof (wallet as any).getChainId === 'function') {
            chainId = await (wallet as any).getChainId();
          } else {
            try {
              const provider = await wallet.getEthereumProvider();
              if (provider && typeof provider.request === 'function') {
                const network = await provider.request({ method: 'eth_chainId' });
                chainId = typeof network === 'string' ? parseInt(network, 16) : Number(network);
              }
            } catch (e) {
              // Try using ethers provider
              try {
                const provider = await wallet.getEthereumProvider();
                const ethersProvider = new ethers.BrowserProvider(provider);
                const network = await ethersProvider.getNetwork();
                chainId = Number(network.chainId);
              } catch (e2) {
                console.error('Error getting chain ID:', e2);
              }
            }
          }
          
          setCurrentChainId(chainId);
        } catch (error) {
          console.error('Error updating wallet info:', error);
        }
      };

      updateWalletInfo();

      // Listen for chain changes
      const browserWallets = wallets.filter(w => w.walletClientType !== 'privy');
      if (browserWallets.length > 0) {
        const wallet = browserWallets[0];
        wallet.getEthereumProvider().then((provider) => {
          if (provider && typeof provider.on === 'function') {
            const handleChainChanged = () => {
              updateWalletInfo();
            };
            
            provider.on('chainChanged', handleChainChanged);
            
            return () => {
              if (provider.removeListener) {
                provider.removeListener('chainChanged', handleChainChanged);
              }
            };
          }
        }).catch(() => {});
      }
    } else {
      setCurrentChainId(null);
      setWalletAddress('');
    }
  }, [authenticated, wallets]);

  const formatAddress = (address: string) => {
    if (!address) return '';
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  // Switch to Coston2 network
  const handleSwitchToCoston2 = async () => {
    if (wallets.length === 0) {
      alert('No wallet connected. Please connect your wallet first.');
      return;
    }

    setIsSwitchingNetwork(true);
    try {
      const browserWallets = wallets.filter(w => w.walletClientType !== 'privy');
      
      if (browserWallets.length === 0) {
        alert('Network switching is only available for browser wallets. Embedded wallets work on all configured chains.');
        setIsSwitchingNetwork(false);
        return;
      }

      const wallet = browserWallets[0];

      const hexChainId = toHexChainId(COSTON2_CHAIN_ID);

      try {
        await wallet.switchChain(hexChainId);
        // Update wallet info after switching
        const updateWalletInfo = async () => {
          try {
            const provider = await wallet.getEthereumProvider();
            if (provider && typeof provider.request === 'function') {
              const network = await provider.request({ method: 'eth_chainId' });
              const chainId = typeof network === 'string' ? parseInt(network, 16) : Number(network);
              setCurrentChainId(chainId);
            }
          } catch (e) {
            console.error('Error updating chain ID:', e);
          }
        };
        await updateWalletInfo();
      } catch (switchError: any) {
        if (switchError.code === 4902 || switchError.code === -32603 || switchError.message?.includes('not added')) {
          try {
            const provider = await wallet.getEthereumProvider();
            if (provider && typeof provider.request === 'function') {
              await provider.request({
                method: 'wallet_addEthereumChain',
                params: [COSTON2_NETWORK],
              });
              
              await wallet.switchChain(hexChainId);
              // Update wallet info after switching
              const updateWalletInfo = async () => {
                try {
                  const provider = await wallet.getEthereumProvider();
                  if (provider && typeof provider.request === 'function') {
                    const network = await provider.request({ method: 'eth_chainId' });
                    const chainId = typeof network === 'string' ? parseInt(network, 16) : Number(network);
                    setCurrentChainId(chainId);
                  }
                } catch (e) {
                  console.error('Error updating chain ID:', e);
                }
              };
              await updateWalletInfo();
            } else {
              throw new Error('Provider not available for adding network');
            }
          } catch (addError: any) {
            console.error('Error adding network:', addError);
            alert(`Failed to add Coston2 Testnet. Please add it manually in your wallet settings:\n\n` +
                  `Network Name: ${COSTON2_NETWORK.chainName}\n` +
                  `RPC URL: ${COSTON2_NETWORK.rpcUrls[0]}\n` +
                  `Chain ID: ${COSTON2_CHAIN_ID}\n` +
                  `Currency Symbol: ${COSTON2_NETWORK.nativeCurrency.symbol}`);
          }
        } else {
          console.error('Error switching network:', switchError);
          alert(`Failed to switch network: ${switchError.message || 'Unknown error'}\n\nPlease switch to Coston2 Testnet (Chain ID: ${COSTON2_CHAIN_ID}) manually in your wallet.`);
        }
      }
    } catch (error: any) {
      console.error('Network switch error:', error);
      alert(`An error occurred while switching networks: ${error.message || 'Unknown error'}`);
    } finally {
      setIsSwitchingNetwork(false);
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
          <div className="flex-shrink-0 flex items-center gap-2">
            {authenticated ? (
              <>
                {/* Wallet Info Button */}
                <div className="relative">
                  <button
                    onClick={() => setShowWalletInfo(!showWalletInfo)}
                    className="px-4 py-2 bg-white/20 backdrop-blur-sm text-zinc-900 rounded-lg hover:bg-white/30 transition-all text-sm font-medium border border-white/30 flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Wallet Info
                  </button>
                  
                  {/* Wallet Info Dropdown */}
                  {showWalletInfo && (
                    <>
                      <div 
                        className="fixed inset-0 z-40" 
                        onClick={() => setShowWalletInfo(false)}
                      />
                      <div className="absolute right-0 mt-2 w-80 bg-white/95 backdrop-blur-xl rounded-xl shadow-2xl border border-zinc-200/50 p-4 z-50">
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <h3 className="text-sm font-semibold text-zinc-900">Wallet Information</h3>
                            <button
                              onClick={() => setShowWalletInfo(false)}
                              className="text-zinc-500 hover:text-zinc-900"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </div>
                          
                          <div className="pt-2 border-t border-zinc-200">
                            <div className="space-y-2">
                              <div>
                                <p className="text-xs text-zinc-600 mb-1">Wallet Address</p>
                                <div className="flex items-center gap-2">
                                  <p className="text-sm font-mono text-zinc-900 break-all">
                                    {walletAddress || 'N/A'}
                                  </p>
                                  {walletAddress && (
                                    <button
                                      onClick={() => {
                                        navigator.clipboard.writeText(walletAddress);
                                      }}
                                      className="text-zinc-500 hover:text-zinc-900"
                                      title="Copy address"
                                    >
                                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                      </svg>
                                    </button>
                                  )}
                                </div>
                                {walletAddress && (
                                  <p className="text-xs text-zinc-500 mt-1 font-mono">
                                    {formatAddress(walletAddress)}
                                  </p>
                                )}
                              </div>
                              
                              <div>
                                <p className="text-xs text-zinc-600 mb-1">Network</p>
                                <p className="text-sm font-semibold text-zinc-900">
                                  {currentChainId !== null 
                                    ? CHAIN_NAMES[currentChainId] || `Chain ID: ${currentChainId}`
                                    : 'Unknown'
                                  }
                                </p>
                                {currentChainId !== null && (
                                  <p className="text-xs text-zinc-500 mt-1">
                                    Chain ID: {currentChainId}
                                  </p>
                                )}
                                {currentChainId !== COSTON2_CHAIN_ID && (
                                  <button
                                    onClick={handleSwitchToCoston2}
                                    disabled={isSwitchingNetwork}
                                    className="mt-2 w-full px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed text-xs font-medium transition-all"
                                  >
                                    {isSwitchingNetwork ? 'Switching...' : 'Switch to Coston2 Testnet'}
                                  </button>
                                )}
                              </div>
                              
                              {wallets.length > 0 && (
                                <div>
                                  <p className="text-xs text-zinc-600 mb-1">Wallet Type</p>
                                  <p className="text-sm text-zinc-900">
                                    {wallets[0].walletClientType === 'privy' ? 'Embedded Wallet' : wallets[0].walletClientType || 'Browser Wallet'}
                                  </p>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                </div>
                
                {/* Disconnect Button */}
                <button
                  onClick={handleLogout}
                  className="px-4 py-2 bg-zinc-900/80 backdrop-blur-sm text-white rounded-lg hover:bg-zinc-900 transition-all text-sm font-medium border border-zinc-800/50"
                >
                  Disconnect
                </button>
              </>
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

