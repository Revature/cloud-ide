"use client";
import React, { useEffect, useState, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Button from "@/components/ui/button/Button";
import { Runner, RunnerState } from '@/types/runner';
import { useQuery } from '@tanstack/react-query';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';

// Import styles for xterm - make sure to add these to your project
// import '@xterm/xterm/css/xterm.css';

const getStateColor = (state: RunnerState) => {
  switch (state) {
    case "active":
      return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
    case "ready":
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400';
    case "awaiting_client":
      return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400';
    case "starting":
      return 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400';
    case "terminated":
    default:
      return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
  }
};

const getStateLabel = (state: RunnerState) => {
  switch (state) {
    case "active":
      return 'Active';
    case "ready":
      return 'Ready';
    case "awaiting_client":
      return 'Awaiting Client';
    case "starting":
      return 'Starting';
    case "terminated":
      return 'Terminated';
    default:
      return state;
  }
};

const RunnerView: React.FC = () => {
  const router = useRouter();
  const params = useParams();
  const runnerId = params.id as string;
  
  // Get runner data from API
  const { data: runner, isLoading, error } = useQuery<Runner>({
    queryKey: ['runner', runnerId],
    queryFn: async () => {
      const response = await fetch(`/frontend-api/cloud-resources/runners/${runnerId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch runner data');
      }
      return response.json();
    },
  });

  const [confirmTerminate, setConfirmTerminate] = useState(false);
  const [terminalVisible, setTerminalVisible] = useState(false);
  const [terminalConnected, setTerminalConnected] = useState(false);
  const terminalRef = useRef<HTMLDivElement>(null);
  const terminalInstance = useRef<Terminal | null>(null);
  const websocketRef = useRef<WebSocket | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);

  const initializeTerminal = () => {
    if (!terminalRef.current || terminalInstance.current) return;

    // Create terminal instance
    const term = new Terminal({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      theme: {
        background: '#1e1e1e',
        foreground: '#f0f0f0',
        cursor: '#ffffff',
      },
      allowTransparency: true,
      scrollback: 1000,
    });

    // Initialize fit addon
    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.loadAddon(new WebLinksAddon());

    // Open terminal in the container
    term.open(terminalRef.current);
    
    // Store references
    terminalInstance.current = term;
    fitAddonRef.current = fitAddon;
    
    // Initial terminal message
    term.writeln('\r\n\x1b[1;34m*** Cloud IDE Terminal ***\x1b[0m');
    term.writeln('Connecting to runner...\r\n');
    
    // Fit terminal to container
    setTimeout(() => {
      fitAddon.fit();
      
      // Set up resize handler
      const resizeObserver = new ResizeObserver(() => {
        if (fitAddonRef.current) {
          fitAddonRef.current.fit();
        }
      });
      
      if (terminalRef.current) {
        resizeObserver.observe(terminalRef.current);
      }
      
      window.addEventListener('resize', () => {
        if (fitAddonRef.current) {
          fitAddonRef.current.fit();
        }
      });
    }, 100);
  };

  const connectToTerminal = () => {
    if (!runner) return;
    
    setTerminalVisible(true);
    
    // Initialize terminal if not already done
    if (!terminalInstance.current) {
      initializeTerminal();
    }
    
    // Connect to WebSocket
    const terminal = terminalInstance.current;
    if (!terminal) return;
    
    // Determine WebSocket URL
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const wsUrl = `${protocol}//${host}/api/v1/runners/connect/${runner.id}`;

    // Close existing connection if any
    if (websocketRef.current) {
      websocketRef.current.close();
    }
    
    // Create new WebSocket connection
    const socket = new WebSocket(wsUrl);
    websocketRef.current = socket;
    
    socket.onopen = () => {
      terminal.writeln('\r\n\x1b[32mConnected to runner.\x1b[0m\r\n');
      setTerminalConnected(true);
      
      // Send terminal size on connection
      if (terminal.cols && terminal.rows) {
        const resizeMessage = JSON.stringify({
          type: 'resize',
          cols: terminal.cols,
          rows: terminal.rows
        });
        socket.send(resizeMessage);
      }
    };
    
    socket.onmessage = (event) => {
      // Handle different message types from server
      try {
        // Check if it's a binary message (most terminal data)
        if (event.data instanceof Blob) {
          event.data.text().then((text: string) => {
            terminal.write(text);
          });
        } else {
          // Handle JSON control messages
          const data = JSON.parse(event.data);
          if (data.type === 'error') {
            terminal.writeln(`\r\n\x1b[31mError: ${data.message}\x1b[0m\r\n`);
          }
        }
      } catch (e) {
        // If it's not JSON, treat as raw terminal data
        terminal.write(event.data);
      }
    };
    
    socket.onclose = (event) => {
      terminal.writeln(`\r\n\x1b[33mConnection closed: ${event.reason || 'Unknown reason'}\x1b[0m\r\n`);
      setTerminalConnected(false);
    };
    
    socket.onerror = (error) => {
      terminal.writeln(`\r\n\x1b[31mWebSocket error\x1b[0m\r\n`);
      console.error('WebSocket error:', error);
    };
    
    // Send user input to server
    terminal.onData((data) => {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(data);
      }
    });
    
    // Send terminal resize events
    terminal.onResize(({ cols, rows }) => {
      if (socket.readyState === WebSocket.OPEN) {
        const resizeMessage = JSON.stringify({
          type: 'resize',
          cols,
          rows
        });
        socket.send(resizeMessage);
      }
    });
  };

  const disconnectTerminal = () => {
    if (websocketRef.current) {
      websocketRef.current.close();
      websocketRef.current = null;
    }
    
    if (terminalInstance.current) {
      terminalInstance.current.writeln('\r\n\x1b[33mDisconnected from runner.\x1b[0m\r\n');
    }
    
    setTerminalConnected(false);
  };

  const toggleTerminal = () => {
    if (terminalVisible) {
      setTerminalVisible(false);
      disconnectTerminal();
    } else {
      connectToTerminal();
    }
  };

  // Clean up terminal and websocket on unmount
  useEffect(() => {
    return () => {
      if (websocketRef.current) {
        websocketRef.current.close();
      }
      
      if (terminalInstance.current) {
        terminalInstance.current.dispose();
      }
    };
  }, []);

  const goBack = () => {
    router.push('/runners');
  };

  const handleTerminate = async () => {
    if (!runner) return;
    
    if (confirmTerminate) {
      try {
        // Disconnect terminal first
        disconnectTerminal();
        
        // Call terminate API
        const response = await fetch(`/frontend-api/cloud-resources/runners/${runner.id}/terminate`, {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
          },
        });
        
        if (!response.ok) {
          throw new Error('Failed to terminate runner');
        }
        
        // Success - wait a moment then redirect to runner list
        setTimeout(() => {
          router.push('/runners');
        }, 1500);
      } catch (error) {
        console.error('Error terminating runner:', error);
      } finally {
        setConfirmTerminate(false);
      }
    } else {
      setConfirmTerminate(true);
    }
  };

  const canConnect = runner?.state === 'active' || runner?.state === 'awaiting_client';
  const canTerminate = runner?.state !== 'terminated';

  if (isLoading) {
    return (
      <div className="flex justify-center">
        <div className="animate-pulse">Loading...</div>
      </div>
    );
  }

  if (error || !runner) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-800 dark:bg-red-900/20 dark:border-red-800/20 dark:text-red-400">
        <h3 className="text-lg font-semibold mb-2">Error Loading Runner</h3>
        <p>Unable to load runner details. Please try again later.</p>
        <Button 
          variant="outline" 
          size="sm"
          onClick={goBack}
          className="mt-4"
        >
          Return to Runners
        </Button>
      </div>
    );
  }

  return (
    <>
      <div className="flex items-center mb-6">
        <Button 
          variant="outline" 
          size="sm"
          onClick={goBack}
          className="mr-4"
        >
          <svg
            className="w-4 h-4 mr-2"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M19 12H5M5 12L12 19M5 12L12 5"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          Back
        </Button>
        <h2 className="text-2xl font-bold text-gray-800 dark:text-white/90">Runner Details</h2>
        <div className="ml-auto flex space-x-3">
          {canConnect && (
            <Button 
              size="sm" 
              variant="secondary"
              onClick={toggleTerminal}
              className={terminalVisible 
                ? "text-yellow-600 bg-yellow-50 hover:bg-yellow-100 dark:text-yellow-400 dark:bg-yellow-900/20 dark:hover:bg-yellow-900/30"
                : "text-blue-600 bg-blue-50 hover:bg-blue-100 dark:text-blue-400 dark:bg-blue-900/20 dark:hover:bg-blue-900/30"
              }
            >
              {terminalVisible ? (
                <>
                  <svg 
                    width="20" 
                    height="20" 
                    viewBox="0 0 24 24" 
                    fill="none" 
                    xmlns="http://www.w3.org/2000/svg"
                    className="stroke-current mr-2"
                  >
                    <path 
                      d="M18 6L6 18M6 6L18 18" 
                      strokeWidth="2" 
                      strokeLinecap="round" 
                      strokeLinejoin="round"
                    />
                  </svg>
                  Disconnect
                </>
              ) : (
                <>
                  <svg 
                    width="20" 
                    height="20" 
                    viewBox="0 0 24 24" 
                    fill="none" 
                    xmlns="http://www.w3.org/2000/svg"
                    className="stroke-current mr-2"
                  >
                    <path 
                      d="M5 12H19M19 12L12 5M19 12L12 19" 
                      strokeWidth="2" 
                      strokeLinecap="round" 
                      strokeLinejoin="round"
                    />
                  </svg>
                  Connect
                </>
              )}
            </Button>
          )}
          {canTerminate && (
            <Button 
              size="sm" 
              variant="destructive"
              onClick={handleTerminate}
            >
              <svg 
                width="20" 
                height="20" 
                viewBox="0 0 24 24" 
                fill="none" 
                xmlns="http://www.w3.org/2000/svg"
                className="stroke-current mr-2"
              >
                <path 
                  d="M18 6L6 18M6 6L18 18" 
                  strokeWidth="2" 
                  strokeLinecap="round" 
                  strokeLinejoin="round"
                />
              </svg>
              {confirmTerminate ? "Confirm Termination" : "Terminate"}
            </Button>
          )}
        </div>
      </div>

      {/* Terminal Section - Visible when connected */}
      {terminalVisible && (
        <div className="mb-6 bg-white dark:bg-white/[0.03] rounded-2xl border border-gray-200 dark:border-white/[0.05] p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90">
              Terminal Connection
            </h3>
            <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
              terminalConnected 
                ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' 
                : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
            }`}>
              {terminalConnected ? 'Connected' : 'Connecting...'}
            </span>
          </div>
          <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
            <div ref={terminalRef} className="h-96 w-full" />
          </div>
        </div>
      )}

      <div className="bg-white dark:bg-white/[0.03] rounded-2xl border border-gray-200 dark:border-white/[0.05] p-6">
        <div className="flex justify-between items-start mb-6">
          <div className="flex items-center gap-4">
            <div>
              <h3 className="text-xl font-semibold text-gray-800 dark:text-white/90">Runner {runner.id}</h3>
              <p className="text-gray-500 dark:text-gray-400">Created on {runner.createdOn}</p>
            </div>
          </div>
          <div className="flex gap-3">
            <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getStateColor(runner.state)}`}>
              {getStateLabel(runner.state)}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 h-full">
          <div className="space-y-6">
            <div>
              <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Basic Information</h4>
              <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4 space-y-4">
                {runner.userId ? (
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-300">User</span>
                    <span className="text-gray-800 dark:text-white">{runner.userId}</span>
                  </div>
                ) : (
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-300">User</span>
                    <span className="text-gray-800 dark:text-white">In pool (no user assigned)</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-300">Key Pair</span>
                  <span className="text-gray-800 dark:text-white">{runner.keyId}</span>
                </div>
                {runner.url && (
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-300">URL</span>
                    <span className="text-gray-800 dark:text-white">{runner.url}</span>
                  </div>
                )}
                {runner.sessionStart && (
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-300">Session Start</span>
                    <span className="text-gray-800 dark:text-white">{runner.sessionStart}</span>
                  </div>
                )}
                {runner.sessionEnd && (
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-300">Session End</span>
                    <span className="text-gray-800 dark:text-white">{runner.sessionEnd}</span>
                  </div>
                )}
              </div>
            </div>

            <div>
              <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Image Information</h4>
              <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4 space-y-4">
                {runner.image ? (
                  <>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-300">Image Name</span>
                      <span className="text-gray-800 dark:text-white">{runner.image.name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-300">Image ID</span>
                      <span className="text-gray-800 dark:text-white">{runner.image.identifier}</span>
                    </div>
                    {runner.image.machine && (
                      <>
                        <div className="flex justify-between">
                          <span className="text-gray-600 dark:text-gray-300">Machine Type</span>
                          <span className="text-gray-800 dark:text-white">{runner.image.machine.name}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600 dark:text-gray-300">Instance Type</span>
                          <span className="text-gray-800 dark:text-white">{runner.image.machine.identifier}</span>
                        </div>
                      </>
                    )}
                  </>
                ) : (
                  <div className="text-gray-600 dark:text-gray-300">Image information not available</div>
                )}
              </div>
            </div>

            <div>
              <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Hardware Configuration</h4>
              <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4 space-y-4">
                {runner.image && runner.image.machine ? (
                  <>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600 dark:text-gray-300">CPU</span>
                      <div className="flex items-center">
                        <span className="text-gray-800 dark:text-white">
                          {runner.image.machine.cpuCount} {runner.image.machine.cpuCount === 1 ? 'Core' : 'Cores'}
                        </span>
                      </div>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600 dark:text-gray-300">Memory</span>
                      <div className="flex items-center">
                        <span className="text-gray-800 dark:text-white">
                          {runner.image.machine.memorySize} GB
                        </span>
                      </div>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600 dark:text-gray-300">Storage</span>
                      <div className="flex items-center">
                        <span className="text-gray-800 dark:text-white">
                          {runner.image.machine.storageSize} GB
                        </span>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="text-gray-600 dark:text-gray-300">Hardware information not available</div>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-col h-full">
            <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Runtime Metrics</h4>
            <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4 flex-grow">
              <div className="flex flex-col h-full">
                <div className="text-center mb-6">
                  <div className="text-4xl text-blue-500 mb-4">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" className="mx-auto h-12 w-12">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <p className="text-lg font-medium text-gray-800 dark:text-white">Runtime Metrics Coming Soon</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                    Detailed performance metrics will be available in a future update.
                  </p>
                </div>
                
                {runner.sessionStart && runner.sessionEnd && (
                  <div className="mt-auto">
                    <h5 className="text-sm font-medium text-gray-600 dark:text-gray-300 mb-3">Session Timeline</h5>
                    
                    <div className="relative mt-6 bg-white dark:bg-gray-700 p-4 rounded-lg">
                      <div className="w-full h-2 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
                        <div className="h-full bg-blue-500 rounded-full" style={{ width: '40%' }}></div>
                      </div>
                      
                      <div className="flex justify-between mt-4">
                        <div className="text-left">
                          <div className="text-xs text-gray-500 dark:text-gray-400">Start</div>
                          <div className="text-sm font-medium text-gray-800 dark:text-white">{runner.sessionStart}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-xs text-gray-500 dark:text-gray-400">End</div>
                          <div className="text-sm font-medium text-gray-800 dark:text-white">{runner.sessionEnd}</div>
                        </div>
                      </div>
                      
                      <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-600">
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-600 dark:text-gray-300">Session Status</span>
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStateColor(runner.state)}`}>
                            {getStateLabel(runner.state)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default RunnerView;