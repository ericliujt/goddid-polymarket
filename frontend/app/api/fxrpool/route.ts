import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';

const execAsync = promisify(exec);

// GET pool info
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const poolAddress = searchParams.get('poolAddress') || process.env.NEXT_PUBLIC_FXRP_POOL_ADDRESS;
        const userAddress = searchParams.get('userAddress');
        
        if (!poolAddress) {
            return NextResponse.json(
                { error: 'Pool address required' },
                { status: 400 }
            );
        }
        
        const projectRoot = path.join(process.cwd(), '..');
        
        // Create a modified version of the getPoolInfo script that outputs JSON
        const scriptContent = `
import { web3 } from "hardhat";
import { formatUnits } from "ethers";
import { getAssetManagerFXRP } from "./scripts/utils/getters";

const FXRPool = artifacts.require("FXRPool");
const IERC20 = artifacts.require("IERC20");

async function main() {
    // Use toChecksumAddress to ensure proper formatting
    const POOL_ADDRESS = web3.utils.toChecksumAddress("${poolAddress}");
    const USER_ADDRESS = "${userAddress || ''}";
    
    const pool = await FXRPool.at(POOL_ADDRESS);
    const fxrpAddress = await pool.getFXRPAddress();
    const fxrp = await IERC20.at(fxrpAddress);
    
    // Get actual decimals from AssetManager
    const assetManager = await getAssetManagerFXRP();
    const decimals = await assetManager.assetMintingDecimals();
    const decimalsNum = Number(decimals);
    
    const poolBalance = await pool.getPoolBalance();
    const owner = await pool.owner();
    
    const result = {
        poolAddress: POOL_ADDRESS,
        fxrpAddress,
        owner,
        poolBalance: poolBalance.toString(),
        poolBalanceFormatted: formatUnits(poolBalance.toString(), decimalsNum),
        decimals: decimalsNum
    };
    
    if (USER_ADDRESS) {
        const checksummedUserAddress = web3.utils.toChecksumAddress(USER_ADDRESS);
        const userDepositBalance = await pool.getUserBalance(checksummedUserAddress);
        const userFXRPBalance = await fxrp.balanceOf(checksummedUserAddress);
        const userAllowance = await fxrp.allowance(checksummedUserAddress, POOL_ADDRESS);
        
        result.user = {
            address: checksummedUserAddress,
            depositBalance: userDepositBalance.toString(),
            depositBalanceFormatted: formatUnits(userDepositBalance.toString(), decimalsNum),
            fxrpBalance: userFXRPBalance.toString(),
            fxrpBalanceFormatted: formatUnits(userFXRPBalance.toString(), decimalsNum),
            allowance: userAllowance.toString(),
            allowanceFormatted: formatUnits(userAllowance.toString(), decimalsNum)
        };
    }
    
    console.log("### JSON_RESULT ###");
    console.log(JSON.stringify(result));
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
        `;
        
        // Save script to temp file
        const tempScriptPath = path.join(projectRoot, 'temp-pool-info.ts');
        require('fs').writeFileSync(tempScriptPath, scriptContent);
        
        try {
            const command = `cd ${projectRoot} && npx hardhat run ${tempScriptPath} --network coston2`;
            const { stdout, stderr } = await execAsync(command, {
                maxBuffer: 1024 * 1024 * 10
            });
            
            // Parse the output
            const lines = stdout.split('\n');
            let jsonResult = null;
            let jsonResultFound = false;
            
            for (const line of lines) {
                if (line.includes('### JSON_RESULT ###')) {
                    jsonResultFound = true;
                    continue;
                }
                
                if (jsonResultFound && line.trim()) {
                    try {
                        jsonResult = JSON.parse(line);
                        break;
                    } catch {
                        // Not the JSON line yet
                    }
                }
            }
            
            // Clean up temp file
            require('fs').unlinkSync(tempScriptPath);
            
            if (jsonResult) {
                return NextResponse.json({
                    success: true,
                    data: jsonResult
                });
            } else {
                return NextResponse.json(
                    { error: 'Failed to get pool info' },
                    { status: 500 }
                );
            }
        } catch (error) {
            // Clean up temp file on error
            try {
                require('fs').unlinkSync(tempScriptPath);
            } catch {}
            throw error;
        }
        
    } catch (error: any) {
        console.error('API error:', error);
        return NextResponse.json(
            { error: error.message || 'Internal server error' },
            { status: 500 }
        );
    }
}

