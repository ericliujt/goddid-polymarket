import { run, web3, network } from "hardhat";
import { PolymarketUserDataStoreInstance } from "../../typechain-types";
import {
    prepareAttestationRequestBase,
    submitAttestationRequest,
    retrieveDataAndProofBaseWithRetry,
} from "../utils/fdc";

const PolymarketUserDataStore = artifacts.require("PolymarketUserDataStore");

const { WEB2JSON_VERIFIER_URL_TESTNET, VERIFIER_API_KEY_TESTNET, COSTON2_DA_LAYER_URL } = process.env;

// yarn hardhat run scripts/polymarket/PolymarketUserData.ts --network coston2

// Allow user address to be set via environment variable (for frontend/API usage)
const userAddress = process.env.POLYMARKET_USER_ADDRESS || "0xb1d9476e5a5ba938b57cf0a5dc7a91a114605ee1";

// API URLs (without query parameters)
const closedPositionsUrl = "https://data-api.polymarket.com/closed-positions";
const valueUrl = "https://data-api.polymarket.com/value";
const activityUrl = "https://data-api.polymarket.com/activity";
const currentPositionsUrl = "https://data-api.polymarket.com/positions";

// Query parameters
const closedPositionsQueryParams = `{"user": "${userAddress}", "limit": "10"}`;
const valueQueryParams = `{"user": "${userAddress}"}`;
const activityQueryParams = `{"user": "${userAddress}", "limit": "1"}`;
const currentPositionsQueryParams = `{"user": "${userAddress}", "limit": "3"}`;

// Simple jq queries (convert floats to integers for int256 ABI encoding)
// Extract all positions (up to 10) as an array
const closedPositionsJq = `. | map({realizedPnl: (.realizedPnl | floor), totalBought: (.totalBought | floor), asset: (.asset | tostring)}) | {positions: .}`;
const valueJq = `. | .[0] | {value: (.value | floor)}`;
const activityJq = `. | .[0] | {name: .name}`;
// Extract current positions (up to 3) with all required fields
const currentPositionsJq = `. | map({size: (.size | floor), avgPrice: (.avgPrice | floor), initialValue: (.initialValue | floor), currentValue: (.currentValue | floor), cashPnl: (.cashPnl | floor), percentPnl: (.percentPnl | floor), totalBought: (.totalBought | floor), realizedPnl: (.realizedPnl | floor), percentRealizedPnl: (.percentRealizedPnl | floor), curPrice: (.curPrice | floor)}) | {positions: .}`;

// ABI Signatures - positions is an array of tuples
const closedPositionsAbiSignature = `{"components": [{"components": [{"internalType": "int256", "name": "realizedPnl", "type": "int256"},{"internalType": "int256", "name": "totalBought", "type": "int256"},{"internalType": "string", "name": "asset", "type": "string"}],"internalType": "tuple[]", "name": "positions", "type": "tuple[]"}],"name": "task","type": "tuple"}`;
const valueAbiSignature = `{"components": [{"internalType": "int256", "name": "value", "type": "int256"}],"name": "task","type": "tuple"}`;
const activityAbiSignature = `{"components": [{"internalType": "string", "name": "name", "type": "string"}],"name": "task","type": "tuple"}`;
const currentPositionsAbiSignature = `{"components": [{"components": [{"internalType": "int256", "name": "size", "type": "int256"},{"internalType": "int256", "name": "avgPrice", "type": "int256"},{"internalType": "int256", "name": "initialValue", "type": "int256"},{"internalType": "int256", "name": "currentValue", "type": "int256"},{"internalType": "int256", "name": "cashPnl", "type": "int256"},{"internalType": "int256", "name": "percentPnl", "type": "int256"},{"internalType": "int256", "name": "totalBought", "type": "int256"},{"internalType": "int256", "name": "realizedPnl", "type": "int256"},{"internalType": "int256", "name": "percentRealizedPnl", "type": "int256"},{"internalType": "int256", "name": "curPrice", "type": "int256"}],"internalType": "tuple[]", "name": "positions", "type": "tuple[]"}],"name": "task","type": "tuple"}`;

