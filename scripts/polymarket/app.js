// Configuration
const BACKEND_URL = "http://localhost:3001";
const API_URLS = {
    closedPositions: "https://data-api.polymarket.com/closed-positions",
    value: "https://data-api.polymarket.com/value",
    activity: "https://data-api.polymarket.com/activity",
};

const JQ_QUERIES = {
    closedPositions: `. | .[0] | {realizedPnl: (.realizedPnl | floor)}`,
    value: `. | .[0] | {value: (.value | floor)}`,
    activity: `. | .[0] | {name: .name}`,
};

const ABI_SIGNATURES = {
    closedPositions: `{"components": [{"internalType": "int256", "name": "realizedPnl", "type": "int256"}],"name": "task","type": "tuple"}`,
    value: `{"components": [{"internalType": "int256", "name": "value", "type": "int256"}],"name": "task","type": "tuple"}`,
    activity: `{"components": [{"internalType": "string", "name": "name", "type": "string"}],"name": "task","type": "tuple"}`,
};

// Helper function to convert string to hex
function toUtf8HexString(str) {
    let hex = "0x";
    for (let i = 0; i < str.length; i++) {
        const charCode = str.charCodeAt(i);
        hex += charCode.toString(16).padStart(2, "0");
    }
    // Pad to 64 bytes (32 bytes = 64 hex chars)
    while (hex.length < 66) {
        hex += "00";
    }
    return hex.slice(0, 66);
}

// Logging functions
function addLog(message, type = "info") {
    const logsContainer = document.getElementById("logsContainer");
    const logEntry = document.createElement("div");
    logEntry.className = `log-entry ${type}`;
    
    const time = new Date().toLocaleTimeString();
    const timeSpan = document.createElement("span");
    timeSpan.className = "log-time";
    timeSpan.textContent = `[${time}]`;
    
    const messageSpan = document.createElement("span");
    messageSpan.textContent = message;
    
    logEntry.appendChild(timeSpan);
    logEntry.appendChild(messageSpan);
    logsContainer.appendChild(logEntry);
    logsContainer.scrollTop = logsContainer.scrollHeight;
}

function clearLogs() {
    document.getElementById("logsContainer").innerHTML = "";
    document.getElementById("resultSection").classList.remove("show");
    document.getElementById("results").innerHTML = "";
}

// Prepare attestation request
async function prepareAttestationRequest(apiUrl, queryParams, postProcessJq, abiSignature, apiName) {
    addLog(`=== Preparing ${apiName} Request ===`, "info");
    
    const verifierUrl = document.getElementById("verifierUrl").value;
    const apiKey = document.getElementById("apiKey").value;
    
    const attestationType = toUtf8HexString("Web2Json");
    const sourceId = toUtf8HexString("PublicWeb2");
    
    const requestBody = {
        attestationType: attestationType,
        sourceId: sourceId,
        requestBody: {
            url: apiUrl,
            httpMethod: "GET",
            headers: "{}",
            queryParams: queryParams,
            body: "{}",
            postProcessJq: postProcessJq,
            abiSignature: abiSignature,
        },
    };
    
    addLog(`URL: ${verifierUrl}Web2Json/prepareRequest`, "info");
    addLog(`Request Body: ${JSON.stringify(requestBody, null, 2)}`, "info");
    
    try {
        const response = await fetch(`${verifierUrl}Web2Json/prepareRequest`, {
            method: "POST",
            headers: {
                "X-API-KEY": apiKey,
                "Content-Type": "application/json",
            },
            body: JSON.stringify(requestBody),
        });
        
        if (response.status !== 200) {
            throw new Error(`Response status: ${response.status} ${response.statusText}`);
        }
        
        addLog(`Response status: OK`, "success");
        const data = await response.json();
        addLog(`${apiName} Response: ${JSON.stringify(data, null, 2)}`, "info");
        
        return data;
    } catch (error) {
        addLog(`Error preparing ${apiName} request: ${error.message}`, "error");
        throw error;
    }
}

// Fetch raw API data (for display purposes)
async function fetchRawApiData(apiUrl, queryParams, apiName) {
    addLog(`Fetching raw data from ${apiName} API...`, "info");
    
    try {
        const params = new URLSearchParams(JSON.parse(queryParams));
        const urlWithParams = `${apiUrl}?${params.toString()}`;
        addLog(`API URL: ${urlWithParams}`, "info");
        
        const response = await fetch(urlWithParams);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        addLog(`Raw ${apiName} Data: ${JSON.stringify(data, null, 2)}`, "info");
        return data;
    } catch (error) {
        addLog(`Error fetching ${apiName} data: ${error.message}`, "error");
        throw error;
    }
}

