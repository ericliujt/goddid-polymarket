'use client';

import { usePrivy, useWallets } from '@privy-io/react-auth';
import { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';

const COSTON2_RPC_URL = 'https://coston2-api.flare.network/ext/C/rpc';
const CONTRACT_REGISTRY_ADDRESS = '0xaD67FE66660Fb8dFE9d6b1b4240d8650e30F6019';

interface PoolInfo {
  poolBalance: string;
  fxrpAddress: string;
  poolAddress: string;
  owner?: string;
  userBalance?: string;
  decimals: number;
}

// FXRPool Contract ABI (minimal - only methods we need)
const FXRPOOL_ABI = [
  "function getPoolBalance() external view returns (uint256)",
  "function totalPoolBalance() external view returns (uint256)",
  "function getFXRPAddress() external view returns (address)",
  "function owner() external view returns (address)",
  "function getUserBalance(address) external view returns (uint256)",
];

// AssetManager ABI for getting decimals
const ASSET_MANAGER_ABI = [
  "function assetMintingDecimals() external view returns (uint8)",
];

// ERC20 minimal ABI for allowance/approve/balance
const ERC20_ABI = [
  "function allowance(address owner, address spender) external view returns (uint256)",
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function balanceOf(address account) external view returns (uint256)",
];

export function StakingSection() {
  const { ready, authenticated, login } = usePrivy();
  const { wallets } = useWallets();
  
  // FXRPool state - Hardcoded pool address
  const POOL_ADDRESS = '0x30d9B6F5d78692eE2ebDd57a3EF534D6A8EAefc2';
  const [poolInfo, setPoolInfo] = useState<PoolInfo | null>(null);
  const [isLoadingPool, setIsLoadingPool] = useState(false);
  const [poolError, setPoolError] = useState<string | null>(null);
  const [depositAmount, setDepositAmount] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [actionStatus, setActionStatus] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<'deposit' | 'withdraw' | null>(null);
  const [showDepositInput, setShowDepositInput] = useState(false);
  const [showWithdrawInput, setShowWithdrawInput] = useState(false);

  // Get AssetManager address (from ContractRegistry)
  const getAssetManagerAddress = async (provider: ethers.Provider) => {
    const CONTRACT_REGISTRY_ABI = [
      'function getContractAddressByName(string memory) external view returns (address)',
    ];
    
    const registry = new ethers.Contract(
      CONTRACT_REGISTRY_ADDRESS,
      CONTRACT_REGISTRY_ABI,
      provider
    );
    
    return await registry.getContractAddressByName('AssetManagerFXRP');
  };

  // Fetch FXRPool information
  const fetchPoolInfo = useCallback(async () => {
    setIsLoadingPool(true);
    setPoolError(null);

    try {
      // Always read from Coston2 RPC regardless of user wallet network
      const publicProvider = new ethers.JsonRpcProvider(COSTON2_RPC_URL);

      // First, verify the contract exists by checking if it has code
      const code = await publicProvider.getCode(POOL_ADDRESS);
      if (code === '0x') {
        throw new Error(`No FXRPool contract found at ${POOL_ADDRESS} on Coston2.`);
      }
      
      const poolContract = new ethers.Contract(
        POOL_ADDRESS,
        FXRPOOL_ABI,
        publicProvider
      );

      // Try getPoolBalance() first (the function), fallback to totalPoolBalance() (the public state variable)
      let poolBalance;
      try {
        poolBalance = await poolContract.getPoolBalance();
      } catch (e) {
        console.warn('getPoolBalance() failed, trying totalPoolBalance():', e);
        poolBalance = await poolContract.totalPoolBalance();
      }
      
      // Get FXRP token address
      const fxrpAddress = await poolContract.getFXRPAddress();
      
      // Get pool owner
      const owner = await poolContract.owner();
      
      // Get user balance if wallet is connected
      let userBalance = '0';
      if (wallets.length > 0) {
        const userAddress = wallets[0].address;
        userBalance = await poolContract.getUserBalance(userAddress);
      }

      // Get decimals from AssetManager
      let decimals = 6; // Default FXRP decimals
      try {
        const assetManagerAddress = await getAssetManagerAddress(publicProvider);
        const assetManager = new ethers.Contract(
          assetManagerAddress,
          ASSET_MANAGER_ABI,
          publicProvider
        );
        decimals = await assetManager.assetMintingDecimals();
      } catch (e) {
        console.warn('Could not fetch decimals from AssetManager, using default:', e);
      }

      setPoolInfo({
        poolBalance: poolBalance.toString(),
        fxrpAddress,
        poolAddress: POOL_ADDRESS,
        owner,
        userBalance: userBalance.toString(),
        decimals: Number(decimals),
      });
    } catch (error: any) {
      console.error('Error fetching pool info:', error);
      setPoolError(error.message || 'Failed to fetch pool information.');
      setPoolInfo(null);
    } finally {
      setIsLoadingPool(false);
    }
  }, [wallets]);

  const getWalletSigner = async () => {
    if (wallets.length === 0) {
      throw new Error('Connect your wallet to perform this action.');
    }
    const wallet = wallets[0];
    const provider = await wallet.getEthereumProvider();
    const ethersProvider = new ethers.BrowserProvider(provider);
    const signer = await ethersProvider.getSigner();
    return { wallet, ethersProvider, signer };
  };

  const handleDeposit = async () => {
    if (!poolInfo) {
      setActionStatus('Pool information not loaded yet.');
      return;
    }
    if (!depositAmount || Number(depositAmount) <= 0) {
      setActionStatus('Enter a valid deposit amount.');
      return;
    }

    if (wallets.length === 0) {
      setActionStatus('Please connect your wallet first.');
      return;
    }

    try {
      setActionLoading('deposit');
      setActionStatus('Preparing deposit...');

      // Get user address from connected wallet
      const { signer } = await getWalletSigner();
      const userAddress = await signer.getAddress();

      setActionStatus(`Starting deposit of ${depositAmount} FXRP...`);

      // Call the API route that executes the Hardhat script
      const response = await fetch('/api/fxrpPool/deposit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          depositAmount: depositAmount,
          userAddress: userAddress,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || errorData.message || 'Failed to start deposit');
      }

      // Set up SSE event listener
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error('Failed to get response stream');
      }

      let buffer = '';
      let isComplete = false;

      while (!isComplete) {
        const { done, value } = await reader.read();
        
        if (done) {
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              
              if (data.message) {
                setActionStatus(data.message);
              }
              
              if (data.type === 'success') {
                setActionStatus(`✅ ${data.message}`);
              } else if (data.type === 'error') {
                setActionStatus(`❌ ${data.message}`);
              }
              
              if (data.event === 'complete') {
                isComplete = true;
                if (data.success) {
                  setActionStatus(`✅ Successfully deposited ${depositAmount} FXRP!`);
                  setDepositAmount('');
                  setShowDepositInput(false);
                  
                  // Refresh pool info after a short delay
                  setTimeout(() => {
                    fetchPoolInfo();
                  }, 2000);
                } else {
                  throw new Error(data.error || 'Deposit failed');
                }
              }
            } catch (parseError) {
              // Skip malformed JSON
              console.warn('Failed to parse SSE data:', parseError);
            }
          }
        }
      }

      // Handle remaining buffer
      if (buffer.trim()) {
        try {
          const data = JSON.parse(buffer.slice(6));
          if (data.message) {
            setActionStatus(data.message);
          }
        } catch (e) {
          // Ignore parse errors
        }
      }

    } catch (error: any) {
      console.error('Deposit error:', error);
      let errorMessage = 'Deposit failed.';
      if (error.message) {
        errorMessage = error.message;
      }
      setActionStatus(`❌ ${errorMessage}`);
    } finally {
      setActionLoading(null);
    }
  };

  const handleWithdraw = async () => {
    if (!poolInfo) {
      setActionStatus('Pool information not loaded yet.');
      return;
    }
    if (!withdrawAmount || Number(withdrawAmount) <= 0) {
      setActionStatus('Enter a valid withdraw amount.');
      return;
    }

    if (wallets.length === 0) {
      setActionStatus('Please connect your wallet first.');
      return;
    }

    try {
      setActionLoading('withdraw');
      setActionStatus('Preparing withdrawal...');

      const { signer } = await getWalletSigner();
      const decimals = poolInfo.decimals ?? 6;
      const amountWei = ethers.parseUnits(withdrawAmount, decimals);
      const userAddress = await signer.getAddress();

      // Check user's deposit balance in the pool
      const poolContract = new ethers.Contract(POOL_ADDRESS, FXRPOOL_ABI, signer);
      const userDepositBalance = await poolContract.getUserBalance(userAddress);
      
      if (userDepositBalance < amountWei) {
        const balanceFormatted = ethers.formatUnits(userDepositBalance, decimals);
        throw new Error(
          `Insufficient deposit balance. You have ${balanceFormatted} FXRP deposited, but want to withdraw ${withdrawAmount} FXRP.`
        );
      }

      // Withdraw FXRP from pool
      setActionStatus('Withdrawing FXRP... Please sign the withdrawal transaction in your wallet.');
      const withdrawTx = await poolContract.withdraw(amountWei);
      setActionStatus(`Withdrawal transaction submitted: ${withdrawTx.hash}. Waiting for confirmation...`);
      await withdrawTx.wait();

      setActionStatus(`✅ Successfully withdrew ${withdrawAmount} FXRP! Transaction: ${withdrawTx.hash}`);
      setWithdrawAmount('');
      setShowWithdrawInput(false);
      
      // Refresh pool info after a short delay to ensure blockchain state is updated
      setTimeout(() => {
        fetchPoolInfo();
      }, 2000);
    } catch (error: any) {
      console.error('Withdraw error:', error);
      let errorMessage = 'Withdrawal failed.';
      if (error.message) {
        errorMessage = error.message;
      } else if (error.code === 'ACTION_REJECTED' || error.code === 4001) {
        errorMessage = 'Transaction was rejected. Please try again.';
      } else if (error.code === 'INSUFFICIENT_FUNDS') {
        errorMessage = 'Insufficient funds for gas fees. Please add more funds to your wallet.';
      }
      setActionStatus(`❌ ${errorMessage}`);
    } finally {
      setActionLoading(null);
    }
  };

  // Auto-refresh pool info regardless of wallet network
  useEffect(() => {
    fetchPoolInfo();
    const interval = setInterval(fetchPoolInfo, 30000);
    return () => clearInterval(interval);
  }, [fetchPoolInfo]);

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
              Please connect your wallet to access the staking section.
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

  return (
    <div className="max-w-7xl mx-auto">
      <div className="bg-white/10 backdrop-blur-xl rounded-2xl shadow-2xl p-8 border border-white/20">
        {/* Pool Error Display */}
        {poolError && (
          <div className="mb-6 p-4 bg-red-500/20 border border-red-500/50 rounded-lg">
            <p className="text-red-800 text-sm">{poolError}</p>
          </div>
        )}

        {/* Main Pool Display */}
        <div className="text-center py-12">
          {/* Title */}
          <h1 className="text-5xl font-bold text-zinc-900 mb-8 drop-shadow-lg">
            FXRPool
          </h1>

          {/* Pool Value */}
          {poolInfo ? (
            <div className="mb-4">
              <p className="text-7xl font-bold text-zinc-900 drop-shadow-lg">
                {ethers.formatUnits(poolInfo.poolBalance, poolInfo.decimals)}
              </p>
              <p className="text-2xl text-zinc-700 mt-2">FXRP</p>
            </div>
          ) : isLoadingPool ? (
            <div className="mb-4">
              <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-zinc-800 mx-auto mb-4"></div>
              <p className="text-xl text-zinc-600">Loading pool balance...</p>
            </div>
          ) : (
            <div className="mb-4">
              <p className="text-7xl font-bold text-zinc-400 drop-shadow-lg">--</p>
              <p className="text-2xl text-zinc-500 mt-2">FXRP</p>
            </div>
          )}

          {/* APY Message */}
          <p className="text-base text-zinc-600 mt-6">
            Get 5-7+% APY by staking your FXRP to help top performing prediction market users make more money
          </p>

          {/* Stake and Withdraw Buttons */}
          <div className="mt-8">
            <div className="flex flex-col justify-center items-center gap-3">
              <button
                onClick={() => setShowDepositInput(true)}
                className="px-10 py-4 bg-emerald-600 text-white rounded-lg text-base font-semibold hover:bg-emerald-700 transition-all"
              >
                Stake FXRP
              </button>
              <button
                onClick={() => setShowWithdrawInput(true)}
                className="px-5 py-3 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-700 transition-all"
              >
                Withdraw FXRP
              </button>
            </div>

            {/* Deposit Input Form */}
            {showDepositInput && (
              <div className="mt-4 w-full max-w-md mx-auto space-y-3">
                <label className="text-sm font-semibold text-zinc-900 text-left block">
                  Deposit Amount (FXRP)
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.000001"
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                  placeholder="Amount in FXRP"
                  className="w-full p-3 border border-zinc-300/50 rounded-lg bg-white/20 backdrop-blur-sm text-zinc-900 placeholder-zinc-500 focus:ring-2 focus:ring-zinc-500 focus:border-zinc-500 focus:outline-none"
                />
                <div className="flex gap-3">
                  <button
                    onClick={handleDeposit}
                    disabled={actionLoading === 'deposit'}
                    className="flex-1 px-3 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  >
                    {actionLoading === 'deposit' ? 'Depositing...' : 'Confirm Deposit'}
                  </button>
                  <button
                    onClick={() => {
                      setShowDepositInput(false);
                      setDepositAmount('');
                    }}
                    className="flex-1 px-3 py-2 bg-zinc-200 text-zinc-800 rounded-lg text-sm font-medium hover:bg-zinc-300 transition-all"
                  >
                    Cancel
                  </button>
                </div>
                <p className="text-xs text-zinc-500">
                  Requires FXRP in your wallet and approval for the pool contract.
                </p>
              </div>
            )}

            {/* Withdraw Input Form */}
            {showWithdrawInput && (
              <div className="mt-4 w-full max-w-md mx-auto space-y-3">
                <label className="text-sm font-semibold text-zinc-900 text-left block">
                  Withdraw Amount (FXRP)
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.000001"
                  value={withdrawAmount}
                  onChange={(e) => setWithdrawAmount(e.target.value)}
                  placeholder="Amount in FXRP"
                  className="w-full p-3 border border-zinc-300/50 rounded-lg bg-white/20 backdrop-blur-sm text-zinc-900 placeholder-zinc-500 focus:ring-2 focus:ring-zinc-500 focus:border-zinc-500 focus:outline-none"
                />
                <div className="flex gap-3">
                  <button
                    onClick={handleWithdraw}
                    disabled={actionLoading === 'withdraw'}
                    className="flex-1 px-3 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  >
                    {actionLoading === 'withdraw' ? 'Withdrawing...' : 'Confirm Withdraw'}
                  </button>
                  <button
                    onClick={() => {
                      setShowWithdrawInput(false);
                      setWithdrawAmount('');
                    }}
                    className="flex-1 px-3 py-2 bg-zinc-200 text-zinc-800 rounded-lg text-sm font-medium hover:bg-zinc-300 transition-all"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Action Status */}
        {actionStatus && (
          <div className={`mt-6 p-4 rounded-lg text-center text-sm ${
            actionStatus.startsWith('✅') 
              ? 'bg-green-500/20 border border-green-500/50 text-green-800' 
              : actionStatus.startsWith('❌')
              ? 'bg-red-500/20 border border-red-500/50 text-red-800'
              : 'bg-blue-500/20 border border-blue-500/50 text-blue-800'
          }`}>
            <p className="break-words">{actionStatus}</p>
          </div>
        )}

        {/* Additional Pool Details (Collapsible or Secondary Info) */}
        {poolInfo && (
          <div className="mt-12 pt-8 border-t border-white/20">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Your Stake */}
              {wallets.length > 0 && poolInfo.userBalance && BigInt(poolInfo.userBalance) > BigInt(0) && (
                <div className="bg-white/10 backdrop-blur-md rounded-xl border border-white/20 p-6">
                  <h3 className="text-lg font-semibold text-zinc-900 mb-4">Your Stake</h3>
                  <p className="text-3xl font-bold text-zinc-900">
                    {ethers.formatUnits(poolInfo.userBalance, poolInfo.decimals)}
                  </p>
                  <p className="text-sm text-zinc-500 mt-1">FXRP</p>
                </div>
              )}

              {/* Pool Details */}
              <div className="bg-white/10 backdrop-blur-md rounded-xl border border-white/20 p-6">
                <h3 className="text-lg font-semibold text-zinc-900 mb-4">Pool Details</h3>
                <div className="space-y-2 text-sm">
                  <div>
                    <p className="text-zinc-600 mb-1">Pool Address</p>
                    <p className="text-zinc-900 font-mono text-xs break-all">
                      {poolInfo.poolAddress}
                    </p>
                  </div>
                  <div>
                    <p className="text-zinc-600 mb-1">FXRP Token Address</p>
                    <p className="text-zinc-900 font-mono text-xs break-all">
                      {poolInfo.fxrpAddress}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
