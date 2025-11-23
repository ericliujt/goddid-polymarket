import { web3 } from "hardhat";
import { formatUnits } from "ethers";
import { FXRPoolInstance, ERC20Instance } from "../../../typechain-types";
import { getAssetManagerFXRP } from "../../utils/getters";

// yarn hardhat run scripts/fassets/fxrpPool/deposit.ts --network coston2

// Configuration - Update these values
const POOL_ADDRESS = process.env.FXRP_POOL_ADDRESS || ""; // Set via environment variable or update here
const DEPOSIT_AMOUNT = process.env.DEPOSIT_AMOUNT || "100"; // Amount in FXRP (will be converted to token units)

const FXRPool = artifacts.require("FXRPool");
const IERC20 = artifacts.require("IERC20");

async function main() {
    if (!POOL_ADDRESS) {
        throw new Error("Please set FXRP_POOL_ADDRESS environment variable or update POOL_ADDRESS in the script");
    }

    console.log("=== Depositing FXRP into Pool ===\n");
    console.log("Pool Address:", POOL_ADDRESS);
    console.log("Deposit Amount:", DEPOSIT_AMOUNT, "FXRP\n");

    // Get pool contract instance
    const pool: FXRPoolInstance = await FXRPool.at(POOL_ADDRESS);

    // Get FXRP token address
    const fxrpAddress = await pool.getFXRPAddress();
    console.log("FXRP Token Address:", fxrpAddress);

    // Get FXRP token instance
    const fxrp: ERC20Instance = await IERC20.at(fxrpAddress);

    // Get token decimals from AssetManager
    const assetManager = await getAssetManagerFXRP();
    const decimals = await assetManager.assetMintingDecimals();
    console.log("Token Decimals:", decimals.toString());

    // Convert deposit amount to token units
    const depositAmountWei = web3.utils.toBN(web3.utils.toWei(DEPOSIT_AMOUNT, "ether"));
    const depositAmount = depositAmountWei.div(web3.utils.toBN(10).pow(web3.utils.toBN(18 - Number(decimals))));

    console.log("Deposit Amount (token units):", depositAmount.toString());

    // Get user address from environment variable or use first account from hardhat config
    const accounts = await web3.eth.getAccounts();
    const userAddress = process.env.USER_ADDRESS || accounts[0];
    console.log("User Address:", userAddress);
    const userBalance = await fxrp.balanceOf(userAddress);
    console.log("User FXRP Balance:", formatUnits(userBalance.toString(), Number(decimals)), "FXRP");

    // Check if user has enough balance
    if (userBalance.lt(depositAmount)) {
        throw new Error(
            `Insufficient FXRP balance. Required: ${formatUnits(depositAmount.toString(), Number(decimals))} FXRP, Have: ${formatUnits(userBalance.toString(), Number(decimals))} FXRP`
        );
    }

    // Check current allowance
    const currentAllowance = await fxrp.allowance(userAddress, POOL_ADDRESS);
    console.log("Current Allowance:", formatUnits(currentAllowance.toString(), Number(decimals)), "FXRP");

    // Approve if needed
    if (currentAllowance.lt(depositAmount)) {
        console.log("\nApproving FXRP for pool...");
        const approveTx = await fxrp.approve(POOL_ADDRESS, depositAmount);
        console.log("Approval transaction:", approveTx.tx);
        console.log("Waiting for approval confirmation...");
    } else {
        console.log("Sufficient allowance already set");
    }

    // Get pool balance before deposit
    const poolBalanceBefore = await pool.getPoolBalance();
    console.log("\nPool Balance (before):", formatUnits(poolBalanceBefore.toString(), Number(decimals)), "FXRP");

    // Deposit FXRP into pool
    console.log("\nDepositing FXRP into pool...");
    const depositTx = await pool.deposit(depositAmount);
    console.log("Deposit transaction:", depositTx.tx);

    // Get pool balance after deposit
    const poolBalanceAfter = await pool.getPoolBalance();
    console.log("Pool Balance (after):", formatUnits(poolBalanceAfter.toString(), Number(decimals)), "FXRP");

    // Get user's deposit balance
    const userDepositBalance = await pool.getUserBalance(userAddress);
    console.log("User Deposit Balance:", formatUnits(userDepositBalance.toString(), Number(decimals)), "FXRP");

    console.log("\n=== Deposit Complete ===");
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
