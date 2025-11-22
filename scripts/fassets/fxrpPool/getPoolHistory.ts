import { web3 } from "hardhat";
import { formatUnits } from "ethers";
import { FXRPoolInstance } from "../../../typechain-types";
import { getAssetManagerFXRP } from "../../utils/getters";

// yarn hardhat run scripts/fassets/fxrpPool/getPoolHistory.ts --network coston2

// Configuration - Update these values
const POOL_ADDRESS = process.env.FXRP_POOL_ADDRESS || ""; // Set via environment variable or update here
const FROM_BLOCK = process.env.FROM_BLOCK || "0"; // Starting block number (0 = from contract creation)
const TO_BLOCK = process.env.TO_BLOCK || "latest"; // Ending block number

const FXRPool = artifacts.require("FXRPool");

interface PoolEvent {
    event: string;
    blockNumber: number;
    transactionHash: string;
    user?: string;
    amount?: string;
    recipient?: string;
    timestamp?: number;
}

async function main() {
    if (!POOL_ADDRESS) {
        throw new Error("Please set FXRP_POOL_ADDRESS environment variable or update POOL_ADDRESS in the script");
    }

    console.log("=== FXRPool Transaction History ===\n");
    console.log("Pool Address:", POOL_ADDRESS);
    console.log("From Block:", FROM_BLOCK);
    console.log("To Block:", TO_BLOCK, "\n");

    // Get pool contract instance
    const pool: FXRPoolInstance = await FXRPool.at(POOL_ADDRESS);
    
    // Get FXRP token address
    const fxrpAddress = await pool.getFXRPAddress();
    
    // Get token decimals from AssetManager
    const assetManager = await getAssetManagerFXRP();
    const decimals = await assetManager.assetMintingDecimals();

    const fromBlock = FROM_BLOCK === "0" ? (await web3.eth.getBlockNumber()) - 10000 : Number(FROM_BLOCK);
    const toBlock = TO_BLOCK === "latest" ? await web3.eth.getBlockNumber() : Number(TO_BLOCK);

    console.log("Fetching events from block", fromBlock, "to", toBlock, "\n");

    const events: PoolEvent[] = [];

    // Get Deposit events
    try {
        const depositEvents = await pool.getPastEvents("Deposit", {
            fromBlock: fromBlock,
            toBlock: toBlock,
        });

        for (const event of depositEvents) {
            const block = await web3.eth.getBlock(event.blockNumber);
            events.push({
                event: "Deposit",
                blockNumber: event.blockNumber,
                transactionHash: event.transactionHash,
                user: event.returnValues.user,
                amount: formatUnits(event.returnValues.amount.toString(), Number(decimals)),
                timestamp: Number(block.timestamp),
            });
        }
    } catch (e) {
        console.log("Error fetching Deposit events:", e);
    }

    // Get Withdraw events
    try {
        const withdrawEvents = await pool.getPastEvents("Withdraw", {
            fromBlock: fromBlock,
            toBlock: toBlock,
        });

        for (const event of withdrawEvents) {
            const block = await web3.eth.getBlock(event.blockNumber);
            events.push({
                event: "Withdraw",
                blockNumber: event.blockNumber,
                transactionHash: event.transactionHash,
                user: event.returnValues.user,
                amount: formatUnits(event.returnValues.amount.toString(), Number(decimals)),
                timestamp: Number(block.timestamp),
            });
        }
    } catch (e) {
        console.log("Error fetching Withdraw events:", e);
    }

    // Get Transfer events
    try {
        const transferEvents = await pool.getPastEvents("Transfer", {
            fromBlock: fromBlock,
            toBlock: toBlock,
        });

        for (const event of transferEvents) {
            const block = await web3.eth.getBlock(event.blockNumber);
            events.push({
                event: "Transfer",
                blockNumber: event.blockNumber,
                transactionHash: event.transactionHash,
                user: event.returnValues.from,
                recipient: event.returnValues.to,
                amount: formatUnits(event.returnValues.amount.toString(), Number(decimals)),
                timestamp: Number(block.timestamp),
            });
        }
    } catch (e) {
        console.log("Error fetching Transfer events:", e);
    }

    // Get BatchTransfer events
    try {
        const batchTransferEvents = await pool.getPastEvents("BatchTransfer", {
            fromBlock: fromBlock,
            toBlock: toBlock,
        });

        for (const event of batchTransferEvents) {
            const block = await web3.eth.getBlock(event.blockNumber);
            const recipients = event.returnValues.recipients || [];
            const amounts = event.returnValues.amounts || [];
            
            for (let i = 0; i < recipients.length; i++) {
                events.push({
                    event: "BatchTransfer",
                    blockNumber: event.blockNumber,
                    transactionHash: event.transactionHash,
                    user: event.returnValues.from,
                    recipient: recipients[i],
                    amount: formatUnits(amounts[i].toString(), Number(decimals)),
                    timestamp: Number(block.timestamp),
                });
            }
        }
    } catch (e) {
        console.log("Error fetching BatchTransfer events:", e);
    }

    // Sort events by block number (oldest first)
    events.sort((a, b) => a.blockNumber - b.blockNumber);

    // Display events
    if (events.length === 0) {
        console.log("No events found in the specified block range.\n");
    } else {
        console.log(`Found ${events.length} event(s):\n`);
        console.log("=".repeat(100));
        
        for (const evt of events) {
            const date = new Date(evt.timestamp! * 1000).toISOString();
            console.log(`\nEvent: ${evt.event}`);
            console.log(`Block: ${evt.blockNumber}`);
            console.log(`Transaction: ${evt.transactionHash}`);
            console.log(`Time: ${date}`);
            
            if (evt.event === "Deposit") {
                console.log(`User: ${evt.user}`);
                console.log(`Amount: ${evt.amount} FXRP`);
            } else if (evt.event === "Withdraw") {
                console.log(`User: ${evt.user}`);
                console.log(`Amount: ${evt.amount} FXRP`);
            } else if (evt.event === "Transfer") {
                console.log(`From: ${evt.user}`);
                console.log(`To: ${evt.recipient}`);
                console.log(`Amount: ${evt.amount} FXRP`);
            } else if (evt.event === "BatchTransfer") {
                console.log(`From: ${evt.user}`);
                console.log(`To: ${evt.recipient}`);
                console.log(`Amount: ${evt.amount} FXRP`);
            }
            console.log("-".repeat(100));
        }
    }

    // Summary statistics
    const deposits = events.filter(e => e.event === "Deposit");
    const withdrawals = events.filter(e => e.event === "Withdraw");
    const transfers = events.filter(e => e.event === "Transfer" || e.event === "BatchTransfer");
    
    const totalDeposited = deposits.reduce((sum, e) => sum + parseFloat(e.amount || "0"), 0);
    const totalWithdrawn = withdrawals.reduce((sum, e) => sum + parseFloat(e.amount || "0"), 0);
    const totalTransferred = transfers.reduce((sum, e) => sum + parseFloat(e.amount || "0"), 0);

    console.log("\n=== Summary Statistics ===");
    console.log(`Total Deposits: ${deposits.length} (${totalDeposited.toFixed(6)} FXRP)`);
    console.log(`Total Withdrawals: ${withdrawals.length} (${totalWithdrawn.toFixed(6)} FXRP)`);
    console.log(`Total Transfers: ${transfers.length} (${totalTransferred.toFixed(6)} FXRP)`);
    console.log(`Net Deposited: ${(totalDeposited - totalWithdrawn).toFixed(6)} FXRP`);
    console.log("\n=== History Complete ===");
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});

