"use client";
import Button from "@/components/ui/button/Button";
import dynamic from 'next/dynamic';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

// Import the props interface from the terminal component
import type { TerminalComponentProps } from '../terminal/TerminalComponent';
import StatusBadge from "../ui/badge/StatusBadge";
import { useRunnerById, useTerminateRunner } from "@/hooks/type-query/useRunners";
import MetricSpeedometer from "../metric-chart/metric-speedometer";

// Import terminal component with ssr: false to prevent server-side rendering
const TerminalComponent = dynamic<TerminalComponentProps>(
  () => import('../terminal/TerminalComponent'),
  { ssr: false }
);


const RunnerView: React.FC = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const params = useParams();
  const runnerId = params.id as string;
  const autoConnect = searchParams.get('autoConnect') === 'true';
  const cloudIdeUrl = searchParams.get('url'); // Extract the URL from query parameters

  const { data: runner, isLoading, error } = useRunnerById(Number(runnerId));
  const { mutateAsync: terminateRunner } = useTerminateRunner();

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
        await terminateRunner(runner.id);
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
      <div className="flex flex-col items-center">
        <p className="text-red-500 dark:text-red-400 mb-4">
          {error ? `Error loading data: ${error instanceof Error ? error.message : 'Unknown error'}` : 'Runner not found'}
        </p>
        <Button onClick={goBack}>Back to Runners</Button>
      </div>
    );
  }

  return (
    <>
      <div className="relative">
        {/* Buttons Container */}
      <div className="flex justify-end items-start mb-6">
      <div className="flex space-x-3">
        {cloudIdeUrl && (
          <Button
            size="sm"
            variant="secondary"
            onClick={() => window.open(cloudIdeUrl, '_blank')}
            className="text-green-600 bg-green-50 hover:bg-green-100 dark:text-green-400 dark:bg-green-900/20 dark:hover:bg-green-900/30"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth="1.5"
              stroke="currentColor"
              className="size-6"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="m6.75 7.5 3 2.25-3 2.25m4.5 0h3m-9 8.25h13.5A2.25 2.25 0 0 0 21 18V6a2.25 2.25 0 0 0-2.25-2.25H5.25A2.25 2.25 0 0 0 3 6v12a2.25 2.25 0 0 0 2.25 2.25Z"
              />
            </svg>
            Open Cloud IDE
          </Button>
        )}
        {canConnect && (
          <Button
            size="sm"
            variant="secondary"
            onClick={toggleTerminal}
            className={
              terminalVisible
                ? "text-yellow-600 bg-yellow-50 hover:bg-yellow-100 dark:text-yellow-400 dark:bg-yellow-900/20 dark:hover:bg-yellow-900/30"
                : "text-blue-600 bg-blue-50 hover:bg-blue-100 dark:text-blue-400 dark:bg-blue-900/20 dark:hover:bg-blue-900/30"
            }
          >
            {terminalVisible ? <>Disconnect</> : <>Connect</>}
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
              <div className="flex items-center">Terminating</div>
            ) : confirmTerminate ? (
              "Confirm Termination"
            ) : (
              "Terminate"
            )}
          </Button>
        )}
      </div>
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

      {/* Terminal Section */}
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

      {/* Runner Details Section */}
      <div className="bg-white dark:bg-white/[0.03] rounded-2xl border border-gray-200 dark:border-white/[0.05] p-6">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h3 className="text-xl font-semibold text-gray-800 dark:text-white/90">Runner Information</h3>
            <p className="text-gray-500 dark:text-gray-400">ID: {runner.id}</p>
          </div>
          <StatusBadge status={runner.state} />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
          {/* Basic Information */}
          <div className="flex flex-col h-full">
            <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Basic Information</h4>
            <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4 flex-1 flex flex-col justify-between">
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-300">State</span>
                <StatusBadge status={runner.state} />
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-300">Created On</span>
                <span className="text-gray-800 dark:text-white">{runner.createdOn}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-300">Session Start</span>
                <span className="text-gray-800 dark:text-white">{runner.sessionStart || 'N/A'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-300">Session End</span>
                <span className="text-gray-800 dark:text-white">{runner.sessionEnd || 'N/A'}</span>
              </div>
            </div>
          </div>

          {/* Usage Statistics */}
          <div className="flex flex-col h-full">
              <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Usage Statistics</h4>
              <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4 flex-1 flex items-center justify-center">
                <div className="flex flex-row gap-4 items-end justify-center w-full">
                  <MetricSpeedometer jobId={runner.url ? runner.url : ""} type="cpu" />
                  <MetricSpeedometer jobId={runner.url ? runner.url : ""} type="memory" />
                </div>
              </div>
            </div>
        </div>   
      </div>      
    </>
  );
};

export default RunnerView;