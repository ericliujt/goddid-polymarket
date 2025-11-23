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
    const { depositAmount, userAddress } = body;

    // Validate deposit amount
    if (!depositAmount || Number(depositAmount) <= 0) {
      return new Response(JSON.stringify({ error: 'Invalid deposit amount' }), {
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
    const scriptPath = join(projectRoot, 'scripts/fassets/fxrpPool/deposit.ts');

    // Create SSE stream
    const stream = new ReadableStream({
      async start(controller) {
        try {
          sendSSE(controller, 'log', { 
            message: '=== Starting FXRP Deposit Process ===',
            timestamp: new Date().toISOString()
          });
          sendSSE(controller, 'log', { message: `💰 Deposit Amount: ${depositAmount} FXRP` });
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
                DEPOSIT_AMOUNT: depositAmount.toString(),
                USER_ADDRESS: userAddress,
              },
              shell: true,
            }
          );

          let outputBuffer = '';

          // Stream stdout
          hardhatProcess.stdout.on('data', (data: Buffer) => {
            const text = data.toString();
            outputBuffer += text;

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
                message: '✅ Deposit completed successfully!',
                type: 'success'
              });
              sendSSE(controller, 'complete', { success: true });
            } else {
              sendSSE(controller, 'log', { 
                message: `❌ Deposit failed with exit code ${code}`,
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