const httpMethod = "GET";
const headers = "{}";
const body = "{}";

// Configuration constants
const attestationTypeBase = "Web2Json";
const sourceIdBase = "PublicWeb2";
const verifierUrlBase = WEB2JSON_VERIFIER_URL_TESTNET;

async function prepareAttestationRequest(
    apiUrl: string,
    queryParams: string,
    postProcessJq: string,
    abiSignature: string
) {
    const requestBody = {
        url: apiUrl,
        httpMethod: httpMethod,
        headers: headers,
        queryParams: queryParams,
        body: body,
        postProcessJq: postProcessJq,
        abiSignature: abiSignature,
    };

    const url = `${verifierUrlBase}Web2Json/prepareRequest`;
    const apiKey = VERIFIER_API_KEY_TESTNET;

    return await prepareAttestationRequestBase(url, apiKey, attestationTypeBase, sourceIdBase, requestBody);
}

async function retrieveDataAndProof(abiEncodedRequest: string, roundId: number) {
    // Ensure proper URL formatting with trailing slash
    const baseUrl = COSTON2_DA_LAYER_URL?.endsWith("/") ? COSTON2_DA_LAYER_URL : `${COSTON2_DA_LAYER_URL}/`;
    // Try v1 endpoint first, fallback to v0 if needed
    const url = `${baseUrl}api/v1/fdc/proof-by-request-round-raw`;
    console.log("DA Layer URL:", url, "\n");
    try {
        return await retrieveDataAndProofBaseWithRetry(url, abiEncodedRequest, roundId);
    } catch (_error: any) {
        // If v1 fails, try v0 endpoint (used in fassets)
        console.log("v1 endpoint failed, trying v0 endpoint...\n");
        const urlV0 = `${baseUrl}api/v0/fdc/get-proof-round-id-bytes`;
        console.log("DA Layer URL (v0):", urlV0, "\n");
        return await retrieveDataAndProofBaseWithRetry(urlV0, abiEncodedRequest, roundId);
    }
}

async function deployAndVerifyContract() {
    const args: any[] = [];
    const userDataStore: PolymarketUserDataStoreInstance = await PolymarketUserDataStore.new(...args);
    try {
        await run("verify:verify", {
            address: userDataStore.address,
            constructorArguments: args,
        });
    } catch (e: any) {
        console.log(e);
    }
    console.log("PolymarketUserDataStore deployed to", userDataStore.address, "\n");
    return userDataStore;
}

