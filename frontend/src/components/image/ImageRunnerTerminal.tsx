"use client";

import React, { useState, useCallback } from 'react';
// Import the shared component and its props
import TerminalComponent from '../terminal/TerminalComponent'; // Adjust path as needed

// Props required by this Host/Wrapper component from the
export interface ImageRunnerTerminalalProps {
  runnerId: number; // The ID needed by TerminalComponent
  onInteractionComplete: () => void; // Callback for when the workflow should proceed
  // Optional: Propagate errors if needed by the workflow container
  onWorkflowError?: (error: string) => void;
}

const ImageRunnerTerminal: React.FC<ImageRunnerTerminalalProps> = ({
  runnerId,
  onInteractionComplete,
  onWorkflowError,
}) => {
  const [isConnected, setIsConnected] = useState(false);
  const [internalError, setInternalError] = useState<string | null>(null);

  // Callback for TerminalComponent's connection status changes
  const handleConnectionChange = useCallback((connected: boolean) => {
    console.log(`ImageFormWithTerminal: Connection status from TerminalComponent = ${connected}`);
    setIsConnected(connected);

    if (!connected && isConnected) { // Check previous state to avoid triggering initially
      console.log('ImageFormWithTerminal: Inferring interaction complete due to disconnection.');
      // TODO: Delay this slightly? Check error state?
      // Decide if *any* disconnection means the step is complete.
      // onInteractionComplete(); // <--- Uncomment to use this strategy
    }
    // --- End Strategy A ---

  }, [isConnected]); // Added isConnected dependency

  // Callback for TerminalComponent's errors
  const handleError = useCallback((error: string) => {
    console.error(`ImageFormWithTerminal: Error received from TerminalComponent = ${error}`);
    setInternalError(error);
    if (onWorkflowError) {
      onWorkflowError(error); // Pass the error up to the workflow container
    }
    // Potentially trigger workflow exit on certain errors
    // e.g., if (error.includes('authentication failed')) onInteractionComplete();
  }, [onWorkflowError]);

  // --- Strategy B: External "Continue" Button ---
  // This button is controlled by this host/wrapper, not the inner TerminalComponent.
  // It relies on the *user* deciding they are done.
  const handleUserContinue = () => {
     console.log("ImageFormWithTerminal: User clicked 'Continue', triggering interaction complete.");
     // We ideally might want to tell TerminalComponent to disconnect here,
     // but it doesn't expose a disconnect method via props. It will disconnect on unmount.
     onInteractionComplete();
  }
  // --- End Strategy B ---


  return (
    <div style={{ border: '1px solid # BDBDBD', padding: '1rem', backgroundColor: '#f5f5f5' }}>
      <h3 style={{ marginTop: 0 }}>Interactive Session</h3>
      {internalError && <p style={{ color: 'red', border: '1px solid red', padding: '0.5rem' }}>Terminal Error: {internalError}</p>}

      {/* Container for the actual TerminalComponent */}
      <div style={{ height: '450px', width: '100%', marginBottom: '1rem', border: '1px solid #ccc' }}>
        <TerminalComponent
          // Use runnerId as key to force reinitialization if the ID changes
          // Might be important if the user could switch runners within the same workflow instance
          key={runnerId}
          runnerId={runnerId}
          onConnectionChange={handleConnectionChange}
          onError={handleError}
        />
      </div>

      {/* Render Strategy B: External Continue Button */}
      {/* Show button only when connected? Or always? Depends on workflow. */}
      {/* You might want to disable it if internalError is set */}
      <div>
          <button
            onClick={handleUserContinue}
            disabled={!!internalError} // Disable if there was an error
            style={{ padding: '8px 15px', cursor: 'pointer' }}
           >
             Continue to Final Submission
           </button>
           {!isConnected && !internalError && <span style={{marginLeft: '1rem'}}>Status: Connecting...</span>}
           {isConnected && <span style={{marginLeft: '1rem', color: 'green'}}>Status: Connected</span>}
      </div>

    </div>
  );
};

export default ImageRunnerTerminal;