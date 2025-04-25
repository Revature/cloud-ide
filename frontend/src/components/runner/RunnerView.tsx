"use client";
import React, { useState, useEffect, useRef } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import Button from "@/components/ui/button/Button";
import { RunnerState } from '@/types/runner';
import dynamic from 'next/dynamic';

// Import the props interface from the terminal component
import type { TerminalComponentProps } from '../terminal/TerminalComponent';
import { useRunnerQuery } from '@/hooks/api/runners/useRunnersData';
import { runnersApi } from '@/services/cloud-resources/runners';

// Import terminal component with ssr: false to prevent server-side rendering
// Use the imported props type with dynamic import
const TerminalComponent = dynamic<TerminalComponentProps>(
  () => import('../terminal/TerminalComponent'),
  { ssr: false }
);

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
    case "runner_starting":
      return 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400';
    case "ready_claimed":
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400';
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
    case "runner_starting":
      return 'Starting';
    case "ready_claimed":
      return 'Ready';
    case "terminated":
      return 'Terminated';
    default:
      return state;
  }
};

const RunnerView: React.FC = () => {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const runnerId = params.id as string;
  const autoConnect = searchParams.get('autoConnect') === 'true';

  const { data: runner, isLoading, error } = useRunnerQuery(Number(runnerId));

  const [terminalVisible, setTerminalVisible] = useState(false);
  const [terminalConnected, setTerminalConnected] = useState(false);
  const [terminalError, setTerminalError] = useState<string | null>(null);
  const [confirmTerminate, setConfirmTerminate] = useState(false);
  const [isTerminating, setIsTerminating] = useState(false);
  const [uiMessage, setUiMessage] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const autoConnectExecutedRef = useRef(false);

  useEffect(() => {
    if (autoConnect && !autoConnectExecutedRef.current) {
      setTerminalVisible(true);
      autoConnectExecutedRef.current = true; // Ensure this runs only once
    }
  }, [autoConnect]);

  const toggleTerminal = () => {
    if (terminalVisible) {
      setTerminalVisible(false);
      setTerminalConnected(false);
    } else {
      setTerminalVisible(true);
    }
  };

  const handleTerminalConnectionChange = (connected: boolean) => {
    setTerminalConnected(connected);
  };

  const handleTerminalError = (error: string) => {
    setTerminalError(error);
    console.error("Terminal error:", error);
  };

  const goBack = () => {
    router.push('/runners');
  };

  const handleTerminate = async () => {
    if (!runner) return;

    if (confirmTerminate) {
      setIsTerminating(true);
      setUiMessage(null); // Clear any previous messages
      try {
        await runnersApi.terminate(runner.id);
        setUiMessage({ type: 'success', message: `Runner with ID ${runner.id} terminated successfully.` });
        router.push('/runners'); // Redirect to the runners list
      } catch (error) {
        console.error('Error terminating runner:', error);
        setUiMessage({ type: 'error', message: `Failed to terminate runner with ID ${runner.id}.` });
      } finally {
        setIsTerminating(false);
        setConfirmTerminate(false);
      }
    } else {
      setConfirmTerminate(true);
    }
  };

  const canConnect = runner?.state === 'active' || runner?.state === 'awaiting_client' || runner?.state === 'ready' || runner?.state === 'ready_claimed' || runner?.state === 'starting' || runner?.state === 'runner_starting';
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
              disabled={isTerminating}
            >
              {isTerminating ? (
                <div className="flex items-center">
                  <svg
                    className="animate-spin h-4 w-4 mr-2"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  Terminating
                </div>
              ) : (
                confirmTerminate ? "Confirm Termination" : "Terminate"
              )}
            </Button>
          )}
        </div>
      </div>

      {/* UI Message Section */}
      {uiMessage && (
        <div
          className={`p-4 rounded-lg ${
            uiMessage.type === 'success'
              ? 'bg-green-50 text-green-800 border border-green-200'
              : 'bg-red-50 text-red-800 border border-red-200'
          }`}
        >
          {uiMessage.message}
        </div>
      )}

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
          
          {terminalError && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800 dark:bg-red-900/20 dark:border-red-800/20 dark:text-red-400">
              <div className="flex items-start">
                <svg className="w-4 h-4 mt-0.5 mr-2 flex-shrink-0" viewBox="0 0 24 24" fill="none">
                  <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" 
                    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span>{terminalError}</span>
              </div>
            </div>
          )}
          
          <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
            <div className="h-96 w-full">
              <TerminalComponent 
                runnerId={parseInt(runnerId)} 
                onConnectionChange={handleTerminalConnectionChange}
                onError={handleTerminalError}
              />
            </div>
          </div>
        </div>
      )}

      <div className="bg-white dark:bg-white/[0.03] rounded-2xl border border-gray-200 dark:border-white/[0.05] p-6">
        {/* Runner details section remains the same */}
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
          {/* Rest of the component remains the same */}
          {/* ... */}
        </div>
      </div>
    </>
  );
};

export default RunnerView;