import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';

const execAsync = promisify(exec);

export async function POST(request: NextRequest) {
    try {
        const { polymarketData } = await request.json();
        
        if (!polymarketData) {
            return NextResponse.json(
                { error: 'No Polymarket data provided' },
                { status: 400 }
            );
        }

        // Convert the data to a JSON string for passing to the script
        const dataString = JSON.stringify(polymarketData);
        
        // Get the project root directory (two levels up from frontend/app/api)
        const projectRoot = path.join(process.cwd(), '..');
        
        // Create a stream response
        const encoder = new TextEncoder();
        const stream = new TransformStream();
        const writer = stream.writable.getWriter();
        
        // Start the response immediately
        const response = new Response(stream.readable, {
            headers: {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
            },
        });
        
        // Run the script asynchronously
        (async () => {
            try {
                // Send initial message
                await writer.write(
                    encoder.encode(`data: ${JSON.stringify({ 
                        type: 'log', 
                        message: '🚀 Starting credit score calculation...' 
                    })}\n\n`)
                );
                
                // Run the hardhat script with the data as environment variable
                const command = `cd ${projectRoot} && POLYMARKET_DATA='${dataString.replace(/'/g, "\\'")}' npx hardhat run scripts/creditEngine/submitAndGetScore.ts --network baseSepolia`;
                const { stdout, stderr } = await execAsync(command, {
                    maxBuffer: 1024 * 1024 * 10 // 10MB buffer
                });
                
                // Parse the output to extract the JSON result
                const lines = stdout.split('\n');
                let jsonResultFound = false;
                let jsonResult = null;
                
                // Send log lines to the client
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
                    } else if (line.trim() && !jsonResultFound) {
                        // Send log lines as events
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
                    await writer.write(
                        encoder.encode(`data: ${JSON.stringify({ 
                            type: 'error', 
                            message: 'Script warning: ' + stderr 
                        })}\n\n`)
                    );
                }
                
                // Send the final result
                if (jsonResult) {
                    await writer.write(
                        encoder.encode(`data: ${JSON.stringify({ 
                            type: 'result', 
                            data: jsonResult 
                        })}\n\n`)
                    );
                } else {
                    await writer.write(
                        encoder.encode(`data: ${JSON.stringify({ 
                            type: 'error', 
                            message: 'Failed to get credit score result' 
                        })}\n\n`)
                    );
                }
                
                // Close the stream
                await writer.write(
                    encoder.encode(`data: ${JSON.stringify({ type: 'close' })}\n\n`)
                );
            } catch (error: any) {
                console.error('Error running script:', error);
                await writer.write(
                    encoder.encode(`data: ${JSON.stringify({ 
                        type: 'error', 
                        message: error.message || 'Failed to calculate credit score' 
                    })}\n\n`)
                );
            } finally {
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

// Simple endpoint to check credit score for a wallet
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const walletAddress = searchParams.get('wallet');
        const contractAddress = searchParams.get('contract') || '0x18D4EE2813d4eb63cC89DC82A8bFe30B482944ed';
        
        if (!walletAddress) {
            return NextResponse.json(
                { error: 'Wallet address required' },
                { status: 400 }
            );
        }
        
        const projectRoot = path.join(process.cwd(), '..');
        const command = `cd ${projectRoot} && npx hardhat run scripts/creditEngine/checkCreditScore.ts --network baseSepolia ${contractAddress} ${walletAddress}`;
        
        const { stdout, stderr } = await execAsync(command, {
            maxBuffer: 1024 * 1024 * 10
        });
        
        // Parse the output
        const lines = stdout.split('\n');
        let creditScore = null;
        let baseScore = null;
        let isCalculated = false;
        
        for (const line of lines) {
            if (line.includes('Credit Score:')) {
                const match = line.match(/Credit Score:\s*(\d+)/);
                if (match) {
                    creditScore = match[1];
                    isCalculated = true;
                }
            }
            if (line.includes('Base score')) {
                const match = line.match(/Base score.*:\s*(\d+)/);
                if (match) {
                    baseScore = match[1];
                }
            }
        }
        
        return NextResponse.json({
            success: isCalculated,
            creditScore,
            baseScore,
            walletAddress,
            contractAddress
        });
        
    } catch (error: any) {
        console.error('API error:', error);
        return NextResponse.json(
            { error: error.message || 'Internal server error' },
            { status: 500 }
        );
    }
}
