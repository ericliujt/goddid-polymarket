# FXRPool Scripts

This directory contains scripts for managing an FXRP pool contract that allows depositing, withdrawing, and transferring FXRP tokens.

## Overview

The FXRPool contract provides:
- **Deposit**: Users can deposit FXRP into the pool
- **Withdraw**: Users can withdraw their deposited FXRP
- **Transfer**: Pool owner can transfer FXRP to any wallet address
- **Batch Transfer**: Pool owner can transfer FXRP to multiple addresses in one transaction

## Prerequisites

1. Deploy the FXRPool contract first using `deployPool.ts`
2. Have FXRP tokens in your wallet for deposits
3. Set the `FXRP_POOL_ADDRESS` environment variable after deployment

## Quick Start

### 1. Deploy the Pool

```bash
npx hardhat run scripts/fassets/fxrpPool/deployPool.ts --network coston2
```

**Output:** Save the pool address (e.g., `0x30d9B6F5d78692eE2ebDd57a3EF534D6A8EAefc2`)

### 2. Set Pool Address

```bash
export FXRP_POOL_ADDRESS="0x30d9B6F5d78692eE2ebDd57a3EF534D6A8EAefc2"
```

### 3. Deposit FXRP

```bash
export DEPOSIT_AMOUNT="100"  # Amount in FXRP
npx hardhat run scripts/fassets/fxrpPool/deposit.ts --network coston2
```

### 4. View Pool Information

```bash
npx hardhat run scripts/fassets/fxrpPool/getPoolInfo.ts --network coston2
```

### 5. Withdraw FXRP

```bash
export WITHDRAW_AMOUNT="50"  # Amount in FXRP
npx hardhat run scripts/fassets/fxrpPool/withdraw.ts --network coston2
```

## Scripts

### 1. Deploy Pool (`deployPool.ts`)

Deploys the FXRPool contract and gets the FXRP token address.

```bash
npx hardhat run scripts/fassets/fxrpPool/deployPool.ts --network coston2
```

**Output:**
- Pool contract address
- FXRP token address
- Verification status

**Next Steps:**
- Save the pool address as `FXRP_POOL_ADDRESS` environment variable
- Approve FXRP tokens to the pool address
- Use deposit script to add FXRP to the pool

---

### 2. Deposit FXRP (`deposit.ts`)

Deposits FXRP tokens into the pool.

**How to Call:**
```bash
# Step 1: Set the pool address (required)
export FXRP_POOL_ADDRESS="0x30d9B6F5d78692eE2ebDd57a3EF534D6A8EAefc2"

# Step 2: Set the deposit amount (optional, default: "100")
export DEPOSIT_AMOUNT="100"  # Amount in FXRP

# Step 3: Run the deposit script
npx hardhat run scripts/fassets/fxrpPool/deposit.ts --network coston2
```

**Environment Variables:**
- `FXRP_POOL_ADDRESS`: Address of the deployed pool contract (required)
- `DEPOSIT_AMOUNT`: Amount of FXRP to deposit (default: "100")

**What it does:**
1. Checks user's FXRP balance
2. Approves pool contract to spend FXRP (if needed)
3. Deposits FXRP into the pool
4. Updates user's deposit balance tracking
5. Shows pool balance before and after

**Example Output:**
```
=== Depositing FXRP into Pool ===
Pool Address: 0x30d9B6F5d78692eE2ebDd57a3EF534D6A8EAefc2
Deposit Amount: 100 FXRP
User FXRP Balance: 50.0 FXRP
Pool Balance (before): 0.0 FXRP
Depositing FXRP into pool...
Pool Balance (after): 100.0 FXRP
User Deposit Balance: 100.0 FXRP
=== Deposit Complete ===
```

---

### 3. Withdraw FXRP (`withdraw.ts`)

Withdraws FXRP tokens from the pool (users can only withdraw their deposited amount).

