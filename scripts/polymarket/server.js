const express = require("express");
const { spawn } = require("child_process");
const path = require("path");
const cors = require("cors");

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname)); // Serve static files (HTML, JS, CSS)

// Endpoint to run Hardhat script
app.post("/api/run-hardhat", async (req, res) => {
    const { userAddress, network = "coston2" } = req.body;

    if (!userAddress || !userAddress.startsWith("0x")) {
        return res.status(400).json({ error: "Invalid user address" });
    }

    // Set up Server-Sent Events for streaming logs
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("Access-Control-Allow-Origin", "*");

    // Create a modified version of the script with the user address
    const scriptPath = path.join(__dirname, "PolymarketUserData.ts");
    const projectRoot = path.join(__dirname, "../../..");

    // Spawn the Hardhat process
    const hardhatProcess = spawn(
        "npx",
        ["hardhat", "run", scriptPath, "--network", network],
        {
            cwd: projectRoot,
            env: {
                ...process.env,
                // Override the user address in the script by setting an env var
                POLYMARKET_USER_ADDRESS: userAddress,
            },
            shell: true,
        }
    );

    let output = "";
    let errorOutput = "";

    // Stream stdout
    hardhatProcess.stdout.on("data", (data) => {
        const text = data.toString();
        output += text;
        res.write(`data: ${JSON.stringify({ type: "stdout", data: text })}\n\n`);
    });

    // Stream stderr
    hardhatProcess.stderr.on("data", (data) => {
        const text = data.toString();
        errorOutput += text;
        res.write(`data: ${JSON.stringify({ type: "stderr", data: text })}\n\n`);
    });

    // Handle process completion
    hardhatProcess.on("close", (code) => {
        res.write(
            `data: ${JSON.stringify({ type: "close", code, output, errorOutput })}\n\n`
        );
        res.end();
    });

    // Handle errors
    hardhatProcess.on("error", (error) => {
        res.write(
            `data: ${JSON.stringify({ type: "error", error: error.message })}\n\n`
        );
        res.end();
    });

    // Handle client disconnect
    req.on("close", () => {
        hardhatProcess.kill();
        res.end();
    });
});

// Health check endpoint
app.get("/api/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`📁 Serving frontend from: ${__dirname}`);
});

