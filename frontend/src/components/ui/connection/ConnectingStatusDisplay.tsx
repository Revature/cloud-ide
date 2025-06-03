import React, { useState, useEffect, useRef, useCallback } from 'react';
import type { RunnerEvent, RunnerEventStatus } from '@/types/runner-events'; // Adjust path as needed
import { ErrorIcon, SpinnerIcon, SuccessIcon } from '../icons/CustomIcons';

/**
 * Represents a stage in the connection process.
 *
 * @property id - A unique identifier for the stage.
 * @property label - A human-readable label for the stage.
 * @property status - The current status of the stage (e.g., 'in_progress', 'succeeded', 'failed').
 * @property message - A message providing additional details about the stage.
 * @property startTime - The timestamp when the stage started.
 * @property endTime - The timestamp when the stage ended (optional).
 */
interface DisplayStage {
  id: string;
  label: string;
  status: RunnerEventStatus;
  message: string;
  startTime: number;
  endTime?: number | null;
}

/**
 * Props for the `ConnectingStatusDisplay` component.
 *
 * @property webSocket - The WebSocket instance used for receiving connection updates.
 * @property onComplete - A callback function triggered when the connection process completes.
 */
export interface ConnectingStatusDisplayProps {
  webSocket: WebSocket | null;
  onComplete: (result: { status: 'succeeded'; runnerId: number; url: string } | { status: 'failed'; message: string }) => void;
}

/**
 * A React component that displays the status of a connection process.
 * It listens for WebSocket events and updates the UI to reflect the current stages of the process.
 *
 * @param props - The properties required for the component.
 * @returns A JSX element representing the connection status display.
 */