// Main verification function
async function startVerification() {
    const userAddress = document.getElementById("userAddress").value.trim();
    const startBtn = document.getElementById("startBtn");
    
    if (!userAddress || !userAddress.startsWith("0x")) {
        addLog("Please enter a valid Ethereum address", "error");
        return;
    }
    
    startBtn.disabled = true;
    startBtn.textContent = "Processing...";
    clearLogs();
    
    addLog("🚀 Starting Polymarket User Data FDC Verification", "info");
    addLog(`User Address: ${userAddress}`, "info");
    
    const results = {
        closedPositions: null,
        value: null,
        activity: null,
    };
    
    try {
        // Prepare query parameters
        const closedPositionsQueryParams = JSON.stringify({ user: userAddress, limit: "10" });
        const valueQueryParams = JSON.stringify({ user: userAddress });
        const activityQueryParams = JSON.stringify({ user: userAddress, limit: "1" });
        
        // Fetch raw API data first
        addLog("\n=== Fetching Raw API Data ===", "info");
        const rawClosedPositions = await fetchRawApiData(
            API_URLS.closedPositions,
            closedPositionsQueryParams,
            "Closed Positions"
        );
        const rawValue = await fetchRawApiData(API_URLS.value, valueQueryParams, "Value");
        const rawActivity = await fetchRawApiData(API_URLS.activity, activityQueryParams, "Activity");
        
        // Prepare attestation requests
        addLog("\n=== Preparing FDC Attestation Requests ===", "info");
        
        const [closedPositionsData, valueData, activityData] = await Promise.all([
            prepareAttestationRequest(
                API_URLS.closedPositions,
                closedPositionsQueryParams,
                JQ_QUERIES.closedPositions,
                ABI_SIGNATURES.closedPositions,
                "Closed Positions"
            ),
            prepareAttestationRequest(
                API_URLS.value,
                valueQueryParams,
                JQ_QUERIES.value,
                ABI_SIGNATURES.value,
                "Value"
            ),
            prepareAttestationRequest(
                API_URLS.activity,
                activityQueryParams,
                JQ_QUERIES.activity,
                ABI_SIGNATURES.activity,
                "Activity"
            ),
        ]);
        
        // Check if all requests are valid
        if (closedPositionsData.status !== "VALID" || !closedPositionsData.abiEncodedRequest) {
            addLog(`❌ Closed Positions request failed: ${closedPositionsData.status}`, "error");
            addLog(`Response: ${JSON.stringify(closedPositionsData, null, 2)}`, "error");
            throw new Error("Closed Positions request failed");
        }
        
        if (valueData.status !== "VALID" || !valueData.abiEncodedRequest) {
            addLog(`❌ Value request failed: ${valueData.status}`, "error");
            addLog(`Response: ${JSON.stringify(valueData, null, 2)}`, "error");
            throw new Error("Value request failed");
        }
        
        if (activityData.status !== "VALID" || !activityData.abiEncodedRequest) {
            addLog(`❌ Activity request failed: ${activityData.status}`, "error");
            addLog(`Response: ${JSON.stringify(activityData, null, 2)}`, "error");
            throw new Error("Activity request failed");
        }
        
        addLog("\n✅ All attestation requests prepared successfully!", "success");
        
        // Store results
        results.closedPositions = {
            raw: rawClosedPositions,
            fdc: closedPositionsData,
            extracted: rawClosedPositions[0] ? {
                realizedPnl: Math.floor(rawClosedPositions[0].realizedPnl || 0),
            } : null,
        };
        
        results.value = {
            raw: rawValue,
            fdc: valueData,
            extracted: rawValue[0] ? {
                value: Math.floor(rawValue[0].value || 0),
            } : null,
        };
        
        results.activity = {
            raw: rawActivity,
            fdc: activityData,
            extracted: rawActivity[0] ? {
                name: rawActivity[0].name || "N/A",
            } : null,
        };
        
        // Display results
        displayResults(results);
        
        addLog("\n✅ API Verification complete! Check results below.", "success");
        addLog("\n🚀 Starting blockchain deployment and FDC submission...", "info");
        addLog("   This will deploy the contract and submit requests to Flare FDC.", "info");
        
        // Now trigger the Hardhat script via backend
        await runHardhatScript(userAddress);
        
    } catch (error) {
        addLog(`\n❌ Error during verification: ${error.message}`, "error");
        console.error(error);
    } finally {
        startBtn.disabled = false;
        startBtn.textContent = "Start FDC Verification";
    }
}

