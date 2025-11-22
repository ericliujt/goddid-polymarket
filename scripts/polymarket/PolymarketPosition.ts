import { run, web3 } from "hardhat";
import { PolymarketPositionListInstance } from "../../typechain-types";
import {
    prepareAttestationRequestBase,
    submitAttestationRequest,
    retrieveDataAndProofBaseWithRetry,
} from "../utils/fdc";

const PolymarketPositionList = artifacts.require("PolymarketPositionList");

const { WEB2JSON_VERIFIER_URL_TESTNET, VERIFIER_API_KEY_TESTNET, COSTON2_DA_LAYER_URL } = process.env;

// yarn hardhat run scripts/polymarket/PolymarketPosition.ts --network coston2

// NOTE: The Polymarket API may not be accessible by the Flare verifier service.
// If you get "INVALID: FETCH ERROR", the verifier cannot reach the API.
// This might require whitelisting the verifier's IP or using a different data source.

// Request data
const apiUrl = "https://data-api.polymarket.com/positions";
// Extract the first position's percentRealizedPnl, asset, and conditionId
const postProcessJq = `. | .[0] | {asset: (.asset | tostring), conditionId: .conditionId, percentRealizedPnl: .percentRealizedPnl}`;
const httpMethod = "GET";
// Add User-Agent header to help with API access
const headers = '{"User-Agent": "Mozilla/5.0 (compatible; FlareFDC/1.0)"}';
const queryParams = '{"user":"0xb1d9476e5a5ba938b57cf0a5dc7a91a114605ee1"}';
const body = "{}";
const abiSignature = `{"components": [{"internalType": "string", "name": "asset", "type": "string"},{"internalType": "string", "name": "conditionId", "type": "string"},{"internalType": "int256", "name": "percentRealizedPnl", "type": "int256"}],"name": "task","type": "tuple"}`;

// Configuration constants
const attestationTypeBase = "Web2Json";
const sourceIdBase = "PublicWeb2";
const verifierUrlBase = WEB2JSON_VERIFIER_URL_TESTNET;

async function prepareAttestationRequest(apiUrl: string, postProcessJq: string, abiSignature: string) {
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
    const baseUrl = COSTON2_DA_LAYER_URL?.endsWith('/') ? COSTON2_DA_LAYER_URL : `${COSTON2_DA_LAYER_URL}/`;
    const url = `${baseUrl}api/v1/fdc/proof-by-request-round-raw`;
    console.log("Url:", url, "\n");
    return await retrieveDataAndProofBaseWithRetry(url, abiEncodedRequest, roundId);
}

async function deployAndVerifyContract() {
    const args: any[] = [];
    const positionList: PolymarketPositionListInstance = await PolymarketPositionList.new(...args);
    try {
        await run("verify:verify", {
            address: positionList.address,
            constructorArguments: args,
        });
    } catch (e: any) {
        console.log(e);
    }
    console.log("PolymarketPositionList deployed to", positionList.address, "\n");
    return positionList;
}

async function interactWithContract(positionList: PolymarketPositionListInstance, proof: any) {
    console.log("Proof hex:", proof.response_hex, "\n");

    // A piece of black magic that allows us to read the response type from an artifact
    const IWeb2JsonVerification = await artifacts.require("IWeb2JsonVerification");
    const responseType = IWeb2JsonVerification._json.abi[0].inputs[0].components[1];
    console.log("Response type:", responseType, "\n");

    const decodedResponse = web3.eth.abi.decodeParameter(responseType, proof.response_hex);
    console.log("Decoded proof:", decodedResponse, "\n");
    const transaction = await positionList.addPosition({
        merkleProof: proof.proof,
        data: decodedResponse,
    });
    console.log("Transaction:", transaction.tx, "\n");
    console.log("Polymarket Positions:\n", await positionList.getAllPositions(), "\n");
}

async function main() {
    const data = await prepareAttestationRequest(apiUrl, postProcessJq, abiSignature);
    console.log("Data:", JSON.stringify(data, null, 2), "\n");

    if (data.status !== "VALID" || !data.abiEncodedRequest) {
        console.error("Failed to prepare attestation request:");
        console.error("Status:", data.status);
        console.error("Full response:", JSON.stringify(data, null, 2));
        console.error("\nPossible reasons:");
        console.error("1. The Polymarket API may be blocking the verifier's IP address");
        console.error("2. The API may require specific headers or authentication");
        console.error("3. The verifier service may have restrictions on which APIs it can access");
        console.error("4. The API may be rate-limiting or experiencing issues");
        console.error("\nTo debug:");
        console.error("- Check if the API is accessible: curl", apiUrl);
        console.error("- Verify the API doesn't require authentication");
        console.error("- Contact Flare support about whitelisting the Polymarket API");
        process.exit(1);
    }

    const abiEncodedRequest = data.abiEncodedRequest;
    const roundId = await submitAttestationRequest(abiEncodedRequest);

    const proof = await retrieveDataAndProof(abiEncodedRequest, roundId);

    const positionList: PolymarketPositionListInstance = await deployAndVerifyContract();

    await interactWithContract(positionList, proof);
}

void main().then(() => {
    process.exit(0);
});