const ConnectingStatusDisplay: React.FC<ConnectingStatusDisplayProps> = ({
  webSocket,
  onComplete,
}) => {
  const [stages, setStages] = useState<DisplayStage[]>([]);
  const [elapsedTimes, setElapsedTimes] = useState<Record<string, string>>({});
  const [temporaryMessage, setTemporaryMessage] = useState<{ status: 'succeeded' | 'failed'; message: string } | null>(null);
  const processStartTimeRef = useRef<number | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const completionCalledRef = useRef<boolean>(false);
  const completionTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  /**
   * Formats the elapsed time between two timestamps.
   */
  const formatElapsedTime = useCallback((start: number, end?: number | null): string => {
    const endTime = end ?? Date.now();
    const diffSeconds = Math.max(0, Math.floor((endTime - start) / 1000));
    const minutes = Math.floor(diffSeconds / 60);
    const seconds = diffSeconds % 60;
    return `(${minutes}:${seconds.toString().padStart(2, '0')})`;
  }, []);

  /**
   * Updates the elapsed times for all stages at regular intervals.
   */
  useEffect(() => {
    intervalRef.current = setInterval(() => {
      if (!processStartTimeRef.current) return;
      setElapsedTimes((prev) => {
        const newTimes: Record<string, string> = {};
        stages.forEach((stage) => {
          if (stage.status === 'in_progress') {
            newTimes[stage.id] = formatElapsedTime(stage.startTime);
          } else if (prev[stage.id]) {
            newTimes[stage.id] = prev[stage.id];
          } else if (stage.endTime) {
            newTimes[stage.id] = formatElapsedTime(stage.startTime, stage.endTime);
          }
        });
        return newTimes;
      });
    }, 1000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [stages, formatElapsedTime]);

  /**
   * Maps a `RunnerEvent` to a `DisplayStage` object.
   */
    const mapEventToStage = useCallback((runnerEvent: RunnerEvent): Omit<DisplayStage, 'startTime' | 'endTime' | 'message'> | null => {
    switch (runnerEvent.type) {
      case 'REQUEST_RECEIVED':
        return { id: 'request_received', label: 'Request Received', status: runnerEvent.status };
      case 'REQUEST_PROCESSING':
        return { id: 'request_processing', label: 'Processing Request', status: runnerEvent.status };
      case 'RESOURCE_DISCOVERY':
        return { id: 'resource_discovery', label: 'Discovering Resources', status: runnerEvent.status };
      case 'RESOURCE_ALLOCATION':
        return { id: 'resource_allocation', label: 'Allocating Resources', status: runnerEvent.status };
      case 'NETWORK_SETUP':
        return { id: 'network_setup', label: 'Setting Up Network', status: runnerEvent.status };
      case 'VM_CREATION':
        return { id: 'vm_creation', label: 'Creating Virtual Machine', status: runnerEvent.status };
      case 'INSTANCE_PREPARATION':
        return { id: 'instance_preparation', label: 'Preparing Instance', status: runnerEvent.status };
      case 'RESOURCE_TAGGING':
        return { id: 'resource_tagging', label: 'Tagging Resources', status: runnerEvent.status };
      case 'RUNNER_REGISTRATION':
        return { id: 'runner_registration', label: 'Registering Runner', status: runnerEvent.status };
      case 'CONNECTION_STATUS':
        return { id: 'connection_status', label: 'Establishing Connection', status: runnerEvent.status };
      case 'GENERIC_ERROR':
        return { id: 'generic_error', label: 'Error Encountered', status: 'failed' };
      default:
        return null;
    }
  }, []);

  /**
   * Processes a `RunnerEvent` and updates the connection stages.
   */
  const processEvent = useCallback((runnerEvent: RunnerEvent | null) => {
    if (!runnerEvent || !runnerEvent.type || completionCalledRef.current) return;
    if (!processStartTimeRef.current) processStartTimeRef.current = Date.now();
  
    setStages((prevStages) => {
      const eventTime = Date.now();
      const stageMapping = mapEventToStage(runnerEvent);
      if (!stageMapping) return prevStages;
  
      const newStages = [...prevStages];
  
      // Find the current stage
      const existingStageIndex = newStages.findIndex((s) => s.id === stageMapping.id);
  
      if (existingStageIndex === -1) {
        // Add a new stage
        newStages.push({
          ...stageMapping,
          message: runnerEvent.message || '',
          startTime: eventTime,
          endTime: (runnerEvent.status === 'succeeded' || runnerEvent.status === 'failed') ? eventTime : null,
        });
  
        // Mark the previous stage as succeeded if it is still in progress
        if (newStages.length > 1) {
          const previousStage = newStages[newStages.length - 2];
          if (previousStage.status === 'in_progress') {
            previousStage.status = 'succeeded';
            previousStage.endTime = eventTime;
          }
        }
      } else {
        // Update the existing stage
        const currentStage = newStages[existingStageIndex];
        currentStage.status = runnerEvent.status;
        currentStage.message = runnerEvent.message || currentStage.message;
        currentStage.endTime = (runnerEvent.status === 'succeeded' || runnerEvent.status === 'failed') ? eventTime : null;
      }
  
      return newStages;
    });
  
    // Handle completion events
    let completionResult: Parameters<ConnectingStatusDisplayProps['onComplete']>[0] | null = null;
    let finalMessageText: string | null = null;
  
    if (runnerEvent.type === 'CONNECTION_STATUS' && runnerEvent.status === 'succeeded' && runnerEvent.url) {
      completionResult = { status: 'succeeded', runnerId: runnerEvent.runner_id, url: runnerEvent.url };
      finalMessageText = 'Connection succeeded! Redirecting to terminal...';
    } else if (runnerEvent.type === 'RUNNER_READY') {
      completionResult = { status: 'failed', message: 'Runner ready signal received, but connection URL missing.' };
      finalMessageText = 'Error: Could not retrieve connection details.';
    } else if (runnerEvent.status === 'failed') {
      const errorMessage = runnerEvent.message || 'An unknown error occurred.';
      completionResult = { status: 'failed', message: errorMessage };
      finalMessageText = 'Error encountered. Returning to previous screen...';
    }
  
    if (completionResult && finalMessageText) {
      completionCalledRef.current = true;
  
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
  
      // Ensure all stages are marked as succeeded or failed
      setStages((prevStages) =>
        prevStages.map((stage) =>
          stage.status === 'in_progress'
            ? { ...stage, status: 'succeeded', endTime: Date.now() }
            : stage
        )
      );
  
      setTemporaryMessage({ status: completionResult.status, message: finalMessageText });
  
      console.log('Calling onComplete after 2.5s delay', completionResult);
      completionTimeoutRef.current = setTimeout(() => {
        setTemporaryMessage(null);
        onComplete(completionResult);
      }, 2500);
    }
  }, [onComplete, mapEventToStage]);
  /**
   * Handles WebSocket events and updates the connection stages.
   */
  useEffect(() => {
    if (!webSocket) {
      setStages([]);
      setElapsedTimes({});
      processStartTimeRef.current = null;
      completionCalledRef.current = false;
      setTemporaryMessage(null);
      return;
    }

    setStages([]);
    setElapsedTimes({});
    processStartTimeRef.current = null;
    completionCalledRef.current = false;
    setTemporaryMessage(null);

    const handleMessage = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        processEvent(data as RunnerEvent);
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error, event.data);
        if (!completionCalledRef.current) {
          processEvent({ type: 'GENERIC_ERROR', status: 'failed', message: 'Received invalid status update.', timestamp: new Date().toISOString(), error: 'Parsing failed' });
        }
      }
    };

    webSocket.addEventListener('message', handleMessage);

    return () => {
      webSocket.removeEventListener('message', handleMessage);
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (completionTimeoutRef.current) clearTimeout(completionTimeoutRef.current);
    };
  }, [webSocket, processEvent]);

  if (!webSocket) {
    return <p className="text-gray-500 italic">Waiting for connection process to start...</p>;
  }


  // Group stages by type for tree structure
  const groupedStages = stages.reduce<Record<string, DisplayStage[]>>((acc, stage) => {
    if (!acc[stage.id]) acc[stage.id] = [];
    acc[stage.id].push(stage);
    return acc;
  }, {});

  // Separate completed and in-progress event types
  const completedTypes: Array<[string, DisplayStage[]]> = [];
  const inProgressTypes: Array<[string, DisplayStage[]]> = [];
  Object.entries(groupedStages).forEach(([type, messages]) => {
    const isInProgress = messages.some(m => m.status === 'in_progress');
    if (isInProgress) {
      inProgressTypes.push([type, messages]);
    } else {
      completedTypes.push([type, messages]);
    }
  });

  return (
    <div className="space-y-3">
      {/* Completed event types (collapsed, show only final message and icon) */}
      {completedTypes.map(([type, messages]) => {
        const topStage = messages[0];
        const lastStage = messages[messages.length - 1];
        const isFailed = messages.some(m => m.status === 'failed');
        return (
          <div key={type} className="flex items-center gap-2 opacity-80">
            {isFailed ? <ErrorIcon /> : <SuccessIcon />}
            <span className={`font-semibold text-sm ${isFailed ? 'text-red-700 dark:text-red-400' : 'text-gray-700 dark:text-gray-300'}`}>{topStage.label}</span>
            <span className={`text-xs ${isFailed ? 'text-red-700 dark:text-red-400' : 'text-gray-700 dark:text-gray-300'}`}>{lastStage.message}</span>
            <span className="text-xs text-gray-500 dark:text-gray-400 flex-shrink-0">
              {lastStage.endTime ? formatElapsedTime(lastStage.startTime, lastStage.endTime) : ''}
            </span>
          </div>
        );
      })}

      {/* In-progress event types (expanded tree) */}
      {inProgressTypes.map(([type, messages]) => {
        const topStage = messages[0];
        return (
          <div key={type} className="flex flex-col">
            <div className="flex items-center gap-2">
              <SpinnerIcon />
              <span className="font-semibold text-sm text-gray-700 dark:text-gray-300">{topStage.label}</span>
            </div>
            <div className="ml-8 border-l-2 border-gray-200 dark:border-gray-700 pl-4 flex flex-col gap-1">
              {messages.map((stage, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-gray-400 dark:bg-gray-600 flex-shrink-0"></span>
                  <span className={`text-xs ${stage.status === 'failed' ? 'text-red-700 dark:text-red-400' : 'text-gray-700 dark:text-gray-300'}`}>{stage.message}</span>
                  <span className="text-xs text-gray-500 dark:text-gray-400 flex-shrink-0">
                    {stage.status !== 'in_progress' && stage.endTime
                      ? formatElapsedTime(stage.startTime, stage.endTime)
                      : (elapsedTimes[stage.id] || formatElapsedTime(stage.startTime, null))}
                  </span>
                </div>
              ))}
            </div>
          </div>
        );
      })}

      {/* Temporary completion message */}
      {temporaryMessage && (
        <div className={`flex items-center space-x-2 p-3 mt-4 border rounded-md bg-opacity-80 dark:bg-opacity-80 ${temporaryMessage.status === 'succeeded' ? 'border-green-300 bg-green-50 dark:border-green-700 dark:bg-green-900' : 'border-red-300 bg-red-50 dark:border-red-700 dark:bg-red-900'}`}>
          {temporaryMessage.status === 'succeeded' ? <SuccessIcon className="w-5 h-5 text-green-600 dark:text-green-400" /> : <ErrorIcon className="w-5 h-5 text-red-600 dark:text-red-400" />}
          <span className={`text-sm font-medium ${temporaryMessage.status === 'succeeded' ? 'text-green-800 dark:text-green-200' : 'text-red-800 dark:text-red-200'}`}>
            {temporaryMessage.message}
          </span>
        </div>
      )}
    </div>
  );
};

export default ConnectingStatusDisplay;