import { NextRequest } from 'next/server';
import { spawn } from 'child_process';
import { join } from 'path';

// Helper to send SSE message
function sendSSE(controller: ReadableStreamDefaultController, event: string, data: any) {
  const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  controller.enqueue(new TextEncoder().encode(message));
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { withdrawAmount, userAddress } = body;

    // Validate withdraw amount
    if (!withdrawAmount || Number(withdrawAmount) <= 0) {
      return new Response(JSON.stringify({ error: 'Invalid withdraw amount' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Validate user address
    if (!userAddress || !userAddress.startsWith('0x')) {
      return new Response(JSON.stringify({ error: 'Invalid user address' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Get pool address from environment or use hardcoded value
    const poolAddress = process.env.FXRP_POOL_ADDRESS || '0x30d9B6F5d78692eE2ebDd57a3EF534D6A8EAefc2';

    // Get project root
    // Next.js runs from frontend directory, so process.cwd() is frontend/
    // Project root is one level up: ../
    const projectRoot = join(process.cwd(), '..');
    const scriptPath = join(projectRoot, 'scripts/fassets/fxrpPool/withdraw.ts');

    // Create SSE stream
    const stream = new ReadableStream({
      async start(controller) {
        try {
          sendSSE(controller, 'log', { 
            message: '=== Starting FXRP Withdrawal Process ===',
            timestamp: new Date().toISOString()
          });
          sendSSE(controller, 'log', { message: `💰 Withdraw Amount: ${withdrawAmount} FXRP` });
          sendSSE(controller, 'log', { message: `👤 User Address: ${userAddress}` });
          sendSSE(controller, 'log', { message: `🏊 Pool Address: ${poolAddress}` });
          sendSSE(controller, 'log', { message: `🕐 Start time: ${new Date().toLocaleTimeString()}` });
          sendSSE(controller, 'log', { message: '🚀 Executing Hardhat script...' });
          sendSSE(controller, 'log', { message: `📁 Script path: ${scriptPath}` });
          sendSSE(controller, 'log', { message: `📁 Project root: ${projectRoot}` });

          // Spawn Hardhat process using yarn (project uses yarn)
          const hardhatProcess = spawn(
            'yarn',
            ['hardhat', 'run', scriptPath, '--network', 'coston2'],
            {
              cwd: projectRoot,
              env: {
                ...process.env,
                FXRP_POOL_ADDRESS: poolAddress,
                WITHDRAW_AMOUNT: withdrawAmount.toString(),
                USER_ADDRESS: userAddress,
              },
              shell: true,
            }
          );

          let outputBuffer = '';
          let transactionHash: string | null = null;

          // Stream stdout
          hardhatProcess.stdout.on('data', (data: Buffer) => {
            const text = data.toString();
            outputBuffer += text;

            // Extract transaction hash from output
            const txHashMatch = text.match(/Transaction Hash:\s*(0x[a-fA-F0-9]{64})/i);
            if (txHashMatch) {
              transactionHash = txHashMatch[1];
            }

            // Split by lines
            const lines = outputBuffer.split('\n');
            outputBuffer = lines.pop() || ''; // Keep incomplete line in buffer

            for (const line of lines) {
              if (line.trim()) {
                sendSSE(controller, 'log', { message: line.trim() });
              }
            }
          });

          // Stream stderr
          hardhatProcess.stderr.on('data', (data: Buffer) => {
            const text = data.toString();
            const lines = text.split('\n');
            for (const line of lines) {
              if (line.trim()) {
                sendSSE(controller, 'log', { message: line.trim(), type: 'error' });
              }
            }
          });

          // Handle process completion
          hardhatProcess.on('close', (code) => {
            if (code === 0) {
              sendSSE(controller, 'log', { 
                message: '✅ Withdrawal completed successfully!',
                type: 'success'
              });
              if (transactionHash) {
                const txLink = `https://coston2-explorer.flare.network/tx/${transactionHash}`;
                sendSSE(controller, 'log', { 
                  message: `Transaction: ${transactionHash}`,
                  type: 'info'
                });
                sendSSE(controller, 'log', { 
                  message: `View on explorer: ${txLink}`,
                  type: 'info',
                  link: txLink
                });
              }
              sendSSE(controller, 'complete', { success: true, transactionHash });
            } else {
              sendSSE(controller, 'log', { 
                message: `❌ Withdrawal failed with exit code ${code}`,
                type: 'error'
              });
              sendSSE(controller, 'complete', { success: false, exitCode: code });
            }
            controller.close();
          });

          // Handle process errors
          hardhatProcess.on('error', (error) => {
            sendSSE(controller, 'log', { 
              message: `❌ Error executing script: ${error.message}`,
              type: 'error'
            });
            sendSSE(controller, 'complete', { success: false, error: error.message });
            controller.close();
          });

        } catch (error: any) {
          sendSSE(controller, 'log', { 
            message: `❌ Error: ${error.message}`,
            type: 'error'
          });
          sendSSE(controller, 'complete', { success: false, error: error.message });
          controller.close();
        }
      }
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error: any) {
    console.error('API route error:', error);
    return new Response(JSON.stringify({ 
      error: 'Failed to process request',
      message: error.message || 'Unknown error',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

