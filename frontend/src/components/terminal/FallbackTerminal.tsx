// src/components/terminal/FallbackTerminal.tsx
import React from 'react';

interface TerminalProps {
  logs: string[];
}

const FallbackTerminal: React.FC<TerminalProps> = ({ logs }) => {
  return (
    <div className="h-96 w-full rounded-lg overflow-auto bg-gray-900 p-4 font-mono text-sm text-white">
      {logs.map((log, index) => (
        <div key={index} className="mb-1">
          {log}
        </div>
      ))}
    </div>
  );
};

export default FallbackTerminal;