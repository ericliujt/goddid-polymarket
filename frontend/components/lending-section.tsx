'use client';

import { usePrivy, useWallets } from '@privy-io/react-auth';
import { useState, useEffect, useRef } from 'react';
import { ethers } from 'ethers';
import CreditScoreABI from '../../deployments/basesepolia_84532/CreditScore.json';

// Flare network chain IDs
const COSTON2_CHAIN_ID = 114; // Flare Testnet (Coston2)
const FLARE_MAINNET_CHAIN_ID = 14; // Flare Mainnet
const SUPPORTED_CHAIN_IDS = [COSTON2_CHAIN_ID, FLARE_MAINNET_CHAIN_ID];

// Credit Score Contract Address on Base Sepolia
const CREDIT_SCORE_CONTRACT_ADDRESS = '0x18D4EE2813d4eb63cC89DC82A8bFe30B482944ed';

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
  const [creditScore, setCreditScore] = useState<number | null>(null);
  const [isCalculatingScore, setIsCalculatingScore] = useState(false);
  const [baseScore, setBaseScore] = useState<number | null>(null);
  const [scoreTimestamp, setScoreTimestamp] = useState<string | null>(null);
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

  // Load stored data and last credit score on mount
  useEffect(() => {
    // Load Polymarket data
    const storedData = localStorage.getItem('polymarketData');
    if (storedData) {
      try {
        const parsedData = JSON.parse(storedData);
        setData(parsedData);
      } catch (error) {
        console.error('Error loading stored data:', error);
      }
    }
    
    // Load last credit score
    const lastScore = localStorage.getItem('lastCreditScore');
    if (lastScore) {
      try {
        const scoreData = JSON.parse(lastScore);
        setCreditScore(parseInt(scoreData.score));
        setBaseScore(parseInt(scoreData.baseScore));
        setScoreTimestamp(scoreData.timestamp);
      } catch (error) {
        console.error('Error loading last credit score:', error);
      }
    }
  }, []);

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
                  chainId = typeof network === 'string' 
                    ? parseInt(network, 16) 
                    : Number(network);
                }
              }
              
              if (chainId) {
                console.log('Current chain ID:', chainId);
                setCurrentChainId(chainId);
                setIsConnectedToFlare(SUPPORTED_CHAIN_IDS.includes(chainId));
              }
            } catch (error) {
              console.error('Error getting chain ID:', error);
              setIsConnectedToFlare(false);
            }
          }
        } catch (error) {
          console.error('Error checking network:', error);
        }
      };
      checkNetwork();
    }
  }, [authenticated, wallets]);

  const switchToFlareNetwork = async () => {
    if (!authenticated || wallets.length === 0) {
      await login();
      return;
    }

    const browserWallets = wallets.filter(w => w.walletClientType !== 'privy');
    if (browserWallets.length === 0) {
      alert('Please use a browser wallet (like MetaMask) to switch networks');
      return;
    }

    setIsSwitchingNetwork(true);
    try {
      const wallet = browserWallets[0];
      const provider = await wallet.getEthereumProvider();
      
      if (!provider || typeof provider.request !== 'function') {
        throw new Error('Wallet provider not available');
      }

      try {
        // First, try to switch to the network
        await provider.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: COSTON2_NETWORK.chainId }],
        });
        
        setIsConnectedToFlare(true);
        setCurrentChainId(COSTON2_CHAIN_ID);
      } catch (switchError: any) {
        // This error code indicates that the chain has not been added to MetaMask
        if (switchError.code === 4902) {
          try {
              await provider.request({
                method: 'wallet_addEthereumChain',
              params: [COSTON2_NETWORK],
            });
            
            // After adding, try switching again
            await provider.request({
              method: 'wallet_switchEthereumChain',
              params: [{ chainId: COSTON2_NETWORK.chainId }],
            });
            
              setIsConnectedToFlare(true);
            setCurrentChainId(COSTON2_CHAIN_ID);
          } catch (addError) {
            console.error('Failed to add Coston2 network:', addError);
            alert('Failed to add Coston2 network to your wallet. Please add it manually.');
          }
        } else {
          console.error('Failed to switch network:', switchError);
          alert(`Failed to switch to Coston2: ${switchError.message || 'Unknown error'}`);
        }
      }
    } catch (error: any) {
      console.error('Network switch error:', error);
      alert(`Error: ${error.message || 'Failed to switch network'}`);
    } finally {
      setIsSwitchingNetwork(false);
    }
  };

  const formatValue = (value: string | number | undefined): string => {
    if (!value && value !== 0) return 'N/A';
    const num = typeof value === 'string' ? parseFloat(value) : value;
    if (isNaN(num)) return 'N/A';
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(num);
  };

  const addLog = (message: string, type: 'log' | 'error' = 'log', link?: string) => {
    setLogs((prev) => [
      ...prev,
      {
        message,
        link,
        timestamp: new Date().toISOString(),
        type,
      },
    ]);
    
    // Auto-scroll to bottom
    setTimeout(() => {
      logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  useEffect(() => {
    // Auto-scroll logs when new logs are added
    if (logsEndRef.current && logs.length > 0) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs]);

  // Helper function to handle partial data updates
  const handleDataUpdate = (newData: any) => {
    console.log('Processing data update:', newData);

    // Parse JSON strings if needed
    let parsedData = newData;
    if (typeof newData === 'string') {
      try {
        parsedData = JSON.parse(newData);
      } catch (error) {
        console.error('Failed to parse data string:', error);
        return;
      }
    }

    // Ensure the data has the expected structure
    if (parsedData.currentPositions && Array.isArray(parsedData.currentPositions)) {
      setData(parsedData);
      
      // Store in local storage without assets
      const dataForStorage = {
        user: parsedData.user,
        closedPositions: parsedData.closedPositions?.map(({ realizedPnl, totalBought }: any) => ({
          realizedPnl,
          totalBought
        })),
        currentPositions: parsedData.currentPositions
      };
      localStorage.setItem('polymarketData', JSON.stringify(dataForStorage));
      localStorage.setItem('polymarketDataTimestamp', new Date().toISOString());
    }
  };

  // Cleanup on unmount
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
                  handleDataUpdate(data.data);
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
            } catch (error) {
              console.error('Failed to parse SSE data:', error);
            }
          }
        }
      }
    } catch (error) {
      console.error('Attestation error:', error);
      addLog(`Error: ${error}`, 'error');
      setIsProcessing(false);
    }
  };

  // Calculate credit score using the blockchain contract
  async function handleCalculateCreditScore() {
    if (!data) {
      addLog('Please load Polymarket data first', 'error');
      return;
    }
    
    setIsCalculatingScore(true);
    setCreditScore(null);
    setBaseScore(null);
    const startTime = Date.now();
    
    try {
      addLog('🚀 Initiating credit score calculation on Base Sepolia...', 'log');
      
      // Call the API endpoint with SSE support
      const response = await fetch('/api/credit-score', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          polymarketData: {
            user: data.user,
            closedPositions: data.closedPositions?.map(({ realizedPnl, totalBought }) => ({
              realizedPnl,
              totalBought
            })),
            currentPositions: data.currentPositions
          }
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to calculate credit score');
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      
      if (!reader) {
        throw new Error('No response body');
      }

      let buffer = '';
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const dataStr = line.replace('data: ', '').trim();
            if (!dataStr) continue;
            
            try {
              const event = JSON.parse(dataStr);
              
              if (event.type === 'log' && event.message) {
                addLog(event.message, 'log');
              } else if (event.type === 'error') {
                addLog(event.message || 'An error occurred', 'error');
              } else if (event.type === 'result' && event.data) {
                const result = event.data;
                
                if (result.success) {
                  setCreditScore(parseInt(result.creditScore));
                  setBaseScore(parseInt(result.baseScore));
                  setScoreTimestamp(new Date().toISOString());
                  
                  const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(1);
                  addLog(`✅ Credit Score calculated successfully in ${elapsedTime}s!`, 'log');
                  addLog(`📊 Final Score: ${result.creditScore} | Base Score: ${result.baseScore}`, 'log');
                  addLog(`⭐ Rating: ${result.rating}`, 'log');
                  
                  // Store the score in local storage
                  localStorage.setItem('lastCreditScore', JSON.stringify({
                    score: result.creditScore,
                    baseScore: result.baseScore,
                    rating: result.rating,
                    timestamp: new Date().toISOString(),
                    walletAddress: result.walletAddress
                  }));
                } else {
                  addLog(result.message || 'Failed to calculate score', 'error');
                  if (result.baseScore) {
                    setBaseScore(parseInt(result.baseScore));
                    addLog(`Base score calculated: ${result.baseScore}`, 'log');
                  }
                }
              } else if (event.type === 'close') {
                break;
              }
            } catch (error) {
              console.error('Failed to parse event:', error);
            }
          }
        }
      }
    } catch (error: any) {
      console.error('Error calculating credit score:', error);
      addLog(`Error: ${error.message || 'Failed to calculate credit score'}`, 'error');
    } finally {
      setIsCalculatingScore(false);
      const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
      addLog(`⏱️ Total time: ${totalTime} seconds`, 'log');
    }
  }

  // Check existing credit score
  async function handleCheckExistingScore() {
    if (!wallets.length) {
      addLog('Please connect wallet first', 'error');
      return;
    }
    
    try {
      const wallet = wallets[0];
      const provider = await wallet.getEthereumProvider();
      const ethersProvider = new ethers.BrowserProvider(provider);
      const signer = await ethersProvider.getSigner();
      const address = await signer.getAddress();
      
      addLog('Checking existing credit score...', 'log');
      
      const response = await fetch(`/api/credit-score?wallet=${address}`);
      const result = await response.json();
      
      if (result.success && result.creditScore) {
        setCreditScore(parseInt(result.creditScore));
        if (result.baseScore) {
          setBaseScore(parseInt(result.baseScore));
        }
        setScoreTimestamp(new Date().toISOString());
        addLog(`✅ Found existing credit score: ${result.creditScore}`, 'log');
      } else {
        addLog('No existing credit score found for this wallet', 'log');
      }
    } catch (error: any) {
      console.error('Error checking score:', error);
      addLog(`Error: ${error.message || 'Failed to check score'}`, 'error');
    }
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
              className="flex-1 px-4 py-3 rounded-lg bg-white/90 border border-gray-300 
                       text-gray-900 placeholder-gray-500 focus:outline-none 
                       focus:ring-2 focus:ring-blue-500 focus:border-transparent
                       transition-all duration-200"
            />
            <button
              onClick={handleStartAttestation}
              disabled={isProcessing}
              className={`px-6 py-3 rounded-lg font-semibold transition-all duration-200 
                       ${isProcessing 
                         ? 'bg-gray-400 text-gray-200 cursor-not-allowed' 
                         : 'bg-gradient-to-r from-blue-500 to-blue-600 text-white hover:from-blue-600 hover:to-blue-700 shadow-lg hover:shadow-xl transform hover:scale-105'}`}
            >
              {isProcessing ? 'Processing...' : 'Start Attestation'}
            </button>
          </div>
        </div>

        {/* Improved Data Display */}
        {data && (
          <div className="mb-8 space-y-6">
            {/* Summary Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-gradient-to-br from-blue-500/20 to-cyan-500/20 p-4 rounded-xl border border-blue-300/30 backdrop-blur-sm">
                <div className="text-sm text-zinc-700 mb-1">Portfolio Value</div>
                <div className="text-2xl font-bold text-zinc-900">
                  ${formatValue(data.user?.value)}
                </div>
              </div>
              
              <div className="bg-gradient-to-br from-green-500/20 to-emerald-500/20 p-4 rounded-xl border border-green-300/30 backdrop-blur-sm">
                <div className="text-sm text-zinc-700 mb-1">Total Closed P&L</div>
                <div className="text-2xl font-bold text-green-700">
                  ${formatValue(
                    data.closedPositions?.reduce((sum, pos) => 
                      sum + parseFloat(pos.realizedPnl), 0
                    )
                  )}
                </div>
              </div>
              
              <div className="bg-gradient-to-br from-purple-500/20 to-pink-500/20 p-4 rounded-xl border border-purple-300/30 backdrop-blur-sm">
                <div className="text-sm text-zinc-700 mb-1">Active Positions</div>
                <div className="text-2xl font-bold text-zinc-900">
                  {data.currentPositions?.length || 0}
                </div>
              </div>
              
              <div className="bg-gradient-to-br from-orange-500/20 to-red-500/20 p-4 rounded-xl border border-orange-300/30 backdrop-blur-sm">
                <div className="text-sm text-zinc-700 mb-1">Current P&L</div>
                <div className={`text-2xl font-bold ${
                  (data.currentPositions?.reduce((sum, pos) => 
                    sum + parseFloat(pos.cashPnl), 0) || 0) >= 0 
                    ? 'text-green-700' : 'text-red-700'
                }`}>
                  ${formatValue(
                    data.currentPositions?.reduce((sum, pos) => 
                      sum + parseFloat(pos.cashPnl), 0
                    )
                    )}
                  </div>
              </div>
            </div>

            {/* Positions Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Current Positions */}
              {data.currentPositions && data.currentPositions.length > 0 && (
                <div className="bg-white/10 backdrop-blur-sm rounded-xl p-5 border border-white/20">
                  <h3 className="text-lg font-semibold text-zinc-900 mb-4 flex items-center gap-2">
                    <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                    Active Positions ({data.currentPositions.length})
                  </h3>
                  <div className="space-y-3 max-h-64 overflow-y-auto custom-scrollbar">
                    {data.currentPositions.map((pos, idx) => (
                      <div key={idx} className="bg-white/50 rounded-lg p-3 border border-gray-200/50">
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div>
                            <span className="text-gray-600">Size:</span>
                            <span className="ml-2 font-semibold">${formatValue(pos.size)}</span>
                          </div>
                          <div>
                            <span className="text-gray-600">Value:</span>
                            <span className="ml-2 font-semibold">${formatValue(pos.currentValue)}</span>
                          </div>
                          <div className="col-span-2">
                            <span className="text-gray-600">P&L:</span>
                            <span className={`ml-2 font-bold ${
                              parseFloat(pos.cashPnl) >= 0 ? 'text-green-600' : 'text-red-600'
                            }`}>
                              ${formatValue(pos.cashPnl)} ({pos.percentPnl}%)
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                      </div>
                    )}

                    {/* Closed Positions */}
                    {data.closedPositions && data.closedPositions.length > 0 && (
                <div className="bg-white/10 backdrop-blur-sm rounded-xl p-5 border border-white/20">
                  <h3 className="text-lg font-semibold text-zinc-900 mb-4 flex items-center gap-2">
                    <span className="w-2 h-2 bg-gray-400 rounded-full"></span>
                          Closed Positions ({data.closedPositions.length})
                  </h3>
                  <div className="space-y-3 max-h-64 overflow-y-auto custom-scrollbar">
                    {data.closedPositions.slice(0, 5).map((pos, idx) => (
                      <div key={idx} className="bg-white/50 rounded-lg p-3 border border-gray-200/50">
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div>
                            <span className="text-gray-600">Invested:</span>
                            <span className="ml-2 font-semibold">${formatValue(pos.totalBought)}</span>
                          </div>
                          <div>
                            <span className="text-gray-600">P&L:</span>
                            <span className={`ml-2 font-bold ${
                              parseFloat(pos.realizedPnl) >= 0 ? 'text-green-600' : 'text-red-600'
                            }`}>
                              ${formatValue(pos.realizedPnl)}
                            </span>
                            </div>
                        </div>
                      </div>
                    ))}
                    {data.closedPositions.length > 5 && (
                      <div className="text-center text-sm text-gray-500 pt-2">
                        +{data.closedPositions.length - 5} more positions
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Credit Score Section */}
        <div className="mt-8 p-6 bg-gradient-to-br from-violet-500/10 to-purple-500/10 rounded-2xl border border-violet-300/30 backdrop-blur-sm">
          <h3 className="text-2xl font-bold text-zinc-900 mb-4">Credit Score Engine</h3>
          
          {data && (
            <div className="space-y-4">
              <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
                <div className="flex-1 text-center">
                  {creditScore !== null ? (
                    <div className="relative">
                      <div className="text-7xl font-bold bg-gradient-to-r from-violet-600 to-purple-600 bg-clip-text text-transparent animate-pulse">
                        {creditScore}
                            </div>
                      <div className="text-sm text-zinc-600 mt-2">Your DeFi Credit Score</div>
                      {baseScore !== null && (
                        <div className="text-xs text-zinc-500 mt-1">
                          Base Score: {baseScore} (±50 with entropy)
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-gray-400">
                      <div className="text-5xl mb-2">---</div>
                      <div className="text-sm">Calculate your credit score</div>
                    </div>
                  )}
                </div>
                
                <div className="flex flex-col gap-3">
                  <button
                    onClick={handleCalculateCreditScore}
                    disabled={!data || isCalculatingScore}
                    className={`px-6 py-3 rounded-xl font-semibold transition-all ${
                      !data || isCalculatingScore
                        ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                        : 'bg-gradient-to-r from-violet-500 to-purple-500 text-white hover:from-violet-600 hover:to-purple-600 shadow-lg hover:shadow-xl transform hover:scale-105'
                    }`}
                  >
                    {isCalculatingScore ? (
                      <div className="flex items-center gap-2">
                        <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full" />
                        <span>Calculating...</span>
                        <span className="text-xs">~8s</span>
                      </div>
                    ) : (
                      'Calculate Credit Score'
                    )}
                  </button>
                  
                  <button
                    onClick={handleCheckExistingScore}
                    disabled={isCalculatingScore}
                    className={`px-6 py-3 rounded-xl font-semibold transition-all ${
                      isCalculatingScore
                        ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                        : 'bg-gradient-to-r from-blue-500 to-indigo-500 text-white hover:from-blue-600 hover:to-indigo-600 shadow-lg hover:shadow-xl transform hover:scale-105'
                    }`}
                  >
                    Check Existing Score
                  </button>
                </div>
              </div>
              
              {creditScore !== null && (
                <div className="mt-4 p-4 bg-white/50 rounded-lg">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                    <div className="text-center">
                      <div className="text-zinc-600">Score Range</div>
                      <div className="font-semibold">
                        {creditScore < 300 ? 'Poor' : 
                         creditScore < 500 ? 'Fair' :
                         creditScore < 700 ? 'Good' :
                         creditScore < 850 ? 'Very Good' : 'Excellent'}
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="text-zinc-600">Calculated</div>
                      <div className="font-semibold">
                        {scoreTimestamp ? 
                          new Date(scoreTimestamp).toLocaleTimeString('en-US', { 
                            hour: '2-digit', 
                            minute: '2-digit', 
                            second: '2-digit' 
                          }) : 
                          'Just Now'}
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="text-zinc-600">Method</div>
                      <div className="font-semibold">On-Chain Entropy</div>
                    </div>
                  </div>
                </div>
              )}
                  </div>
                )}
              </div>

        {/* Logs Section - Horizontally stretched */}
        {logs.length > 0 && (
          <div className="mt-8">
            <h3 className="text-lg font-semibold text-zinc-900 mb-4">Attestation Logs</h3>
            <div className="bg-black/90 text-green-400 p-4 rounded-lg font-mono text-sm overflow-y-auto max-h-64 custom-scrollbar">
              {logs.map((log, idx) => (
                <div key={idx} className="mb-2 flex items-start gap-2">
                  <span className="text-gray-500">[{new Date(log.timestamp).toLocaleTimeString()}]</span>
                  <span className={`flex-1 ${log.type === 'error' ? 'text-red-400' : ''}`}>
                    {log.message}
                  </span>
                  {log.link && (
                    <a 
                      href={log.link} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-blue-400 hover:text-blue-300 underline ml-2"
                    >
                      View
                    </a>
                  )}
                </div>
              ))}
              <div ref={logsEndRef} />
            </div>
          </div>
        )}

        {/* Empty State */}
        {!isProcessing && logs.length === 0 && !data && (
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