import { web3 } from "hardhat";
import { formatUnits } from "ethers";
import { FXRPoolInstance, ERC20Instance } from "../../../typechain-types";
import { getAssetManagerFXRP } from "../../utils/getters";

// yarn hardhat run scripts/fassets/fxrpPool/transfer.ts --network coston2

// Configuration - Update these values
const POOL_ADDRESS = process.env.FXRP_POOL_ADDRESS || ""; // Set via environment variable or update here
const RECIPIENT_ADDRESS = process.env.RECIPIENT_ADDRESS || ""; // Recipient wallet address
const TRANSFER_AMOUNT = process.env.TRANSFER_AMOUNT || "25"; // Amount in FXRP (will be converted to token units)

// For batch transfer, set these environment variables:
// RECIPIENT_ADDRESSES (comma-separated addresses)
// TRANSFER_AMOUNTS (comma-separated amounts)

const FXRPool = artifacts.require("FXRPool");
const IERC20 = artifacts.require("IERC20");

async function singleTransfer() {
    if (!RECIPIENT_ADDRESS) {
        throw new Error("Please set RECIPIENT_ADDRESS environment variable or update RECIPIENT_ADDRESS in the script");
    }

    console.log("=== Single Transfer ===\n");
    console.log("Pool Address:", POOL_ADDRESS);
    console.log("Recipient Address:", RECIPIENT_ADDRESS);
    console.log("Transfer Amount:", TRANSFER_AMOUNT, "FXRP\n");

    // Get pool contract instance
    const pool: FXRPoolInstance = await FXRPool.at(POOL_ADDRESS);

    // Get FXRP token address
    const fxrpAddress = await pool.getFXRPAddress();
    const fxrp: ERC20Instance = await IERC20.at(fxrpAddress);

    // Get token decimals from AssetManager
    const assetManager = await getAssetManagerFXRP();
    const decimals = await assetManager.assetMintingDecimals();

    // Convert transfer amount to token units
    const transferAmountWei = web3.utils.toBN(web3.utils.toWei(TRANSFER_AMOUNT, "ether"));
    const transferAmount = transferAmountWei.div(web3.utils.toBN(10).pow(web3.utils.toBN(18 - Number(decimals))));

    console.log("Transfer Amount (token units):", transferAmount.toString());

    // Get pool balance before transfer
    const poolBalanceBefore = await pool.getPoolBalance();
    console.log("Pool Balance (before):", formatUnits(poolBalanceBefore.toString(), Number(decimals)), "FXRP");

    // Get recipient balance before transfer
    const recipientBalanceBefore = await fxrp.balanceOf(RECIPIENT_ADDRESS);
    console.log(
        "Recipient Balance (before):",
        formatUnits(recipientBalanceBefore.toString(), Number(decimals)),
        "FXRP"
    );

    // Transfer FXRP from pool to recipient
    console.log("\nTransferring FXRP from pool to recipient...");
    const transferTx = await pool.transferTo(RECIPIENT_ADDRESS, transferAmount);
    console.log("Transfer transaction:", transferTx.tx);

    // Get pool balance after transfer
    const poolBalanceAfter = await pool.getPoolBalance();
    console.log("Pool Balance (after):", formatUnits(poolBalanceAfter.toString(), Number(decimals)), "FXRP");

    // Get recipient balance after transfer
    const recipientBalanceAfter = await fxrp.balanceOf(RECIPIENT_ADDRESS);
    console.log("Recipient Balance (after):", formatUnits(recipientBalanceAfter.toString(), Number(decimals)), "FXRP");

    console.log("\n=== Transfer Complete ===");
}

async function batchTransfer() {
    const recipientAddressesStr = process.env.RECIPIENT_ADDRESSES || "";
    const transferAmountsStr = process.env.TRANSFER_AMOUNTS || "";

    if (!recipientAddressesStr || !transferAmountsStr) {
        throw new Error(
            "For batch transfer, please set RECIPIENT_ADDRESSES and TRANSFER_AMOUNTS environment variables (comma-separated)"
        );
    }

    const recipientAddresses = recipientAddressesStr.split(",").map((addr) => addr.trim());
    const transferAmounts = transferAmountsStr.split(",").map((amt) => amt.trim());

    console.log("=== Batch Transfer ===\n");
    console.log("Pool Address:", POOL_ADDRESS);
    console.log("Number of Recipients:", recipientAddresses.length);
    console.log("Recipients:", recipientAddresses);
    console.log("Amounts:", transferAmounts, "FXRP\n");

    // Get pool contract instance
    const pool: FXRPoolInstance = await FXRPool.at(POOL_ADDRESS);

    // Get FXRP token address
    const fxrpAddress = await pool.getFXRPAddress();
    const fxrp: ERC20Instance = await IERC20.at(fxrpAddress);

    // Get token decimals from AssetManager
    const assetManager = await getAssetManagerFXRP();
    const decimals = await assetManager.assetMintingDecimals();

    // Convert amounts to token units
    const transferAmountsBN = transferAmounts.map((amount) => {
        const amountWei = web3.utils.toBN(web3.utils.toWei(amount, "ether"));
        return amountWei.div(web3.utils.toBN(10).pow(web3.utils.toBN(18 - Number(decimals))));
    });

    console.log(
        "Transfer Amounts (token units):",
        transferAmountsBN.map((a) => a.toString())
    );

    // Get pool balance before transfer
    const poolBalanceBefore = await pool.getPoolBalance();
    console.log("Pool Balance (before):", formatUnits(poolBalanceBefore.toString(), Number(decimals)), "FXRP");

    // Get recipient balances before transfer
    console.log("\nRecipient Balances (before):");
    for (let i = 0; i < recipientAddresses.length; i++) {
        const balance = await fxrp.balanceOf(recipientAddresses[i]);
        console.log(`  ${recipientAddresses[i]}: ${formatUnits(balance.toString(), Number(decimals))} FXRP`);
    }

    // Batch transfer FXRP from pool to recipients
    console.log("\nTransferring FXRP from pool to recipients...");
    const batchTransferTx = await pool.batchTransfer(recipientAddresses, transferAmountsBN);
    console.log("Batch transfer transaction:", batchTransferTx.tx);

    // Get pool balance after transfer
    const poolBalanceAfter = await pool.getPoolBalance();
    console.log("Pool Balance (after):", formatUnits(poolBalanceAfter.toString(), Number(decimals)), "FXRP");

    // Get recipient balances after transfer
    console.log("\nRecipient Balances (after):");
    for (let i = 0; i < recipientAddresses.length; i++) {
        const balance = await fxrp.balanceOf(recipientAddresses[i]);
        console.log(`  ${recipientAddresses[i]}: ${formatUnits(balance.toString(), Number(decimals))} FXRP`);
    }

    console.log("\n=== Batch Transfer Complete ===");
}

async function main() {
    if (!POOL_ADDRESS) {
        throw new Error("Please set FXRP_POOL_ADDRESS environment variable or update POOL_ADDRESS in the script");
    }

    // Check if batch transfer is requested
    const isBatchTransfer = process.env.RECIPIENT_ADDRESSES && process.env.TRANSFER_AMOUNTS;

    if (isBatchTransfer) {
        await batchTransfer();
    } else {
        await singleTransfer();
    }
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