// POST to execute lending (transferTo)
export async function POST(request: NextRequest) {
    try {
        const { poolAddress, recipientAddress, amount, creditScore } = await request.json();
        
        if (!poolAddress || !recipientAddress || !amount) {
            return NextResponse.json(
                { error: 'Missing required parameters' },
                { status: 400 }
            );
        }
        
        const projectRoot = path.join(process.cwd(), '..');
        
        // Create a stream response
        const encoder = new TextEncoder();
        const stream = new TransformStream();
        const writer = stream.writable.getWriter();
        
        const response = new Response(stream.readable, {
            headers: {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
            },
        });
        
        // Run the lending operation asynchronously
        (async () => {
            try {
                await writer.write(
                    encoder.encode(`data: ${JSON.stringify({ 
                        type: 'log', 
                        message: `🚀 Processing lending request...` 
                    })}\n\n`)
                );
                
                await writer.write(
                    encoder.encode(`data: ${JSON.stringify({ 
                        type: 'log', 
                        message: `📊 Credit Score: ${creditScore}` 
                    })}\n\n`)
                );
                
                await writer.write(
                    encoder.encode(`data: ${JSON.stringify({ 
                        type: 'log', 
                        message: `💰 Amount to lend: ${amount} FXRP` 
                    })}\n\n`)
                );
                
                // Ensure addresses are properly checksummed
                const web3 = require('web3');
                const checksummedPoolAddress = web3.utils.toChecksumAddress(poolAddress);
                const checksummedRecipientAddress = web3.utils.toChecksumAddress(recipientAddress);
                
                // Run the transfer script
                const command = `cd ${projectRoot} && FXRP_POOL_ADDRESS=${checksummedPoolAddress} RECIPIENT_ADDRESS=${checksummedRecipientAddress} TRANSFER_AMOUNT=${amount} npx hardhat run scripts/fassets/fxrpPool/transfer.ts --network coston2`;
                
                const { stdout, stderr } = await execAsync(command, {
                    maxBuffer: 1024 * 1024 * 10
                });
                
                // Send output lines
                const lines = stdout.split('\n');
                for (const line of lines) {
                    if (line.trim()) {
                        await writer.write(
                            encoder.encode(`data: ${JSON.stringify({ 
                                type: 'log', 
                                message: line 
                            })}\n\n`)
                        );
                    }
                }
                
                if (stderr) {
                    console.error('Script stderr:', stderr);
                }
                
                // Check if transfer was successful
                const success = stdout.includes('Transfer Complete');
                
                await writer.write(
                    encoder.encode(`data: ${JSON.stringify({ 
                        type: 'result', 
                        success,
                        message: success ? 'Lending completed successfully!' : 'Lending failed'
                    })}\n\n`)
                );
                
            } catch (error: any) {
                console.error('Error executing lending:', error);
                await writer.write(
                    encoder.encode(`data: ${JSON.stringify({ 
                        type: 'error', 
                        message: error.message || 'Failed to process lending' 
                    })}\n\n`)
                );
            } finally {
                await writer.write(
                    encoder.encode(`data: ${JSON.stringify({ type: 'close' })}\n\n`)
                );
                await writer.close();
            }
        })();
        
        return response;
        
    } catch (error: any) {
        console.error('API error:', error);
        return NextResponse.json(
            { error: error.message || 'Internal server error' },
            { status: 500 }
        );
    }
}
