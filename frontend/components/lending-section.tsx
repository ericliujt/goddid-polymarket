'use client';

import { usePrivy, useWallets } from '@privy-io/react-auth';
import { useState, useEffect, useRef } from 'react';
import { ethers } from 'ethers';

// Flare network chain IDs
const COSTON2_CHAIN_ID = 114; // Flare Testnet (Coston2)
const FLARE_MAINNET_CHAIN_ID = 14; // Flare Mainnet
const SUPPORTED_CHAIN_IDS = [COSTON2_CHAIN_ID, FLARE_MAINNET_CHAIN_ID];

interface LogEntry {
  message: string;
  link?: string;
  timestamp: string;
  type?: 'log' | 'error' | 'data' | 'close';
}

interface PolymarketData {
  user?: {
    name: string;
    value: string;
  };
  closedPositions?: Array<{
    realizedPnl: string;
    totalBought: string;
    asset: string;
  }>;
  currentPositions?: Array<{
    size: string;
    avgPrice: string;
    initialValue: string;
    currentValue: string;
    cashPnl: string;
    percentPnl: string;
    totalBought: string;
    realizedPnl: string;
    percentRealizedPnl: string;
    curPrice: string;
  }>;
}

export function LendingSection() {
  const { ready, authenticated, login } = usePrivy();
  const { wallets } = useWallets();
  
  const [polymarketAddress, setPolymarketAddress] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [data, setData] = useState<PolymarketData | null>(null);
  const [isConnectedToFlare, setIsConnectedToFlare] = useState(false);
  const [isSwitchingNetwork, setIsSwitchingNetwork] = useState(false);
  const [currentChainId, setCurrentChainId] = useState<number | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const logsEndRef = useRef<HTMLDivElement>(null);

  // Coston2 network configuration
  const COSTON2_NETWORK = {
    chainId: `0x${COSTON2_CHAIN_ID.toString(16)}`, // 0x72 in hex
    chainName: 'Coston2',
    nativeCurrency: {
      name: 'Coston2',
      symbol: 'C2FLR',
      decimals: 18,
    },
    rpcUrls: ['https://coston2-api.flare.network/ext/C/rpc'],
    blockExplorerUrls: ['https://coston2-explorer.flare.network'],
  };

  // Check if wallet is connected to Flare testnet using Privy
  useEffect(() => {
    if (authenticated && wallets.length > 0) {
      const checkNetwork = async () => {
        try {
          // Get browser wallets (exclude embedded wallets for network switching)
          const browserWallets = wallets.filter(w => w.walletClientType !== 'privy');
          
          if (browserWallets.length > 0) {
            // Use Privy's wallet to get chain ID
            const wallet = browserWallets[0];
            try {
              // Try to get chain ID using Privy's wallet methods
              // Privy wallets may have chainId property or getChainId method
              let chainId: number | null = null;
              
              // Method 1: Check if wallet has chainId property
              if ('chainId' in wallet && wallet.chainId) {
                chainId = typeof wallet.chainId === 'string' 
                  ? parseInt(wallet.chainId, 16) 
                  : Number(wallet.chainId);
              }
              // Method 2: Try getChainId method if available
              else if (typeof (wallet as any).getChainId === 'function') {
                chainId = await (wallet as any).getChainId();
              }
              // Method 3: Fallback to provider
              else {
                const provider = await wallet.getEthereumProvider();
                if (provider && typeof provider.request === 'function') {
                  const network = await provider.request({ method: 'eth_chainId' });
                  chainId = typeof network === 'string' ? parseInt(network, 16) : Number(network);
                }
              }
              
              if (chainId !== null) {
                setCurrentChainId(chainId);
                setIsConnectedToFlare(SUPPORTED_CHAIN_IDS.includes(chainId));
              } else {
                setIsConnectedToFlare(false);
              }
            } catch (error) {
              console.error('Error getting chain ID:', error);
              setIsConnectedToFlare(false);
            }
          } else {
            // For embedded wallets, they work on any chain configured in Privy
            // We can assume they're on a supported chain if Privy is configured for it
            setIsConnectedToFlare(true); // Embedded wallets can work on any chain
            setCurrentChainId(COSTON2_CHAIN_ID); // Default to testnet
          }
        } catch (error) {
          console.error('Error checking network:', error);
          setIsConnectedToFlare(false);
        }
      };
      
      checkNetwork();

      // Listen for network changes via Privy wallet events
      const browserWallets = wallets.filter(w => w.walletClientType !== 'privy');
      if (browserWallets.length > 0) {
        const wallet = browserWallets[0];
        // Try to get provider and listen for chain changes
        wallet.getEthereumProvider().then((provider) => {
          if (provider && typeof provider.on === 'function') {
            const handleChainChanged = () => {
              checkNetwork();
            };
            
            provider.on('chainChanged', handleChainChanged);
            
            return () => {
              if (provider.removeListener) {
                provider.removeListener('chainChanged', handleChainChanged);
              }
            };
          }
        }).catch(() => {
          // Provider not available, skip listener
        });
      }
    } else {
      setIsConnectedToFlare(false);
      setCurrentChainId(null);
    }
  }, [authenticated, wallets]);

  // Network configurations
  const FLARE_MAINNET_NETWORK = {
    chainId: `0x${FLARE_MAINNET_CHAIN_ID.toString(16)}`, // 0xE in hex
    chainName: 'Flare',
    nativeCurrency: {
      name: 'Flare',
      symbol: 'FLR',
      decimals: 18,
    },
    rpcUrls: ['https://flare-api.flare.network/ext/C/rpc'],
    blockExplorerUrls: ['https://flare-explorer.flare.network'],
  };

  // Switch to Flare network using Privy
  const handleSwitchNetwork = async (targetChainId: number = COSTON2_CHAIN_ID) => {
    if (wallets.length === 0) {
      alert('No wallet connected. Please connect your wallet first.');
      return;
    }

    setIsSwitchingNetwork(true);
    try {
      // Get browser wallets (network switching only works for browser wallets)
      const browserWallets = wallets.filter(w => w.walletClientType !== 'privy');
      
      if (browserWallets.length === 0) {
        alert('Network switching is only available for browser wallets. Embedded wallets work on all configured chains.');
        setIsSwitchingNetwork(false);
        return;
      }

      const wallet = browserWallets[0];
      const networkConfig = targetChainId === FLARE_MAINNET_CHAIN_ID ? FLARE_MAINNET_NETWORK : COSTON2_NETWORK;

      try {
        // Use Privy's switchChain method
        // This works for both embedded and browser wallets
        await wallet.switchChain(targetChainId);
        setIsConnectedToFlare(true);
        setCurrentChainId(targetChainId);
      } catch (switchError: any) {
        // If switchChain fails, try to add the network first (for browser wallets only)
        // Error code 4902 means the chain is not added
        if (switchError.code === 4902 || switchError.code === -32603 || switchError.message?.includes('not added')) {
          try {
            // Get the provider to add the network (only works for browser wallets)
            const provider = await wallet.getEthereumProvider();
            if (provider && typeof provider.request === 'function') {
              // Add the network using EIP-3085
              await provider.request({
                method: 'wallet_addEthereumChain',
                params: [networkConfig],
              });
              
              // Try switching again after adding
              await wallet.switchChain(targetChainId);
              setIsConnectedToFlare(true);
              setCurrentChainId(targetChainId);
            } else {
              throw new Error('Provider not available for adding network');
            }
          } catch (addError: any) {
            console.error('Error adding network:', addError);
            const networkName = targetChainId === FLARE_MAINNET_CHAIN_ID ? 'Flare Mainnet' : 'Coston2 Testnet';
            alert(`Failed to add ${networkName}. Please add it manually in your wallet settings:\n\n` +
                  `Network Name: ${networkConfig.chainName}\n` +
                  `RPC URL: ${networkConfig.rpcUrls[0]}\n` +
                  `Chain ID: ${targetChainId}\n` +
                  `Currency Symbol: ${networkConfig.nativeCurrency.symbol}`);
          }
        } else {
          console.error('Error switching network:', switchError);
          const networkName = targetChainId === FLARE_MAINNET_CHAIN_ID ? 'Flare Mainnet' : 'Coston2 Testnet';
          alert(`Failed to switch network: ${switchError.message || 'Unknown error'}\n\nPlease switch to ${networkName} (Chain ID: ${targetChainId}) manually in your wallet.`);
        }
      }
    } catch (error: any) {
      console.error('Network switch error:', error);
      alert(`An error occurred while switching networks: ${error.message || 'Unknown error'}`);
    } finally {
      setIsSwitchingNetwork(false);
    }
  };

  // Auto-scroll logs to bottom
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  // Cleanup EventSource on unmount
  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, []);

  const handleStartAttestation = async () => {
    if (!polymarketAddress.trim() || !ethers.isAddress(polymarketAddress.trim())) {
      alert('Please enter a valid Polymarket address');
      return;
    }

    setIsProcessing(true);
    setLogs([]);
    setData(null);

    try {
      const eventSource = new EventSource(`/api/polymarket/attestation`, {
        method: 'POST',
        body: JSON.stringify({ polymarketAddress: polymarketAddress.trim() }),
      } as any);

      // Use fetch with POST instead of EventSource (EventSource doesn't support POST)
      const response = await fetch('/api/polymarket/attestation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ polymarketAddress: polymarketAddress.trim() }),
      });

      if (!response.ok) {
        throw new Error('Failed to start attestation');
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error('No response body');
      }

      let buffer = '';
      let currentEventType = 'log';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('event: ')) {
            currentEventType = line.replace('event: ', '').trim();
            continue;
          }
          if (line.startsWith('data: ')) {
            const dataStr = line.replace('data: ', '').trim();
            try {
              const data = JSON.parse(dataStr);
              
              // Handle different event types
              if (currentEventType === 'log') {
                if (data.message) {
                  setLogs(prev => [...prev, {
                    message: data.message,
                    link: data.link,
                    timestamp: new Date().toISOString(),
                    type: 'log',
                  }]);
                }
              }
              
              if (currentEventType === 'data') {
                if (data.type === 'complete' && data.data) {
                  // Complete data object received
                  setData(data.data);
                  setLogs(prev => [...prev, {
                    message: '✅ Final data received and displayed!',
                    timestamp: new Date().toISOString(),
                    type: 'log',
                  }]);
                } else if (data.data) {
                  // Partial data update
                  setData(prev => ({ ...prev, ...data.data }));
                }
              }
              
              if (currentEventType === 'error' || data.type === 'error') {
                setLogs(prev => [...prev, {
                  message: data.message || 'An error occurred',
                  timestamp: new Date().toISOString(),
                  type: 'error',
                }]);
                setIsProcessing(false);
              }
              
              if (currentEventType === 'close' || data.type === 'close') {
                setIsProcessing(false);
              }
            } catch (e) {
              // Ignore parse errors
            }
          }
        }
      }
    } catch (error: any) {
      setLogs(prev => [...prev, {
        message: `Error: ${error.message}`,
        timestamp: new Date().toISOString(),
        type: 'error',
      }]);
      setIsProcessing(false);
    }
  };

  const formatNumber = (num: string) => {
    const n = BigInt(num);
    return (Number(n) / 1e6).toFixed(2);
  };

  if (!ready) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="bg-white/10 backdrop-blur-xl rounded-2xl shadow-2xl p-8 border border-white/20">
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-zinc-800 mx-auto"></div>
            <p className="mt-4 text-zinc-700">Initializing...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!authenticated) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="bg-white/10 backdrop-blur-xl rounded-2xl shadow-2xl p-8 border border-white/20">
          <div className="text-center py-12">
            <h2 className="text-3xl font-bold text-zinc-900 mb-4 drop-shadow-lg">
              Connect Your Wallet
            </h2>
            <p className="text-zinc-700 text-lg mb-6">
              Please connect your wallet to access the lending section.
            </p>
            <button
              onClick={login}
              className="px-6 py-3 bg-zinc-900/80 backdrop-blur-sm text-white rounded-lg hover:bg-zinc-900 transition-all text-sm font-medium border border-zinc-800/50"
            >
              Connect Wallet
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!isConnectedToFlare) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="bg-white/10 backdrop-blur-xl rounded-2xl shadow-2xl p-8 border border-white/20">
          <div className="text-center py-12">
            <h2 className="text-3xl font-bold text-zinc-900 mb-4 drop-shadow-lg">
              Switch to Flare Network
            </h2>
            <p className="text-zinc-700 text-lg mb-6">
              Please switch your wallet to Flare Mainnet or Coston2 (Flare Testnet) to continue.
            </p>
            {currentChainId && (
              <p className="text-zinc-600 text-sm mb-4">
                Current Chain ID: {currentChainId} | Supported: {FLARE_MAINNET_CHAIN_ID} (Mainnet) or {COSTON2_CHAIN_ID} (Testnet)
              </p>
            )}
            {!currentChainId && (
              <p className="text-zinc-600 text-sm mb-4">
                Supported Chain IDs: {FLARE_MAINNET_CHAIN_ID} (Mainnet) or {COSTON2_CHAIN_ID} (Testnet)
              </p>
            )}
            <div className="flex gap-4 justify-center">
              <button
                onClick={() => handleSwitchNetwork(FLARE_MAINNET_CHAIN_ID)}
                disabled={isSwitchingNetwork}
                className="px-6 py-3 bg-zinc-900/80 backdrop-blur-sm text-white rounded-lg hover:bg-zinc-900 disabled:opacity-50 disabled:cursor-not-allowed font-semibold transition-all border border-zinc-800/50"
              >
                {isSwitchingNetwork ? 'Switching...' : 'Switch to Flare Mainnet'}
              </button>
              <button
                onClick={() => handleSwitchNetwork(COSTON2_CHAIN_ID)}
                disabled={isSwitchingNetwork}
                className="px-6 py-3 bg-zinc-900/80 backdrop-blur-sm text-white rounded-lg hover:bg-zinc-900 disabled:opacity-50 disabled:cursor-not-allowed font-semibold transition-all border border-zinc-800/50"
              >
                {isSwitchingNetwork ? 'Switching...' : 'Switch to Coston2 Testnet'}
              </button>
            </div>
            <p className="text-zinc-500 text-xs mt-4">
              This will automatically add the network if it's not already in your wallet
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      <div className="bg-white/10 backdrop-blur-xl rounded-2xl shadow-2xl p-8 border border-white/20">
        {/* Header */}
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-zinc-900 mb-2 drop-shadow-lg">
            Polymarket Data Attestation
          </h2>
          <p className="text-zinc-700">
            Verify your Polymarket trading data using Flare Data Connector (FDC)
          </p>
        </div>

        {/* Input Form */}
        <div className="mb-8 p-6 bg-white/10 backdrop-blur-md rounded-xl border border-white/20">
          <label className="block text-sm font-medium text-zinc-900 mb-2">
            Polymarket Address
          </label>
          <div className="flex gap-4">
            <input
              type="text"
              value={polymarketAddress}
              onChange={(e) => setPolymarketAddress(e.target.value)}
              placeholder="0x..."
              disabled={isProcessing}
              className="flex-1 p-3 border border-zinc-300/50 rounded-lg bg-white/20 backdrop-blur-sm text-zinc-900 font-mono placeholder-zinc-500 focus:ring-2 focus:ring-zinc-500 focus:border-zinc-500 focus:outline-none disabled:opacity-50"
            />
            <button
              onClick={handleStartAttestation}
              disabled={isProcessing || !polymarketAddress.trim()}
              className="px-6 py-3 bg-zinc-900/80 backdrop-blur-sm text-white rounded-lg hover:bg-zinc-900 disabled:opacity-50 disabled:cursor-not-allowed font-semibold transition-all border border-zinc-800/50"
            >
              {isProcessing ? 'Processing...' : 'Start Attestation'}
            </button>
          </div>
        </div>

        {/* Two Column Layout */}
        {isProcessing || logs.length > 0 || data ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left: Logs */}
            <div className="bg-white/10 backdrop-blur-md rounded-xl border border-white/20 p-6">
              <h3 className="text-lg font-semibold text-zinc-900 mb-4">Live Logs</h3>
              <div className="h-[600px] overflow-y-auto space-y-2 font-mono text-sm">
                {logs.map((log, index) => (
                  <div
                    key={index}
                    className={`p-2 rounded ${
                      log.type === 'error'
                        ? 'bg-red-500/20 text-red-800'
                        : 'bg-white/5 text-zinc-800'
                    }`}
                  >
                    <span className="text-zinc-500 text-xs">
                      {new Date(log.timestamp).toLocaleTimeString()}
                    </span>
                    {' '}
                    {log.link ? (
                      <a
                        href={log.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-800 underline"
                      >
                        {log.message}
                      </a>
                    ) : (
                      <span>{log.message}</span>
                    )}
                  </div>
                ))}
                <div ref={logsEndRef} />
              </div>
            </div>

            {/* Right: Data */}
            <div className="bg-white/10 backdrop-blur-md rounded-xl border border-white/20 p-6">
              <h3 className="text-lg font-semibold text-zinc-900 mb-4">User Data</h3>
              <div className="h-[600px] overflow-y-auto">
                {data ? (
                  <div className="space-y-6">
                    {/* User Info */}
                    {data.user && (
                      <div className="p-4 bg-white/10 rounded-lg border border-white/20">
                        <h4 className="font-semibold text-zinc-900 mb-2">User Information</h4>
                        <p className="text-zinc-700">
                          <span className="font-medium">Name:</span> {data.user.name}
                        </p>
                        <p className="text-zinc-700">
                          <span className="font-medium">Value:</span> ${formatNumber(data.user.value)}
                        </p>
                      </div>
                    )}

                    {/* Closed Positions */}
                    {data.closedPositions && data.closedPositions.length > 0 && (
                      <div className="p-4 bg-white/10 rounded-lg border border-white/20">
                        <h4 className="font-semibold text-zinc-900 mb-2">
                          Closed Positions ({data.closedPositions.length})
                        </h4>
                        <div className="space-y-2 max-h-48 overflow-y-auto">
                          {data.closedPositions.map((position, index) => (
                            <div key={index} className="p-2 bg-white/5 rounded text-xs">
                              <p className="text-zinc-700">
                                <span className="font-medium">P&L:</span> ${formatNumber(position.realizedPnl)}
                              </p>
                              <p className="text-zinc-700">
                                <span className="font-medium">Total Bought:</span> ${formatNumber(position.totalBought)}
                              </p>
                              <p className="text-zinc-600 font-mono text-xs truncate">
                                Asset: {position.asset}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Current Positions */}
                    {data.currentPositions && data.currentPositions.length > 0 && (
                      <div className="p-4 bg-white/10 rounded-lg border border-white/20">
                        <h4 className="font-semibold text-zinc-900 mb-2">
                          Current Positions ({data.currentPositions.length})
                        </h4>
                        <div className="space-y-2 max-h-48 overflow-y-auto">
                          {data.currentPositions.map((position, index) => (
                            <div key={index} className="p-2 bg-white/5 rounded text-xs">
                              <p className="text-zinc-700">
                                <span className="font-medium">Size:</span> {formatNumber(position.size)}
                              </p>
                              <p className="text-zinc-700">
                                <span className="font-medium">P&L:</span> ${formatNumber(position.cashPnl)} ({position.percentPnl}%)
                              </p>
                              <p className="text-zinc-700">
                                <span className="font-medium">Current Value:</span> ${formatNumber(position.currentValue)}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {!data.user && !data.closedPositions && !data.currentPositions && (
                      <p className="text-zinc-600 text-center py-8">
                        Waiting for data...
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <p className="text-zinc-600">Data will appear here as it's retrieved...</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-12 bg-white/5 rounded-xl border border-white/10">
            <p className="text-zinc-600">
              Enter a Polymarket address and click "Start Attestation" to begin
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