async function interactWithContract(
    userDataStore: PolymarketUserDataStoreInstance,
    closedPositionsProof: any,
    valueProof: any,
    activityProof: any,
    currentPositionsProof: any
) {
    // Decode all four proofs
    const IWeb2JsonVerification = await artifacts.require("IWeb2JsonVerification");
    const responseType = IWeb2JsonVerification._json.abi[0].inputs[0].components[1];

    const decodedClosedPositions = web3.eth.abi.decodeParameter(responseType, closedPositionsProof.response_hex);
    const decodedValue = web3.eth.abi.decodeParameter(responseType, valueProof.response_hex);
    const decodedActivity = web3.eth.abi.decodeParameter(responseType, activityProof.response_hex);
    const decodedCurrentPositions = web3.eth.abi.decodeParameter(responseType, currentPositionsProof.response_hex);

    console.log("Decoded closed positions:", decodedClosedPositions, "\n");
    console.log("Decoded value:", decodedValue, "\n");
    console.log("Decoded activity:", decodedActivity, "\n");
    console.log("Decoded current positions:", decodedCurrentPositions, "\n");

    const transaction = await userDataStore.addUserData(
        {
            merkleProof: closedPositionsProof.proof,
            data: decodedClosedPositions,
        },
        {
            merkleProof: valueProof.proof,
            data: decodedValue,
        },
        {
            merkleProof: activityProof.proof,
            data: decodedActivity,
        },
        {
            merkleProof: currentPositionsProof.proof,
            data: decodedCurrentPositions,
        }
    );
    console.log("Transaction:", transaction.tx, "\n");

    const storedData = await userDataStore.getUserData();
    const closedPositionCount = await userDataStore.getClosedPositionCount();
    const currentPositionCount = await userDataStore.getCurrentPositionCount();

    // Build comprehensive JSON output
    const output: any = {
        user: {
            name: storedData.name,
            value: storedData.value.toString(),
        },
        closedPositions: [] as any[],
        currentPositions: [] as any[],
    };

    // Add closed positions
    for (let i = 0; i < closedPositionCount.toNumber(); i++) {
        const position = await userDataStore.getClosedPosition(i);
        output.closedPositions.push({
            realizedPnl: position.realizedPnl.toString(),
            totalBought: position.totalBought.toString(),
            asset: position.asset,
        });
    }

    // Add current positions
    for (let i = 0; i < currentPositionCount.toNumber(); i++) {
        const position = await userDataStore.getCurrentPosition(i);
        output.currentPositions.push({
            size: position.size.toString(),
            avgPrice: position.avgPrice.toString(),
            initialValue: position.initialValue.toString(),
            currentValue: position.currentValue.toString(),
            cashPnl: position.cashPnl.toString(),
            percentPnl: position.percentPnl.toString(),
            totalBought: position.totalBought.toString(),
            realizedPnl: position.realizedPnl.toString(),
            percentRealizedPnl: position.percentRealizedPnl.toString(),
            curPrice: position.curPrice.toString(),
        });
    }

    // Print formatted JSON output
    console.log("=== Complete User Data (JSON) ===\n");
    console.log(JSON.stringify(output, null, 2), "\n");
}

// Timer utility
function formatDuration(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
        return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    } else if (minutes > 0) {
        return `${minutes}m ${seconds % 60}s`;
    } else {
        return `${seconds}s`;
    }
}

