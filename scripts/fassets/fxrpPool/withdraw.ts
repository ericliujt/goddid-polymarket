import { web3 } from "hardhat";
import { formatUnits } from "ethers";
import { FXRPoolInstance, ERC20Instance } from "../../../typechain-types";
import { getAssetManagerFXRP } from "../../utils/getters";

// yarn hardhat run scripts/fassets/fxrpPool/withdraw.ts --network coston2

// Configuration - Update these values
const POOL_ADDRESS = process.env.FXRP_POOL_ADDRESS || ""; // Set via environment variable or update here
const WITHDRAW_AMOUNT = process.env.WITHDRAW_AMOUNT || "50"; // Amount in FXRP (will be converted to token units)

const FXRPool = artifacts.require("FXRPool");
const IERC20 = artifacts.require("IERC20");

async function main() {
    if (!POOL_ADDRESS) {
        throw new Error("Please set FXRP_POOL_ADDRESS environment variable or update POOL_ADDRESS in the script");
    }

    console.log("=== Withdrawing FXRP from Pool ===\n");
    console.log("Pool Address:", POOL_ADDRESS);
    console.log("Withdraw Amount:", WITHDRAW_AMOUNT, "FXRP\n");

    // Get pool contract instance
    const pool: FXRPoolInstance = await FXRPool.at(POOL_ADDRESS);

    // Get FXRP token address
    const fxrpAddress = await pool.getFXRPAddress();
    const fxrp: ERC20Instance = await IERC20.at(fxrpAddress);

    // Get token decimals from AssetManager
    const assetManager = await getAssetManagerFXRP();
    const decimals = await assetManager.assetMintingDecimals();

    // Convert withdraw amount to token units
    const withdrawAmountWei = web3.utils.toBN(web3.utils.toWei(WITHDRAW_AMOUNT, "ether"));
    const withdrawAmount = withdrawAmountWei.div(web3.utils.toBN(10).pow(web3.utils.toBN(18 - Number(decimals))));

    console.log("Withdraw Amount (token units):", withdrawAmount.toString());

    // Get user address from environment variable or use first account from hardhat config
    const accounts = await web3.eth.getAccounts();
    const userAddress = process.env.USER_ADDRESS || accounts[0];
    console.log("User Address:", userAddress);

    // Get user's deposit balance
    const userDepositBalance = await pool.getUserBalance(userAddress);
    console.log("User Deposit Balance:", formatUnits(userDepositBalance.toString(), Number(decimals)), "FXRP");

    // Check if user has enough balance
    if (userDepositBalance.lt(withdrawAmount)) {
        throw new Error(
            `Insufficient deposit balance. Required: ${formatUnits(withdrawAmount.toString(), Number(decimals))} FXRP, Have: ${formatUnits(userDepositBalance.toString(), Number(decimals))} FXRP`
        );
    }

    // Get pool balance before withdraw
    const poolBalanceBefore = await pool.getPoolBalance();
    console.log("Pool Balance (before):", formatUnits(poolBalanceBefore.toString(), Number(decimals)), "FXRP");

    // Get user's FXRP balance before withdraw
    const userBalanceBefore = await fxrp.balanceOf(userAddress);
    console.log("User FXRP Balance (before):", formatUnits(userBalanceBefore.toString(), Number(decimals)), "FXRP");

    // Withdraw FXRP from pool
    console.log("\nWithdrawing FXRP from pool...");
    const withdrawTx = await pool.withdraw(withdrawAmount);
    console.log("Withdraw transaction:", withdrawTx.tx);
    console.log("Transaction Hash:", withdrawTx.tx);
    console.log(`Transaction Link: https://coston2-explorer.flare.network/tx/${withdrawTx.tx}`);

    // Get pool balance after withdraw
    const poolBalanceAfter = await pool.getPoolBalance();
    console.log("Pool Balance (after):", formatUnits(poolBalanceAfter.toString(), Number(decimals)), "FXRP");

    // Get user's FXRP balance after withdraw
    const userBalanceAfter = await fxrp.balanceOf(userAddress);
    console.log("User FXRP Balance (after):", formatUnits(userBalanceAfter.toString(), Number(decimals)), "FXRP");

    // Get user's deposit balance after withdraw
    const userDepositBalanceAfter = await pool.getUserBalance(userAddress);
    console.log(
        "User Deposit Balance (after):",
        formatUnits(userDepositBalanceAfter.toString(), Number(decimals)),
        "FXRP"
    );

    console.log("\n=== Withdraw Complete ===");
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
