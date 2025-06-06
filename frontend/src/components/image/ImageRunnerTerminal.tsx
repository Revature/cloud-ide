"use client";

import React, { useState, useCallback } from "react";
// Import the shared component and its props
import dynamic from "next/dynamic";
import { TerminalComponentProps } from "../terminal/TerminalComponent";

// Import terminal component with ssr: false to prevent server-side rendering
const TerminalComponent = dynamic<TerminalComponentProps>(
  () => import('../terminal/TerminalComponent'),
  { ssr: false }
);

// Props required by this Host/Wrapper component
export interface ImageRunnerTerminalProps {
  runnerId: number; // The ID needed by TerminalComponent
  onInteractionComplete: () => void; // Callback for when the workflow should proceed
  onWorkflowError?: (error: string) => void; // Optional: Propagate errors if needed by the workflow container
}

const ImageRunnerTerminal: React.FC<ImageRunnerTerminalProps> = ({
  runnerId,
  onInteractionComplete,
  onWorkflowError,
}) => {
  const [isConnected, setIsConnected] = useState(false);
  const [internalError, setInternalError] = useState<string | null>(null);

  // Callback for TerminalComponent's connection status changes
  const handleConnectionChange = useCallback(
    (connected: boolean) => {
      console.log(
        `ImageFormWithTerminal: Connection status from TerminalComponent = ${connected}`
      );
      setIsConnected(connected);

      if (!connected && isConnected) {
        console.log(
          "ImageFormWithTerminal: Inferring interaction complete due to disconnection."
        );
      }
    },
    [isConnected]
  );

  // Callback for TerminalComponent's errors
  const handleError = useCallback(
    (error: string) => {
      console.error(
        `ImageFormWithTerminal: Error received from TerminalComponent = ${error}`
      );
      setInternalError(error);
      if (onWorkflowError) {
        onWorkflowError(error); // Pass the error up to the workflow container
      }
    },
    [onWorkflowError]
  );

  // Handle the "Continue" button click
  const handleUserContinue = () => {
    console.log(
      "ImageFormWithTerminal: User clicked 'Continue', triggering interaction complete."
    );
    onInteractionComplete();
  };

  return (
    <div className="mb-6 bg-gray-50 dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90">
          Interactive Session
        </h3>
        <div>
          {!isConnected && !internalError && (
            <span className="ml-4 text-gray-600 dark:text-gray-400">
              Status: Connecting...
            </span>
          )}
          {isConnected && (
            <span className="ml-4 text-green-600 dark:text-green-400">
              Status: Connected
            </span>
          )}
        </div>
      </div>

      {/* Display error if any */}
      {internalError && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800 dark:bg-red-900/20 dark:border-red-800/20 dark:text-red-400">
          <div className="flex items-start">
            <svg
              className="w-4 h-4 mt-0.5 mr-2 flex-shrink-0"
              viewBox="0 0 24 24"
              fill="none"
            >
              <path
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span>{internalError}</span>
          </div>
        </div>
      )}

      {/* Terminal Container */}
        <div className="h-96 w-full bg-gray-50 dark:bg-gray-900">
          <TerminalComponent
            key={runnerId}
            runnerId={runnerId}
            onConnectionChange={handleConnectionChange}
            onError={handleError}
          />
        </div>

      {/* Continue Button */}
      
      <div className="mt-4 flex items-right justify-end">
        <button
          onClick={handleUserContinue}
          disabled={!!internalError} // Disable if there was an error
          className={`px-4 py-2 rounded-lg text-white ${
            internalError
              ? "bg-gray-400 cursor-not-allowed"
              : "bg-blue-500 hover:bg-blue-600 dark:bg-blue-600 dark:hover:bg-blue-700"
          }`}
        >
          Create Image
        </button>
      </div>
    </div>
  );
};

export default ImageRunnerTerminal;