**How to Call:**
```bash
# Step 1: Set the pool address (required)
export FXRP_POOL_ADDRESS="0x30d9B6F5d78692eE2ebDd57a3EF534D6A8EAefc2"

# Step 2: Set the withdraw amount (optional, default: "50")
export WITHDRAW_AMOUNT="50"  # Amount in FXRP

# Step 3: Run the withdraw script
npx hardhat run scripts/fassets/fxrpPool/withdraw.ts --network coston2
```

**Environment Variables:**
- `FXRP_POOL_ADDRESS`: Address of the deployed pool contract (required)
- `WITHDRAW_AMOUNT`: Amount of FXRP to withdraw (default: "50")

**What it does:**
1. Checks user's deposit balance
2. Verifies sufficient balance
3. Withdraws FXRP from pool to user's wallet
4. Updates user's deposit balance tracking
5. Shows balances before and after

**Example Output:**
```
=== Withdrawing FXRP from Pool ===
Pool Address: 0x30d9B6F5d78692eE2ebDd57a3EF534D6A8EAefc2
Withdraw Amount: 50 FXRP
User Deposit Balance: 100.0 FXRP
Pool Balance (before): 100.0 FXRP
User FXRP Balance (before): 0.0 FXRP
Withdrawing FXRP from pool...
Pool Balance (after): 50.0 FXRP
User FXRP Balance (after): 50.0 FXRP
User Deposit Balance (after): 50.0 FXRP
=== Withdraw Complete ===
```

**Note:** You can only withdraw up to the amount you have deposited into the pool.

---

### 4. Transfer FXRP (`transfer.ts`)

Transfers FXRP from the pool to a recipient address (owner only).

**Single Transfer:**
```bash
# Set environment variables
export FXRP_POOL_ADDRESS="0x..."
export RECIPIENT_ADDRESS="0x..."  # Recipient wallet address
export TRANSFER_AMOUNT="25"  # Amount in FXRP

# Run script
npx hardhat run scripts/fassets/fxrpPool/transfer.ts --network coston2
```

**Batch Transfer:**
```bash
# Set environment variables
export FXRP_POOL_ADDRESS="0x..."
export RECIPIENT_ADDRESSES="0x...,0x...,0x..."  # Comma-separated addresses
export TRANSFER_AMOUNTS="10,20,30"  # Comma-separated amounts (must match addresses)

# Run script
npx hardhat run scripts/fassets/fxrpPool/transfer.ts --network coston2
```

**Environment Variables:**
- `FXRP_POOL_ADDRESS`: Address of the deployed pool contract (required)
- `RECIPIENT_ADDRESS`: Single recipient address (for single transfer)
- `TRANSFER_AMOUNT`: Amount to transfer (for single transfer)
- `RECIPIENT_ADDRESSES`: Comma-separated recipient addresses (for batch transfer)
- `TRANSFER_AMOUNTS`: Comma-separated amounts (for batch transfer, must match addresses length)

**What it does:**
1. Checks pool balance
2. Transfers FXRP from pool to recipient(s)
3. Updates pool balance
4. Shows balances before and after

**Note:** Only the pool owner can execute transfers.

---

### 5. Get Pool Info (`getPoolInfo.ts`)

Displays comprehensive information about the pool, including current balance and user information.

**How to Call:**
```bash
# Step 1: Set the pool address (required)
export FXRP_POOL_ADDRESS="0x30d9B6F5d78692eE2ebDd57a3EF534D6A8EAefc2"

# Step 2: Optionally set a specific user address to check
export USER_ADDRESS="0x..."  # Optional: defaults to first account

# Step 3: Run the getPoolInfo script
npx hardhat run scripts/fassets/fxrpPool/getPoolInfo.ts --network coston2
```

**Environment Variables:**
- `FXRP_POOL_ADDRESS`: Address of the deployed pool contract (required)
- `USER_ADDRESS`: Optional user address to check (defaults to first account)