// Run Hardhat script via backend API
async function runHardhatScript(userAddress) {
    addLog("\n=== Connecting to Backend Server ===", "info");
    addLog(`Backend URL: ${BACKEND_URL}`, "info");
    
    try {
        const response = await fetch(`${BACKEND_URL}/api/run-hardhat`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                userAddress: userAddress,
                network: "coston2",
            }),
        });

        if (!response.ok) {
            throw new Error(`Backend error: ${response.status} ${response.statusText}`);
        }

        // Read the stream
        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value);
            const lines = chunk.split("\n");

            for (const line of lines) {
                if (line.startsWith("data: ")) {
                    try {
                        const data = JSON.parse(line.slice(6));
                        
                        if (data.type === "stdout" || data.type === "stderr") {
                            // Add log entry for each line of output
                            const lines = data.data.split("\n").filter(l => l.trim());
                            for (const logLine of lines) {
                                if (logLine.trim()) {
                                    // Determine log type based on content
                                    let logType = "info";
                                    if (logLine.includes("ERROR") || logLine.includes("Error") || logLine.includes("Failed")) {
                                        logType = "error";
                                    } else if (logLine.includes("✅") || logLine.includes("Success") || logLine.includes("deployed to")) {
                                        logType = "success";
                                    } else if (logLine.includes("WARNING") || logLine.includes("Warning")) {
                                        logType = "warning";
                                    }
                                    addLog(logLine, logType);
                                }
                            }
                        } else if (data.type === "close") {
                            if (data.code === 0) {
                                addLog("\n✅ Hardhat script completed successfully!", "success");
                            } else {
                                addLog(`\n❌ Hardhat script exited with code ${data.code}`, "error");
                                if (data.errorOutput) {
                                    addLog(`Error output: ${data.errorOutput}`, "error");
                                }
                            }
                        } else if (data.type === "error") {
                            addLog(`\n❌ Backend error: ${data.error}`, "error");
                        }
                    } catch (e) {
                        // Ignore JSON parse errors for malformed chunks
                    }
                }
            }
        }
    } catch (error) {
        addLog(`\n❌ Error connecting to backend: ${error.message}`, "error");
        addLog("Make sure the backend server is running:", "info");
        addLog("  cd scripts/polymarket && npm install && npm start", "info");
    }
}

// Display results
function displayResults(results) {
    const resultSection = document.getElementById("resultSection");
    const resultsDiv = document.getElementById("results");
    
    resultsDiv.innerHTML = "";
    
    // Closed Positions
    if (results.closedPositions) {
        const div = document.createElement("div");
        div.className = "result-item";
        div.innerHTML = `
            <h3>📊 Closed Positions</h3>
            <p><strong>Realized PnL:</strong> ${results.closedPositions.extracted?.realizedPnl || "N/A"}</p>
            <p><strong>Total Positions:</strong> ${results.closedPositions.raw?.length || 0}</p>
            <p><strong>FDC Status:</strong> ${results.closedPositions.fdc?.status || "N/A"}</p>
            <details>
                <summary>View Raw Data</summary>
                <pre>${JSON.stringify(results.closedPositions.raw, null, 2)}</pre>
            </details>
        `;
        resultsDiv.appendChild(div);
    }
    
    // Value
    if (results.value) {
        const div = document.createElement("div");
        div.className = "result-item";
        div.innerHTML = `
            <h3>💰 Portfolio Value</h3>
            <p><strong>Value:</strong> ${results.value.extracted?.value || "N/A"}</p>
            <p><strong>FDC Status:</strong> ${results.value.fdc?.status || "N/A"}</p>
            <details>
                <summary>View Raw Data</summary>
                <pre>${JSON.stringify(results.value.raw, null, 2)}</pre>
            </details>
        `;
        resultsDiv.appendChild(div);
    }
    
    // Activity
    if (results.activity) {
        const div = document.createElement("div");
        div.className = "result-item";
        div.innerHTML = `
            <h3>👤 User Activity</h3>
            <p><strong>Name:</strong> ${results.activity.extracted?.name || "N/A"}</p>
            <p><strong>FDC Status:</strong> ${results.activity.fdc?.status || "N/A"}</p>
            <details>
                <summary>View Raw Data</summary>
                <pre>${JSON.stringify(results.activity.raw, null, 2)}</pre>
            </details>
        `;
        resultsDiv.appendChild(div);
    }
    
    // Summary
    const summaryDiv = document.createElement("div");
    summaryDiv.className = "result-item";
    summaryDiv.innerHTML = `
        <h3>📋 Summary</h3>
        <p><strong>User Name:</strong> ${results.activity?.extracted?.name || "N/A"}</p>
        <p><strong>Realized PnL:</strong> ${results.closedPositions?.extracted?.realizedPnl || "N/A"}</p>
        <p><strong>Portfolio Value:</strong> ${results.value?.extracted?.value || "N/A"}</p>
    `;
    resultsDiv.appendChild(summaryDiv);
    
    resultSection.classList.add("show");
}

// Make functions available globally
window.startVerification = startVerification;
window.clearLogs = clearLogs;