async function main() {
    const startTime = Date.now();
    console.log("=== Starting Polymarket Attestation Process ===\n");
    console.log("Start time:", new Date().toISOString(), "\n");

    const prepareStartTime = Date.now();
    console.log("=== Preparing All Requests in Parallel ===\n");

    // Prepare all requests in parallel
    const [closedPositionsData, valueData, activityData, currentPositionsData] = await Promise.all([
        prepareAttestationRequest(
            closedPositionsUrl,
            closedPositionsQueryParams,
            closedPositionsJq,
            closedPositionsAbiSignature
        ),
        prepareAttestationRequest(valueUrl, valueQueryParams, valueJq, valueAbiSignature),
        prepareAttestationRequest(activityUrl, activityQueryParams, activityJq, activityAbiSignature),
        prepareAttestationRequest(
            currentPositionsUrl,
            currentPositionsQueryParams,
            currentPositionsJq,
            currentPositionsAbiSignature
        ),
    ]);

    console.log("Closed Positions Data:", JSON.stringify(closedPositionsData, null, 2), "\n");
    console.log("Value Data:", JSON.stringify(valueData, null, 2), "\n");
    console.log("Activity Data:", JSON.stringify(activityData, null, 2), "\n");
    console.log("Current Positions Data:", JSON.stringify(currentPositionsData, null, 2), "\n");
    console.log("⏱️  Preparation time:", formatDuration(Date.now() - prepareStartTime), "\n");

    // Validate all requests
    if (closedPositionsData.status !== "VALID" || !closedPositionsData.abiEncodedRequest) {
        console.error("Failed to prepare closed positions request:", closedPositionsData);
        process.exit(1);
    }
    if (valueData.status !== "VALID" || !valueData.abiEncodedRequest) {
        console.error("Failed to prepare value request:", valueData);
        process.exit(1);
    }
    if (activityData.status !== "VALID" || !activityData.abiEncodedRequest) {
        console.error("Failed to prepare activity request:", activityData);
        process.exit(1);
    }
    if (currentPositionsData.status !== "VALID" || !currentPositionsData.abiEncodedRequest) {
        console.error("Failed to prepare current positions request:", currentPositionsData);
        process.exit(1);
    }

    const submitStartTime = Date.now();
    console.log("=== Submitting All Requests Sequentially ===\n");
    console.log("⚠️  Submitting sequentially to avoid nonce conflicts...\n");

    // Submit all requests sequentially to avoid nonce conflicts
    // Each transaction needs to be sent and have its nonce incremented before the next one
    console.log("📤 Submitting Closed Positions request...\n");
    const closedPositionsRoundId = await submitAttestationRequest(closedPositionsData.abiEncodedRequest);

    console.log("📤 Submitting Value request...\n");
    const valueRoundId = await submitAttestationRequest(valueData.abiEncodedRequest);

    console.log("📤 Submitting Activity request...\n");
    const activityRoundId = await submitAttestationRequest(activityData.abiEncodedRequest);

    console.log("📤 Submitting Current Positions request...\n");
    const currentPositionsRoundId = await submitAttestationRequest(currentPositionsData.abiEncodedRequest);

    const closedPositionsRoundLink = `https://${network.name}-systems-explorer.flare.rocks/voting-round/${closedPositionsRoundId}?tab=fdc`;
    const valueRoundLink = `https://${network.name}-systems-explorer.flare.rocks/voting-round/${valueRoundId}?tab=fdc`;
    const activityRoundLink = `https://${network.name}-systems-explorer.flare.rocks/voting-round/${activityRoundId}?tab=fdc`;
    const currentPositionsRoundLink = `https://${network.name}-systems-explorer.flare.rocks/voting-round/${currentPositionsRoundId}?tab=fdc`;

    console.log(`Closed Positions Round Link: ${closedPositionsRoundLink}\n`);
    console.log(`Value Round Link: ${valueRoundLink}\n`);
    console.log(`Activity Round Link: ${activityRoundLink}\n`);
    console.log(`Current Positions Round Link: ${currentPositionsRoundLink}\n`);
    console.log("⏱️  Submission time:", formatDuration(Date.now() - submitStartTime), "\n");

    const proofStartTime = Date.now();
    console.log("=== Retrieving Proofs in Parallel ===\n");
    console.log(`Waiting for all rounds to finalize...`);
    console.log(`Closed Positions: ${closedPositionsRoundLink}`);
    console.log(`Value: ${valueRoundLink}`);
    console.log(`Activity: ${activityRoundLink}`);
    console.log(`Current Positions: ${currentPositionsRoundLink}\n`);

    // Retrieve all proofs in parallel (they'll each wait for their round to finalize)
    const [closedPositionsProof, valueProof, activityProof, currentPositionsProof] = await Promise.all([
        retrieveDataAndProof(closedPositionsData.abiEncodedRequest, closedPositionsRoundId),
        retrieveDataAndProof(valueData.abiEncodedRequest, valueRoundId),
        retrieveDataAndProof(activityData.abiEncodedRequest, activityRoundId),
        retrieveDataAndProof(currentPositionsData.abiEncodedRequest, currentPositionsRoundId),
    ]);

    console.log("⏱️  Proof retrieval time:", formatDuration(Date.now() - proofStartTime), "\n");

    const deployStartTime = Date.now();
    console.log("=== Deploying Contract ===\n");
    const userDataStore: PolymarketUserDataStoreInstance = await deployAndVerifyContract();
    console.log("⏱️  Deployment time:", formatDuration(Date.now() - deployStartTime), "\n");

    const interactStartTime = Date.now();
    console.log("=== Interacting with Contract ===\n");
    await interactWithContract(userDataStore, closedPositionsProof, valueProof, activityProof, currentPositionsProof);
    console.log("⏱️  Contract interaction time:", formatDuration(Date.now() - interactStartTime), "\n");

    const endTime = Date.now();
    const totalDuration = endTime - startTime;
    console.log("\n=== Process Complete ===\n");
    console.log("End time:", new Date().toISOString());
    console.log("Total duration:", formatDuration(totalDuration), `(${totalDuration}ms)\n`);
}

void main()
    .then(() => {
        process.exit(0);
    })
    .catch((error) => {
        console.error("Fatal error:", error);
        process.exit(1);
    });
