import { run } from "hardhat";
import { FXRPoolInstance } from "../../../typechain-types";

// yarn hardhat run scripts/fassets/fxrpPool/deployPool.ts --network coston2

const FXRPool = artifacts.require("FXRPool");

async function main() {
    console.log("=== Deploying FXRPool Contract ===\n");

    // Deploy the FXRPool contract
    const fxrPool: FXRPoolInstance = await FXRPool.new();

    const poolAddress = fxrPool.address;
    console.log("FXRPool deployed to:", poolAddress);

    // Get FXRP token address from the pool
    const fxrpAddress = await fxrPool.getFXRPAddress();
    console.log("FXRP token address:", fxrpAddress);

    // Verify contract on explorer
    try {
        await run("verify:verify", {
            address: poolAddress,
            constructorArguments: [],
        });
        console.log("Contract verified successfully");
    } catch (e: any) {
        console.log("Verification error (may already be verified):", e.message);
    }

    console.log("\n=== Deployment Complete ===");
    console.log("Pool Address:", poolAddress);
    console.log("FXRP Address:", fxrpAddress);
    console.log("\nNext steps:");
    console.log("1. Approve FXRP tokens to the pool address");
    console.log("2. Use deposit.ts to deposit FXRP into the pool");
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
