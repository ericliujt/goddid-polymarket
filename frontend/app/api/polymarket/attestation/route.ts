import { NextRequest } from 'next/server';
import { spawn } from 'child_process';
import { join } from 'path';

// Helper to send SSE message
function sendSSE(controller: ReadableStreamDefaultController, event: string, data: any) {
  const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  controller.enqueue(new TextEncoder().encode(message));
}

// Parse console output to extract structured data
function parseLogLine(line: string): { message: string; link?: string; data?: any } | null {
  // Extract voting round links
  const roundLinkMatch = line.match(/https:\/\/[^\s]+voting-round\/(\d+)[^\s]*/);
  if (roundLinkMatch) {
    return {
      message: line.trim(),
      link: roundLinkMatch[0],
    };
  }

  // Regular log line
  if (line.trim()) {
    return { message: line.trim() };
  }

  return null;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { polymarketAddress } = body;

    // Validate address
    if (!polymarketAddress || !polymarketAddress.startsWith('0x')) {
      return new Response(JSON.stringify({ error: 'Invalid Polymarket address' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Get project root
    // Next.js runs from frontend directory, so process.cwd() is frontend/
    // Project root is one level up: ../
    const projectRoot = join(process.cwd(), '..');
    const scriptPath = join(projectRoot, 'scripts/polymarket/PolymarketUserData.ts');

    // Create SSE stream
    const stream = new ReadableStream({
      async start(controller) {
        try {
          sendSSE(controller, 'log', { 
            message: '=== Starting Polymarket Attestation Process ===',
            timestamp: new Date().toISOString()
          });
          sendSSE(controller, 'log', { message: `📝 Polymarket Address: ${polymarketAddress}` });
          sendSSE(controller, 'log', { message: `🕐 Start time: ${new Date().toLocaleTimeString()}` });
          sendSSE(controller, 'log', { message: '🚀 Executing Hardhat script...' });
          sendSSE(controller, 'log', { message: `📁 Script path: ${scriptPath}` });
          sendSSE(controller, 'log', { message: `📁 Project root: ${projectRoot}` });
          sendSSE(controller, 'log', { message: `💡 Using wallet address: ${polymarketAddress} (via POLYMARKET_USER_ADDRESS env var)` });

          // Spawn Hardhat process using yarn (project uses yarn)
          const hardhatProcess = spawn(
            'yarn',
            ['hardhat', 'run', scriptPath, '--network', 'coston2'],
            {
              cwd: projectRoot,
              env: {
                ...process.env,
                POLYMARKET_USER_ADDRESS: polymarketAddress,
              },
              shell: true,
            }
          );

          let outputBuffer = '';
          let jsonDataBuffer = '';
          let isInJsonBlock = false;
          let braceCount = 0;
          let lastLineWasEmpty = false;

          // Stream stdout
          hardhatProcess.stdout.on('data', (data: Buffer) => {
            const text = data.toString();
            outputBuffer += text;

            // Split by lines
            const lines = outputBuffer.split('\n');
            outputBuffer = lines.pop() || ''; // Keep incomplete line in buffer

            for (const line of lines) {
              // Check if we're entering a JSON block
              if (line.includes('=== Complete User Data (JSON) ===')) {
                isInJsonBlock = true;
                jsonDataBuffer = '';
                braceCount = 0;
                lastLineWasEmpty = false;
                sendSSE(controller, 'log', { message: '📊 Final data available, parsing JSON...' });
                continue;
              }

              // Collect JSON data
              if (isInJsonBlock) {
                const trimmedLine = line.trim();
                const isEmpty = trimmedLine === '';
                
                // If we hit a new section marker (⏱️ or === Process Complete), parse JSON first
                if ((line.includes('⏱️') || (line.includes('===') && line.includes('Process Complete'))) && jsonDataBuffer.trim().length > 0) {
                  // Try to parse the JSON we've collected so far
                  try {
                    const jsonData = JSON.parse(jsonDataBuffer.trim());
                    sendSSE(controller, 'log', { message: '✅ JSON data parsed successfully!' });
                    sendSSE(controller, 'data', { type: 'complete', data: jsonData });
                    isInJsonBlock = false;
                    jsonDataBuffer = '';
                    braceCount = 0;
                    lastLineWasEmpty = false;
                    // Continue processing this line as a regular log
                    const parsed = parseLogLine(line);
                    if (parsed) {
                      sendSSE(controller, 'log', parsed);
                    }
                    continue;
                  } catch (e) {
                    // If parsing fails, try to extract JSON from buffer using balanced braces
                    // Find the first { and match to the last } when braces are balanced
                    let startIdx = jsonDataBuffer.indexOf('{');
                    if (startIdx !== -1) {
                      let tempBraceCount = 0;
                      let endIdx = -1;
                      for (let i = startIdx; i < jsonDataBuffer.length; i++) {
                        if (jsonDataBuffer[i] === '{') tempBraceCount++;
                        if (jsonDataBuffer[i] === '}') tempBraceCount--;
                        if (tempBraceCount === 0 && jsonDataBuffer[i] === '}') {
                          endIdx = i;
                          break;
                        }
                      }
                      if (endIdx !== -1) {
                        try {
                          const jsonStr = jsonDataBuffer.substring(startIdx, endIdx + 1);
                          const jsonData = JSON.parse(jsonStr);
                          sendSSE(controller, 'log', { message: '✅ JSON data parsed successfully!' });
                          sendSSE(controller, 'data', { type: 'complete', data: jsonData });
                          isInJsonBlock = false;
                          jsonDataBuffer = '';
                          braceCount = 0;
                          lastLineWasEmpty = false;
                          // Continue processing this line as a regular log
                          const parsed = parseLogLine(line);
                          if (parsed) {
                            sendSSE(controller, 'log', parsed);
                          }
                          continue;
                        } catch (e2) {
                          // Continue collecting
                        }
                      }
                    }
                  }
                }
                
                // If line is empty and we've collected JSON data with balanced braces, mark it
                if (isEmpty && jsonDataBuffer.trim().length > 0 && braceCount === 0) {
                  lastLineWasEmpty = true;
                  // Don't add empty line to buffer
                  continue;
                }
                
                // If we saw an empty line after balanced braces, and now we have a non-empty line, parse JSON
                if (lastLineWasEmpty && !isEmpty && braceCount === 0 && jsonDataBuffer.trim().length > 0) {
                  try {
                    const jsonData = JSON.parse(jsonDataBuffer.trim());
                    sendSSE(controller, 'log', { message: '✅ JSON data parsed successfully!' });
                    sendSSE(controller, 'data', { type: 'complete', data: jsonData });
                    isInJsonBlock = false;
                    jsonDataBuffer = '';
                    braceCount = 0;
                    lastLineWasEmpty = false;
                    // Process this line as a regular log
                    const parsed = parseLogLine(line);
                    if (parsed) {
                      sendSSE(controller, 'log', parsed);
                    }
                    continue;
                  } catch (e) {
                    // Continue collecting
                    lastLineWasEmpty = false;
                  }
                }
                
                // Count braces to detect complete JSON
                if (!isEmpty) {
                  const openBraces = (line.match(/{/g) || []).length;
                  const closeBraces = (line.match(/}/g) || []).length;
                  braceCount += openBraces - closeBraces;
                  
                  jsonDataBuffer += line + '\n';
                  lastLineWasEmpty = false;
                  
                  // Check if JSON is complete (brace count is 0 and we have content starting with {)
                  if (braceCount === 0 && jsonDataBuffer.trim().length > 0 && jsonDataBuffer.trim().startsWith('{')) {
                    try {
                      const jsonData = JSON.parse(jsonDataBuffer.trim());
                      sendSSE(controller, 'log', { message: '✅ JSON data parsed successfully!' });
                      sendSSE(controller, 'data', { type: 'complete', data: jsonData });
                      isInJsonBlock = false;
                      jsonDataBuffer = '';
                      braceCount = 0;
                      lastLineWasEmpty = false;
                    } catch (e) {
                      // Continue collecting - JSON might not be complete yet
                      // This can happen if there are trailing characters or incomplete JSON
                    }
                  }
                }
                continue;
              }

              // Parse log line for links and structure
              const parsed = parseLogLine(line);
              if (parsed) {
                sendSSE(controller, 'log', parsed);
              }
            }
          });

          // Stream stderr
          hardhatProcess.stderr.on('data', (data: Buffer) => {
            const text = data.toString();
            if (text.trim()) {
              sendSSE(controller, 'log', { 
                message: text.trim(),
                type: 'stderr'
              });
            }
          });

          // Handle process completion
          hardhatProcess.on('close', (code) => {
            // Try to parse any remaining JSON data
            if (isInJsonBlock && jsonDataBuffer.trim()) {
              try {
                // Try direct parse first
                const jsonData = JSON.parse(jsonDataBuffer.trim());
                sendSSE(controller, 'log', { message: '✅ JSON data parsed successfully!' });
                sendSSE(controller, 'data', { type: 'complete', data: jsonData });
              } catch (e) {
                // Try to extract JSON object from buffer using balanced braces
                let startIdx = jsonDataBuffer.indexOf('{');
                if (startIdx !== -1) {
                  let tempBraceCount = 0;
                  let endIdx = -1;
                  for (let i = startIdx; i < jsonDataBuffer.length; i++) {
                    if (jsonDataBuffer[i] === '{') tempBraceCount++;
                    if (jsonDataBuffer[i] === '}') tempBraceCount--;
                    if (tempBraceCount === 0 && jsonDataBuffer[i] === '}') {
                      endIdx = i;
                      break;
                    }
                  }
                  if (endIdx !== -1) {
                    try {
                      const jsonStr = jsonDataBuffer.substring(startIdx, endIdx + 1);
                      const jsonData = JSON.parse(jsonStr);
                      sendSSE(controller, 'log', { message: '✅ JSON data parsed successfully!' });
                      sendSSE(controller, 'data', { type: 'complete', data: jsonData });
                    } catch (e2) {
                      sendSSE(controller, 'log', { message: '⚠️  Could not parse final JSON data' });
                      sendSSE(controller, 'log', { message: `Debug: ${e2 instanceof Error ? e2.message : 'Unknown error'}` });
                    }
                  } else {
                    sendSSE(controller, 'log', { message: '⚠️  Could not find complete JSON object' });
                    sendSSE(controller, 'log', { message: `Debug: Buffer length: ${jsonDataBuffer.length}, Brace count: ${braceCount}` });
                  }
                } else {
                  sendSSE(controller, 'log', { message: '⚠️  No JSON object found in buffer' });
                }
              }
            }
            
            if (code === 0) {
              sendSSE(controller, 'log', { message: '✅ Process completed successfully!' });
            } else {
              sendSSE(controller, 'error', { 
                message: `Process exited with code ${code}` 
              });
            }
            sendSSE(controller, 'close', {});
          });

          // Handle process errors
          hardhatProcess.on('error', (error: Error) => {
            sendSSE(controller, 'error', { 
              message: `Failed to start process: ${error.message}` 
            });
            sendSSE(controller, 'close', {});
          });

        } catch (error: any) {
          console.error('Attestation error:', error);
          sendSSE(controller, 'error', { 
            message: error.message || 'An error occurred',
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
          });
          sendSSE(controller, 'close', {});
        }
      },
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