**What it shows:**
- Pool contract address
- FXRP token address
- **Total pool balance** (how much FXRP is in the pool)
- Actual FXRP balance in contract (verification)
- Pool owner address
- **User deposit balance** (how much you've deposited)
- User FXRP balance (your wallet balance)
- User allowance for pool

**Example Output:**
```
=== FXRPool Information ===
Pool Address: 0x30d9B6F5d78692eE2ebDd57a3EF534D6A8EAefc2
FXRP Token Address: 0x0b6A3645c240605887a5532109323A3E12273dc7

=== Pool Balance ===
Total Pool Balance: 100.0 FXRP
Actual FXRP in Contract: 100.0 FXRP
✓ Pool balance tracking matches actual balance

=== Pool Owner ===
Owner Address: 0x...

=== User Information ===
User Address: 0x...
User Deposit Balance: 100.0 FXRP
User FXRP Balance: 50.0 FXRP
User Allowance for Pool: 0.0 FXRP

=== Pool Info Complete ===
```

**Use this script to:**
- Check how much FXRP is currently in the pool
- See your deposit balance
- Verify pool balance matches actual token balance
- Check if you need to approve more FXRP for deposits

---

### 6. Get Pool History (`getPoolHistory.ts`)

Displays transaction history of the pool (deposits, withdrawals, transfers).

```bash
# Set environment variables
export FXRP_POOL_ADDRESS="0x..."
export USER_ADDRESS="0x..."  # Optional: specific user to check

# Run script
npx hardhat run scripts/fassets/fxrpPool/getPoolInfo.ts --network coston2
```

**Environment Variables:**
- `FXRP_POOL_ADDRESS`: Address of the deployed pool contract (required)
- `USER_ADDRESS`: Optional user address to check (defaults to first account)

**What it shows:**
- Pool contract address
- FXRP token address
- Total pool balance
- Actual FXRP balance in contract
- Pool owner address
- User deposit balance
- User FXRP balance
- User allowance for pool

---

## Usage Examples

### Complete Workflow

1. **Deploy the pool:**
   ```bash
   npx hardhat run scripts/fassets/fxrpPool/deployPool.ts --network coston2
   # Save the pool address: 0x1234...
   ```

2. **Set environment variable:**
   ```bash
   export FXRP_POOL_ADDRESS="0x1234..."
   ```

3. **Deposit FXRP:**
   ```bash
   export DEPOSIT_AMOUNT="100"
   npx hardhat run scripts/fassets/fxrpPool/deposit.ts --network coston2
   ```

4. **Check pool info:**
   ```bash
   npx hardhat run scripts/fassets/fxrpPool/getPoolInfo.ts --network coston2
   ```

5. **Transfer FXRP to recipient:**
   ```bash
   export RECIPIENT_ADDRESS="0x5678..."
   export TRANSFER_AMOUNT="25"
   npx hardhat run scripts/fassets/fxrpPool/transfer.ts --network coston2
   ```

6. **Withdraw FXRP:**
   ```bash
   export WITHDRAW_AMOUNT="50"
   npx hardhat run scripts/fassets/fxrpPool/withdraw.ts --network coston2
   ```

---

## Security Notes

- Only the pool owner can transfer FXRP to other addresses
- Users can only withdraw their own deposited amounts
- The contract uses ReentrancyGuard for security
- Pool balance is tracked separately from actual token balance for verification

## Troubleshooting

**Error: "Please set FXRP_POOL_ADDRESS"**
- Set the environment variable: `export FXRP_POOL_ADDRESS="0x..."`

**Error: "Insufficient balance"**
- Check your FXRP balance or deposit balance
- Verify the pool has enough FXRP for transfers

**Error: "Transfer failed"**
- Ensure you've approved the pool contract to spend your FXRP
- Check that the pool has sufficient balance

**Error: "Only owner can execute"**
- Transfer operations require the pool owner account
- Deploy the pool with the account you want to use as owner

