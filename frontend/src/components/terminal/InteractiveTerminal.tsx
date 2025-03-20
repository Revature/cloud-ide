// src/components/terminal/InteractiveTerminal.tsx
/**
 * Interactive Terminal Component
 * 
 * This component provides an xterm.js-based terminal interface with:
 * - Automatic display of pre-defined logs
 * - Interactive input mode after simulation completes
 * - Basic command history navigation (up/down arrows)
 * - Visual feedback for commands
 * - Basic shell command simulation for demo purposes
 * 
 * Usage:
 * <InteractiveTerminal 
 *   logs={logs} 
 *   simulationComplete={simulationComplete}
 *   onCommand={handleCommand}
 *   allowInput={true} 
 * />
 */
"use client";
import React, { useEffect, useRef, useState } from 'react';
import { useXtermModules } from '@/hooks/useXterm';
import useResizeObserver from '@/hooks/useResizeObserver';
import FallbackTerminal from './FallbackTerminal';
import type { Terminal } from '@xterm/xterm';
import type { FitAddon } from '@xterm/addon-fit';

interface InteractiveTerminalProps {
  logs: string[];
  simulationComplete: boolean;
  onCommand?: (command: string) => void;
  allowInput?: boolean;
}

const InteractiveTerminal: React.FC<InteractiveTerminalProps> = ({ 
  logs, 
  simulationComplete = false,
  onCommand,
  allowInput = true 
}) => {
  const terminalRef = useRef<HTMLDivElement>(null);
  const [terminal, setTerminal] = useState<Terminal | null>(null);
  const [fitAddon, setFitAddon] = useState<FitAddon | null>(null);
  const { modules, loading, error } = useXtermModules();
  const [isClient, setIsClient] = useState(false);
  const [lastDisplayedLogIndex, setLastDisplayedLogIndex] = useState(-1);
  
  // Use the resize observer to automatically resize the terminal
  const resizeObserver = useResizeObserver<HTMLDivElement>(() => {
    if (fitAddon) {
      try {
        fitAddon.fit();
      } catch (error) {
        console.error('Error resizing terminal:', error);
      }
    }
  });
  const [inputEnabled, setInputEnabled] = useState(false);
  const [currentCommand, setCurrentCommand] = useState<string>("");
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const promptText = '\r\nroot@cloudide:~# ';

  // Check if we're on client-side
  useEffect(() => {
    setIsClient(true);
  }, []);

  // Initialize terminal
  useEffect(() => {
    if (!isClient) return;
    
    // Check if modules are loaded and terminal element exists
    if (terminalRef.current && modules.xterm && !loading && !error && modules.fitAddon) {
      // Clean up any previous terminal instance
      if (terminal) {
        terminal.dispose();
      }

      try {
        // Create new terminal and fit addon
        const XTerm = modules.xterm.Terminal;
        const FitAddon = modules.fitAddon.FitAddon;
        
        const newTerminal = new XTerm({
          cursorBlink: true,
          fontSize: 14,
          fontFamily: 'Menlo, Monaco, "Courier New", monospace',
          theme: {
            background: '#1e1e1e',
            foreground: '#f0f0f0',
            cursor: '#ffffff',
            selectionBackground: '#4d4d4d',
            black: '#000000',
            red: '#e06c75',
            green: '#98c379',
            yellow: '#e5c07b',
            blue: '#61afef',
            magenta: '#c678dd',
            cyan: '#56b6c2',
            white: '#ffffff',
          },
          allowTransparency: true,
          scrollback: 1000,
        });

        const newFitAddon = new FitAddon();
        newTerminal.loadAddon(newFitAddon);
        
        // Add web links addon if available
        if (modules.webLinksAddon) {
          const WebLinksAddon = modules.webLinksAddon.WebLinksAddon;
          newTerminal.loadAddon(new WebLinksAddon());
        }
        
        // Open the terminal in the container element
        newTerminal.open(terminalRef.current);
        
        // Set the terminal size to fit its container
        setTimeout(() => {
          if (newFitAddon) {
            try {
              newFitAddon.fit();
            } catch (error) {
              console.error('Error fitting terminal:', error);
            }
          }
        }, 100);

        // Setup key event handling
        newTerminal.onKey((e: { key: string; domEvent: KeyboardEvent }) => {
          if (!inputEnabled) return;

          const ev = e.domEvent;
          const printable = !ev.altKey && !ev.ctrlKey && !ev.metaKey;

          if (ev.keyCode === 13) { // Enter key
            // First, write the current command to the terminal
            newTerminal.write('\r\n');
            
            // Process the command using the handler
            handleBasicCommands(currentCommand, newTerminal);
            
            // Also call the external handler if provided
            if (onCommand) {
              onCommand(currentCommand);
            }
            
            // Add to history if not empty
            if (currentCommand.trim() !== '') {
              setCommandHistory(prev => [currentCommand, ...prev].slice(0, 20));
            }
            
            // Reset command and history index
            setCurrentCommand('');
            setHistoryIndex(-1);
            
            // Print new prompt
            newTerminal.write(promptText);
          } else if (ev.keyCode === 8) { // Backspace
            // Do not delete the prompt
            if (currentCommand.length > 0) {
              // Visual feedback for backspace
              newTerminal.write('\b \b');
              setCurrentCommand(prev => prev.slice(0, -1));
            }
          } else if (ev.keyCode === 38) { // Up arrow
            // Navigate command history
            if (commandHistory.length > 0 && historyIndex < commandHistory.length - 1) {
              const newIndex = historyIndex + 1;
              const historyCommand = commandHistory[newIndex];
              
              // Clear current command from terminal
              for (let i = 0; i < currentCommand.length; i++) {
                newTerminal.write('\b \b');
              }
              
              // Write history command
              newTerminal.write(historyCommand);
              setCurrentCommand(historyCommand);
              setHistoryIndex(newIndex);
            }
          } else if (ev.keyCode === 40) { // Down arrow
            // Navigate command history (downward)
            if (historyIndex > 0) {
              const newIndex = historyIndex - 1;
              const historyCommand = commandHistory[newIndex];
              
              // Clear current command from terminal
              for (let i = 0; i < currentCommand.length; i++) {
                newTerminal.write('\b \b');
              }
              
              // Write history command
              newTerminal.write(historyCommand);
              setCurrentCommand(historyCommand);
              setHistoryIndex(newIndex);
            } else if (historyIndex === 0) {
              // Clear current command when at bottom of history
              for (let i = 0; i < currentCommand.length; i++) {
                newTerminal.write('\b \b');
              }
              setCurrentCommand('');
              setHistoryIndex(-1);
            }
          } else if (printable) {
            // Add regular character input with immediate visual feedback
            newTerminal.write(e.key);
            setCurrentCommand(prev => prev + e.key);
          }
        });

        // Store the terminal and fitAddon in state
        setTerminal(newTerminal);
        setFitAddon(newFitAddon);

        // Add resize event listener
        const handleResize = () => {
          if (newFitAddon) {
            try {
              newFitAddon.fit();
            } catch (error) {
              console.error('Error fitting terminal on resize:', error);
            }
          }
        };

        window.addEventListener('resize', handleResize);

        // Initial terminal output
        newTerminal.writeln('\x1b[1;34m*** Interactive Terminal ***\x1b[0m');
        newTerminal.writeln('Type commands after the simulation completes.');
        newTerminal.writeln('');

        // Return cleanup function
        return () => {
          window.removeEventListener('resize', handleResize);
          newTerminal.dispose();
        };
      } catch (error) {
        console.error('Error initializing terminal:', error);
      }
    }
  }, [modules, loading, error, isClient, onCommand, commandHistory, currentCommand, historyIndex, inputEnabled, terminal]);

  // Basic command handler for simulating shell behavior
  const handleBasicCommands = (command: string, terminal: Terminal) => {
    const cmd = command.trim();
    
    if (cmd === '') return;
    
    if (cmd === 'clear' || cmd === 'cls') {
      terminal.clear();
      return;
    }
    
    if (cmd === 'help') {
      terminal.writeln('Available commands:');
      terminal.writeln('  help                 - Show this help message');
      terminal.writeln('  clear                - Clear terminal screen');
      terminal.writeln('  ls                   - List files in current directory');
      terminal.writeln('  pwd                  - Show current directory');
      terminal.writeln('  whoami               - Show current user');
      terminal.writeln('  date                 - Show current date and time');
      terminal.writeln('  echo <message>       - Echo a message');
      terminal.writeln('  apt-get install <pkg> - Simulate package installation');
      terminal.writeln('  npm install <pkg>    - Simulate npm package installation');
      terminal.writeln('  pip install <pkg>    - Simulate pip package installation');
      terminal.writeln('  cat <file>           - Show file contents');
      terminal.writeln('  exit                 - Disable terminal input');
      return;
    }
    
    if (cmd === 'ls') {
      terminal.writeln('Dockerfile  docker-compose.yml  package.json  README.md  src/  node_modules/  requirements.txt  entrypoint.sh');
      return;
    }
    
    if (cmd === 'pwd') {
      terminal.writeln('/app/cloudide');
      return;
    }
    
    if (cmd === 'whoami') {
      terminal.writeln('root');
      return;
    }
    
    if (cmd === 'date') {
      terminal.writeln(new Date().toString());
      return;
    }
    
    if (cmd.startsWith('echo ')) {
      terminal.writeln(cmd.substring(5));
      return;
    }
    
    if (cmd.startsWith('apt-get install ') || cmd.startsWith('apt install ')) {
      const packageName = cmd.includes('apt-get') ? cmd.substring(16).trim() : cmd.substring(12).trim();
      if (!packageName) {
        terminal.writeln('Usage: apt-get install <package-name>');
        return;
      }
      
      terminal.write('\x1b[36m'); // Cyan color
      terminal.writeln(`Reading package lists... Done`);
      terminal.writeln(`Building dependency tree... Done`);
      terminal.writeln(`Reading state information... Done`);
      terminal.writeln(`The following NEW packages will be installed:`);
      terminal.writeln(`  ${packageName}`);
      terminal.writeln(`0 upgraded, 1 newly installed, 0 to remove and 0 not upgraded.`);
      terminal.writeln(`Need to get 5,456 kB of archives.`);
      terminal.writeln(`After this operation, 27.2 MB of additional disk space will be used.`);
      terminal.writeln(`Get:1 http://archive.ubuntu.com/ubuntu focal/main amd64 ${packageName}`);
      terminal.writeln(`Fetched 5,456 kB in 2s (2,728 kB/s)`);
      terminal.writeln(`Selecting previously unselected package ${packageName}.`);
      terminal.writeln(`(Reading database ... 123456 files and directories currently installed.)`);
      terminal.writeln(`Preparing to unpack .../packages/${packageName}.deb ...`);
      terminal.writeln(`Unpacking ${packageName} ...`);
      terminal.writeln(`Setting up ${packageName} ...`);
      terminal.writeln(`Processing triggers for man-db ...`);
      terminal.write('\x1b[32m'); // Green color
      terminal.writeln(`${packageName} has been successfully installed.`);
      terminal.write('\x1b[0m'); // Reset color
      return;
    }
    
    if (cmd.startsWith('npm install ')) {
      const packageName = cmd.substring(12).trim();
      if (!packageName) {
        terminal.writeln('Usage: npm install <package-name>');
        return;
      }
      
      terminal.write('\x1b[36m'); // Cyan color
      terminal.writeln(`npm notice created a lockfile as package-lock.json. You should commit this file.`);
      terminal.writeln(`npm WARN deprecated ${packageName}@1.2.3: This version has been deprecated`);
      terminal.writeln(`npm WARN saveError ENOENT: no such file or directory, open '/app/cloudide/package.json'`);
      terminal.writeln(`npm notice`);
      terminal.writeln(`added 1 package, and audited 2 packages in 2s`);
      terminal.writeln(`found 0 vulnerabilities`);
      terminal.write('\x1b[32m'); // Green color
      terminal.writeln(`+ ${packageName}@4.5.6`);
      terminal.write('\x1b[0m'); // Reset color
      return;
    }
    
    if (cmd.startsWith('pip install ')) {
      const packageName = cmd.substring(12).trim();
      if (!packageName) {
        terminal.writeln('Usage: pip install <package-name>');
        return;
      }
      
      terminal.write('\x1b[36m'); // Cyan color
      terminal.writeln(`Collecting ${packageName}`);
      terminal.writeln(`  Downloading ${packageName.toLowerCase()}-2.1.0.tar.gz (232 kB)`);
      terminal.writeln(`     |████████████████████████████████| 232 kB 6.4 MB/s`);
      terminal.writeln(`Building wheels for collected packages: ${packageName}`);
      terminal.writeln(`  Building wheel for ${packageName} (setup.py) ... done`);
      terminal.writeln(`  Created wheel for ${packageName}: filename=${packageName.toLowerCase()}-2.1.0-py3-none-any.whl`);
      terminal.writeln(`  Stored in directory: /root/.cache/pip/wheels/`);
      terminal.writeln(`Successfully built ${packageName}`);
      terminal.writeln(`Installing collected packages: ${packageName}`);
      terminal.write('\x1b[32m'); // Green color
      terminal.writeln(`Successfully installed ${packageName}-2.1.0`);
      terminal.write('\x1b[0m'); // Reset color
      return;
    }
    
    if (cmd.startsWith('cat ')) {
      const fileName = cmd.substring(4).trim();
      if (!fileName) {
        terminal.writeln('Usage: cat <file-name>');
        return;
      }
      
      // Simulate content for common files
      if (fileName === 'Dockerfile') {
        terminal.writeln('FROM ubuntu:20.04');
        terminal.writeln('WORKDIR /app');
        terminal.writeln('RUN apt-get update && apt-get install -y \\');
        terminal.writeln('    python3 python3-pip nodejs npm');
        terminal.writeln('COPY . .');
        terminal.writeln('RUN pip install -r requirements.txt');
        terminal.writeln('CMD ["./entrypoint.sh"]');
      } else if (fileName === 'package.json') {
        terminal.writeln('{');
        terminal.writeln('  "name": "cloudide",');
        terminal.writeln('  "version": "1.0.0",');
        terminal.writeln('  "description": "Cloud IDE image build",');
        terminal.writeln('  "main": "index.js",');
        terminal.writeln('  "scripts": {');
        terminal.writeln('    "start": "node index.js"');
        terminal.writeln('  },');
        terminal.writeln('  "dependencies": {}');
        terminal.writeln('}');
      } else if (fileName === 'requirements.txt') {
        terminal.writeln('flask==2.0.1');
        terminal.writeln('numpy==1.21.2');
        terminal.writeln('pandas==1.3.3');
      } else if (fileName === 'entrypoint.sh') {
        terminal.writeln('#!/bin/bash');
        terminal.writeln('echo "Starting Cloud IDE services..."');
        terminal.writeln('python3 -m http.server 8080 &');
        terminal.writeln('node index.js');
      } else {
        terminal.write('\x1b[31m'); // Red text
        terminal.writeln(`cat: ${fileName}: No such file or directory`);
        terminal.write('\x1b[0m'); // Reset color
      }
      return;
    }
    
    if (cmd === 'exit') {
      terminal.writeln('Disabling terminal input...');
      setInputEnabled(false);
      return;
    }
    
    // Command not recognized
    terminal.write('\x1b[31m'); // Red text
    terminal.writeln(`bash: ${cmd}: command not found`);
    terminal.write('\x1b[0m'); // Reset color
  };

  // Enable input when simulation completes
  useEffect(() => {
    if (simulationComplete && allowInput && terminal) {
      setInputEnabled(true);
      terminal.write(promptText);
    }
  }, [simulationComplete, allowInput, terminal]);

  // Write logs to the terminal
  // Replace the logs useEffect with this version
  useEffect(() => {
    if (terminal && logs.length > 0) {
      // Find the new logs that haven't been displayed yet
      const newLogs = logs.slice(lastDisplayedLogIndex + 1);
      
      // Process and display each new log
      for (const logEntry of newLogs) {
        // Process command coloring - commands starting with $ get a special color
        if (logEntry.startsWith('$ ')) {
          terminal.write('\x1b[33m'); // Yellow color for commands
          terminal.write(logEntry.substring(0, 2));
          terminal.write('\x1b[0m'); // Reset color
          terminal.writeln(logEntry.substring(2));
        } 
        // Process progress indicators
        else if (logEntry.includes('Progress:')) {
          terminal.write('\x1b[36m'); // Cyan for progress
          terminal.writeln(logEntry);
          terminal.write('\x1b[0m'); // Reset color
        }
        // Success messages (completed or success)
        else if (logEntry.includes('[SUCCESS]') || logEntry.includes('successfully') || logEntry.includes('complete')) {
          terminal.write('\x1b[32m'); // Green for success
          terminal.writeln(logEntry);
          terminal.write('\x1b[0m'); // Reset color
        }
        // Error messages
        else if (logEntry.includes('error') || logEntry.includes('fail')) {
          terminal.write('\x1b[31m'); // Red for errors
          terminal.writeln(logEntry);
          terminal.write('\x1b[0m'); // Reset color
        }
        // Default text
        else {
          terminal.writeln(logEntry);
        }
      }
      
      // Update the last displayed log index
      setLastDisplayedLogIndex(logs.length - 1);
    }
  }, [logs, terminal, lastDisplayedLogIndex]);

  // Display loading state or error
  if (!isClient || loading) {
    return (
      <div className="h-96 w-full rounded-lg bg-gray-800 p-4 font-mono text-gray-300 animate-pulse">
        Loading terminal...
      </div>
    );
  }

  if (error || !modules.xterm) {
    return <FallbackTerminal logs={logs} />;
  }

  return (
    <div className="relative h-96 w-full rounded-lg overflow-hidden">
      <div 
        ref={(el) => {
          // Set both our local ref and the resize observer ref
          if (terminalRef.current !== el) {
            terminalRef.current = el;
          }
          resizeObserver.ref(el);
        }} 
        className="h-full w-full" 
      />
      {inputEnabled && (
        <div className="absolute bottom-2 right-2 bg-gray-700 text-gray-300 px-2 py-1 rounded text-xs opacity-70">
          Interactive mode enabled
        </div>
      )}
    </div>
  );
};

export default InteractiveTerminal;