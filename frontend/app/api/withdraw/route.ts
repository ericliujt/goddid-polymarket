import { NextRequest, NextResponse } from 'next/server';
import { PrivyClient } from '@privy-io/node';
import { ethers } from 'ethers';

// Coston2 testnet configuration
const COSTON2_CHAIN_ID = 114;
const COSTON2_RPC_URL = 'https://coston2-api.flare.network/ext/C/rpc';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, walletAddress, recipientAddress, signerId } = body;

    // Validate inputs
    if (!userId || !walletAddress || !recipientAddress || !signerId) {
      return NextResponse.json(
        { error: 'Missing required parameters: userId, walletAddress, recipientAddress, or signerId' },
        { status: 400 }
      );
    }

    if (!ethers.isAddress(walletAddress) || !ethers.isAddress(recipientAddress)) {
      return NextResponse.json(
        { error: 'Invalid Ethereum address' },
        { status: 400 }
      );
    }

    // Get environment variables
    // For server-side API routes, we need regular env vars (not NEXT_PUBLIC_)
    // But we can also fall back to NEXT_PUBLIC_ if needed
    const appId = process.env.PRIVY_APP_ID || process.env.NEXT_PUBLIC_PRIVY_APP_ID;
    const appSecret = process.env.PRIVY_APP_SECRET;
    const walletAuthPrivateKey = process.env.PRIVY_WALLET_AUTH_PRIVATE_KEY;

    if (!appId || !appSecret || !walletAuthPrivateKey) {
      console.error('Missing Privy configuration:', {
        hasAppId: !!appId,
        hasAppSecret: !!appSecret,
        hasWalletAuthKey: !!walletAuthPrivateKey,
      });
      return NextResponse.json(
        { error: 'Missing Privy configuration. Please check your environment variables. Required: PRIVY_APP_ID (or NEXT_PUBLIC_PRIVY_APP_ID), PRIVY_APP_SECRET, PRIVY_WALLET_AUTH_PRIVATE_KEY' },
        { status: 500 }
      );
    }

    // Format the private key: strip prefix
    // Privy SDK expects the raw private key string (without wallet-auth: prefix)
    // The SDK will handle the key format internally
    let signingKey = walletAuthPrivateKey;
    if (signingKey.startsWith('wallet-auth:')) {
      signingKey = signingKey.replace('wallet-auth:', '');
    }
    // Note: Privy SDK may expect PEM format or raw format depending on the key type
    // Try without PEM headers first, as the SDK documentation shows raw keys
    // If that doesn't work, we can try with PEM headers

    // Initialize Privy client
    // Note: The walletAuthPrivateKey will be used in the authorization context
    const privy = new PrivyClient({
      appId,
      appSecret,
    });

    // Get the user by their ID (DID)
    let user;
    try {
      user = await privy.users()._get(userId);
    } catch (error: any) {
      return NextResponse.json(
        { error: `Could not find user: ${error.message}` },
        { status: 400 }
      );
    }

    // Find the wallet in the user's linked accounts
    const walletAccount = user.linked_accounts?.find(
      (account: any) => 
        account.type === 'wallet' && 
        account.address?.toLowerCase() === walletAddress.toLowerCase()
    );

    if (!walletAccount) {
      return NextResponse.json(
        { error: `Wallet ${walletAddress} not found in user's linked accounts` },
        { status: 400 }
      );
    }

    // Get the wallet details using the wallet ID
    // The walletAccount should have an id or wallet_id property
    const walletId = (walletAccount as any).id || (walletAccount as any).wallet_id;
    if (!walletId) {
      return NextResponse.json(
        { error: 'Could not find wallet ID in linked account' },
        { status: 400 }
      );
    }

    let wallet;
    try {
      wallet = await privy.wallets().get(walletId);
    } catch (error: any) {
      return NextResponse.json(
        { error: `Could not get wallet details: ${error.message}` },
        { status: 400 }
      );
    }

    // Debug: Log wallet structure to understand the format
    console.log('Wallet structure:', {
      id: wallet.id,
      address: wallet.address,
      owner_id: (wallet as any).owner_id,
      additional_signers: (wallet as any).additional_signers,
      signerId: signerId,
    });

    // Check if wallet has the session signer
    // The wallet should have additional_signers array with the matching signer_id
    const additionalSigners = (wallet as any).additional_signers || [];
    const hasSessionSigner = additionalSigners.some((s: any) => 
      s.signer_id === signerId || s.id === signerId
    );

    if (!hasSessionSigner) {
      console.error('Session signer check failed:', {
        additional_signers: additionalSigners,
        lookingFor: signerId,
        hasSigners: additionalSigners.length > 0,
        signerCount: additionalSigners.length,
      });
      
      return NextResponse.json(
        { 
          error: 'Wallet does not have the specified session signer. Please add the session signer first.',
          debug: {
            signerCount: additionalSigners.length,
            signers: additionalSigners.map((s: any) => s.signer_id || s.id) || [],
            lookingFor: signerId,
          }
        },
        { status: 400 }
      );
    }

    console.log('Session signer found! Proceeding with transaction...');

    // Create provider for Coston2 to check balance
    const provider = new ethers.JsonRpcProvider(COSTON2_RPC_URL);

    // Get wallet balance
    const balance = await provider.getBalance(walletAddress);
    const oneFlr = ethers.parseEther('1');

    if (balance < oneFlr) {
      return NextResponse.json(
        { error: `Insufficient balance. Wallet has ${ethers.formatEther(balance)} FLR, but needs 1 FLR.` },
        { status: 400 }
      );
    }

    // Get fee data
    const feeData = await provider.getFeeData();
    
    // Build the transaction according to Privy API format
    // Value should be in hex format, chain_id should be in the transaction object
    const transaction = {
      to: recipientAddress,
      value: `0x${oneFlr.toString(16)}`, // Convert to hex string
      chain_id: COSTON2_CHAIN_ID,
      gas_limit: '0x5208', // 21000 in hex
      gas_price: feeData.gasPrice ? `0x${feeData.gasPrice.toString(16)}` : '0x3b9aca00', // 1 Gwei in hex
    };

    // Build authorization context with the formatted private key
    // According to Privy docs: authorization_private_keys should contain the private key string
    const authorizationContext = {
      authorization_private_keys: [signingKey],
    };

    // Send the transaction using the session signer
    // The Privy Node.js SDK will use the session signer to sign and send
    // authorization_context is passed in the options object
    const result = await privy.wallets().ethereum().sendTransaction(
      wallet.id,
      {
        caip2: `eip155:${COSTON2_CHAIN_ID}`, // Coston2 chain ID
        params: {
          transaction,
        },
        authorization_context: authorizationContext,
      }
    );

    // Wait for confirmation
    const receipt = await provider.waitForTransaction(result.hash, 1);

    return NextResponse.json({
      success: true,
      txHash: result.hash,
      blockNumber: receipt?.blockNumber,
      explorerUrl: `https://coston2-explorer.flare.network/tx/${result.hash}`,
    });

  } catch (error: any) {
    console.error('Error in withdraw API:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to process withdrawal' },
      { status: 500 }
    );
  }
}

