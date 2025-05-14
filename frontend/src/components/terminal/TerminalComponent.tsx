"use client";
import { useRunnerById } from '@/hooks/type-query/useRunners';
import React, { useEffect, useState, useRef } from 'react';

// Export the props interface so it can be imported by parent components
export interface TerminalComponentProps {
  runnerId: number;
  onConnectionChange?: (connected: boolean) => void;
  onError?: (error: string) => void;
}

// Define proper interfaces for Terminal and its addons
interface ITerminalSize {
  cols: number;
  rows: number;
}

interface ITerminal {
  open: (container: HTMLElement) => void;
  writeln: (text: string) => void;
  write: (text: string) => void;
  onData: (callback: (data: string) => void) => void;
  onResize: (callback: (size: ITerminalSize) => void) => void;
  dispose: () => void;
  loadAddon: (addon: ITerminalAddon) => void;
  cols: number;
  rows: number;
}

interface ITerminalAddon {
  activate: (terminal: ITerminal) => void;
}

interface IFitAddon extends ITerminalAddon {
  fit: () => void;
}

const TerminalComponent: React.FC<TerminalComponentProps> = ({
  runnerId,
  onConnectionChange,
  onError,
}) => {
  const terminalRef = useRef<HTMLDivElement>(null);
  const terminalInstance = useRef<ITerminal | null>(null);
  const websocketRef = useRef<WebSocket | null>(null);
  const fitAddonRef = useRef<IFitAddon | null>(null);
  const [initialized, setInitialized] = useState(false);
  const { refetch } = useRunnerById(runnerId); 
  
  // Initialize terminal when component mounts
  useEffect(() => {
    let isActive = true;

    const initializeTerminal = async () => {
      if (!terminalRef.current || terminalInstance.current) return;

      try {
        // Dynamically import terminal modules
        const xtermModule = await import('@xterm/xterm');
        const fitAddonModule = await import('@xterm/addon-fit');
        const webLinksAddonModule = await import('@xterm/addon-web-links');

        // Create terminal
        const terminal = new xtermModule.Terminal({
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

        // Add addons
        const fitAddon = new fitAddonModule.FitAddon();
        terminal.loadAddon(fitAddon);
        terminal.loadAddon(new webLinksAddonModule.WebLinksAddon());

        // Open terminal
        terminal.open(terminalRef.current);
        
        // Store references with proper typing
        terminalInstance.current = terminal as unknown as ITerminal;
        fitAddonRef.current = fitAddon as unknown as IFitAddon;

        // Initial message
        terminal.writeln('\r\n\x1b[1;34m*** Cloud IDE Terminal ***\x1b[0m');
        terminal.writeln('Initializing terminal...\r\n');

        // Fit terminal to container
        setTimeout(() => {
          if (isActive) {
            fitAddon.fit();
            
            // Set up resize handler
            if (typeof ResizeObserver !== 'undefined') {
              const resizeObserver = new ResizeObserver(() => {
                if (fitAddonRef.current) {
                  fitAddonRef.current.fit();
                }
              });
              
              if (terminalRef.current) {
                resizeObserver.observe(terminalRef.current);
              }
            }
            
            window.addEventListener('resize', () => {
              if (fitAddonRef.current) {
                fitAddonRef.current.fit();
              }
            });

            setInitialized(true);
          }
        }, 100);

      } catch (error) {
        console.error('Error initializing terminal:', error);
        if (onError) onError(`Failed to initialize terminal: ${error instanceof Error ? error.message : String(error)}`);
      }
    };

    initializeTerminal();

    // Cleanup
    return () => {
      isActive = false;
      disconnectTerminal();
    };
  }, []);

  // Connect to websocket when terminal is initialized
  useEffect(() => {
    if (initialized && terminalInstance.current) {
      connectToTerminal();
    }
    
    // Cleanup on unmount
    return () => {
      disconnectTerminal();
    };
  }, [initialized, runnerId]);
  
  const connectToTerminal = async () => {
    const terminal = terminalInstance.current;
    if (!terminal) return;

    terminal.writeln('Connecting to runner...\r\n');
    

    // Construct proper absolute WebSocket URL
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const deploymentUrl = window.location.protocol === "https:" ? process.env["NEXT_PUBLIC_DEPLOYMENT_URL"] : "localhost:8000";

    try {
      // Fetch runner data to get the terminal token
      const runner = await refetch();
      const terminalToken = runner.data?.terminalToken;

      if (!terminalToken) {
        throw new Error('Failed to retrieve terminal token.');
      }

      // Construct WebSocket URL with terminal token
      const wsUrl = `${wsProtocol}//${deploymentUrl}/api/v1/runners/connect/${runnerId}?terminal_token=${terminalToken}`;
      console.log(`Connecting to WebSocket: ${wsUrl}`);

    
      // Close existing connection if any
      disconnectTerminal();
      
      // Create new WebSocket connection
      console.log('Creating new WebSocket connection...');
      console.log('WebSocket URL:', wsUrl);
      
      const socket = new WebSocket(wsUrl);
      console.log(socket);
      websocketRef.current = socket;
      console.log(websocketRef);

      socket.onopen = () => {
        console.log('WebSocket connection established');
        terminal.writeln('\r\n\x1b[32mConnected to runner.\x1b[0m\r\n');
        
        if (onConnectionChange) onConnectionChange(true);
        
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
        try {
          // Handle binary data
          if (event.data instanceof Blob) {
            event.data.text().then((text: string) => {
              terminal.write(text);
            });
            return;
          }
          
          // Try to parse as JSON for control messages
          try {
            const data = JSON.parse(event.data);
            if (data.type === 'error') {
              terminal.writeln(`\r\n\x1b[31mError: ${data.message}\x1b[0m\r\n`);
              if (onError) onError(data.message);
            }
          } catch (e) {
            // Not JSON, treat as raw terminal data
            terminal.write(event.data);
            console.log('Raw terminal data received:', e);
          }
        } catch (error) {
          console.error('Error handling WebSocket message:', error);
        }
      };
      
      socket.onclose = (event) => {
        console.log(`WebSocket closed: ${event.code} - ${event.reason || 'No reason'}`);
        terminal.writeln(`\r\n\x1b[33mConnection closed: ${event.reason || 'Unknown reason'} (${event.code})\x1b[0m\r\n`);
        
        if (onConnectionChange) onConnectionChange(false);
        
        if (event.code !== 1000 && event.code !== 1001) {
          // Not normal closure
          if (onError) onError(`Connection closed (${event.code}): ${event.reason || 'Server disconnected'}`);
        }
      };
      
      socket.onerror = (error) => {
        console.error('WebSocket error:', error);
        terminal.writeln(`\r\n\x1b[31mWebSocket error\x1b[0m\r\n`);
        
        if (onError) onError('Failed to connect to terminal server. Please check your network and try again.');
      };
      
      // Send user input to server
      // Create an input buffer
    let inputBuffer = '';
    
    // Send user input to server
    terminal.onData((data: string) => {
      if (socket.readyState === WebSocket.OPEN) {
        // Check if this is a printable character
        if (data.length === 1 && data.charCodeAt(0) >= 32 && data.charCodeAt(0) <= 126) {
          // Add to buffer and echo locally
          inputBuffer += data;
          terminal.write(data); // Echo locally
        } 
        // Enter key (carriage return)
        else if (data === '\r' || data === '\n') {
          // Send the buffered command with newline
          socket.send(inputBuffer + '\n');
          console.log('Sending buffered command:', inputBuffer);
          
          // Clear the buffer
          inputBuffer = '';
          
          // Echo the newline
          terminal.write('\r\n');
        }
        // Backspace
        else if (data === '\b' || data === '\x7f') {
          if (inputBuffer.length > 0) {
            // Remove last character from buffer
            inputBuffer = inputBuffer.slice(0, -1);
            
            // Echo backspace (move cursor back, write space, move cursor back again)
            terminal.write('\b \b');
          }
        }
        // Other control characters (Ctrl+C, etc.) - send directly
        else {
          socket.send(data);
        }
      }
    });
      
      // Send terminal resize events
      terminal.onResize((size: ITerminalSize) => {
        if (socket.readyState === WebSocket.OPEN) {
          const resizeMessage = JSON.stringify({
            type: 'resize',
            cols: size.cols,
            rows: size.rows
          });
          socket.send(resizeMessage);
        }
      });
      
    } catch (error) {
      console.error('Error establishing WebSocket connection:', error);
      terminal.writeln(`\r\n\x1b[31mError connecting to terminal: ${error instanceof Error ? error.message : String(error)}\x1b[0m\r\n`);
      
      if (onError) onError(`Failed to establish connection: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const disconnectTerminal = () => {
    if (websocketRef.current) {
      if (websocketRef.current.readyState === WebSocket.OPEN) {
        websocketRef.current.close(1000, 'User disconnected');
      } else {
        websocketRef.current.close();
      }
      websocketRef.current = null;
    }
    
    if (terminalInstance.current) {
      terminalInstance.current.writeln('\r\n\x1b[33mDisconnected from runner.\x1b[0m\r\n');
    }
    
    if (onConnectionChange) onConnectionChange(false);
  };

  return (
    <div className="h-full w-full" ref={terminalRef}></div>
  );
};

export default TerminalComponent;