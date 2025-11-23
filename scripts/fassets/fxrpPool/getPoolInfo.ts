import { web3 } from "hardhat";
import { formatUnits } from "ethers";
import { FXRPoolInstance, ERC20Instance } from "../../../typechain-types";
import { getAssetManagerFXRP } from "../../utils/getters";

// yarn hardhat run scripts/fassets/fxrpPool/getPoolInfo.ts --network coston2

// Configuration - Update these values
const POOL_ADDRESS = process.env.FXRP_POOL_ADDRESS || ""; // Set via environment variable or update here
const USER_ADDRESS = process.env.USER_ADDRESS || ""; // Optional: specific user address to check

const FXRPool = artifacts.require("FXRPool");
const IERC20 = artifacts.require("IERC20");

async function main() {
    if (!POOL_ADDRESS) {
        throw new Error("Please set FXRP_POOL_ADDRESS environment variable or update POOL_ADDRESS in the script");
    }

    console.log("=== FXRPool Information ===\n");
    console.log("Pool Address:", POOL_ADDRESS);

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

    // Get pool balance
    const poolBalance = await pool.getPoolBalance();
    console.log("\n=== Pool Balance ===");
    console.log("Total Pool Balance:", formatUnits(poolBalance.toString(), Number(decimals)), "FXRP");
    console.log("Total Pool Balance (raw):", poolBalance.toString());

    // Get actual FXRP balance in pool contract
    const actualBalance = await fxrp.balanceOf(POOL_ADDRESS);
    console.log("Actual FXRP in Contract:", formatUnits(actualBalance.toString(), Number(decimals)), "FXRP");
    console.log("Actual FXRP in Contract (raw):", actualBalance.toString());

    // Verify pool balance matches actual balance
    if (poolBalance.toString() !== actualBalance.toString()) {
        console.log("\n⚠️  WARNING: Pool balance tracking doesn't match actual balance!");
    } else {
        console.log("\n✓ Pool balance tracking matches actual balance");
    }

    // Get pool owner
    const owner = await pool.owner();
    console.log("\n=== Pool Owner ===");
    console.log("Owner Address:", owner);

    // Get current user address if not specified
    const accounts = await web3.eth.getAccounts();
    const userAddress = USER_ADDRESS || accounts[0];

    // Get user's deposit balance
    const userDepositBalance = await pool.getUserBalance(userAddress);
    console.log("\n=== User Information ===");
    console.log("User Address:", userAddress);
    console.log("User Deposit Balance:", formatUnits(userDepositBalance.toString(), Number(decimals)), "FXRP");
    console.log("User Deposit Balance (raw):", userDepositBalance.toString());

    // Get user's actual FXRP balance
    const userFXRPBalance = await fxrp.balanceOf(userAddress);
    console.log("User FXRP Balance:", formatUnits(userFXRPBalance.toString(), Number(decimals)), "FXRP");

    // Get user's allowance for pool
    const userAllowance = await fxrp.allowance(userAddress, POOL_ADDRESS);
    console.log("User Allowance for Pool:", formatUnits(userAllowance.toString(), Number(decimals)), "FXRP");

    console.log("\n=== Pool Info Complete ===");
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
