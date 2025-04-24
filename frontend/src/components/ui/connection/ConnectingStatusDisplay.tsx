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
   *
   * @param start - The start timestamp.
   * @param end - The end timestamp (optional, defaults to the current time).
   * @returns A string representing the elapsed time in the format `(MM:SS)`.
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
      setElapsedTimes(prev => {
        const newTimes: Record<string, string> = {};
        stages.forEach(stage => {
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
   *
   * @param runnerEvent - The event to map.
   * @returns A `DisplayStage` object or `null` if the event type is not recognized.
   */
  const mapEventToStage = useCallback((runnerEvent: RunnerEvent): Omit<DisplayStage, 'startTime' | 'endTime' | 'message'> | null => {
    switch (runnerEvent.type) {
      case 'REQUEST_PROCESSING': return { id: 'request', label: 'Processing Request', status: runnerEvent.status };
      case 'RUNNER_ACQUISITION': return { id: 'acquisition', label: 'Acquiring Runner', status: runnerEvent.status };
      case 'INSTANCE_LIFECYCLE': return { id: 'provisioning', label: 'Provisioning Instance', status: runnerEvent.status };
      case 'SECURITY_GROUP_UPDATE': return { id: 'security', label: 'Configuring Network', status: runnerEvent.status };
      case 'INSTANCE_TAGGING': return { id: 'tagging', label: 'Applying Tags', status: runnerEvent.status };
      case 'CLIENT_SCRIPT_EXECUTION': return { id: 'scripting', label: 'Running Setup Scripts', status: runnerEvent.status };
      case 'CONNECTION_STATUS':
      case 'RUNNER_READY': return { id: 'connecting', label: 'Establishing Connection', status: 'succeeded' };
      case 'GENERIC_ERROR': return { id: 'error', label: 'Error Encountered', status: 'failed' };
      default: return null;
    }
  }, []);

  /**
   * Processes a `RunnerEvent` and updates the connection stages.
   *
   * @param runnerEvent - The event to process.
   */
  const processEvent = useCallback((runnerEvent: RunnerEvent | null) => {
    if (!runnerEvent || !runnerEvent.type || completionCalledRef.current) return;
    if (!processStartTimeRef.current) processStartTimeRef.current = Date.now();

    setStages(prevStages => {
      const eventTime = Date.now();
      const stageMapping = mapEventToStage(runnerEvent);
      if (!stageMapping) return prevStages;
      const existingStageIndex = prevStages.findIndex(s => s.id === stageMapping.id);
      const newStages = [...prevStages];
      if (existingStageIndex === -1) {
        newStages.push({
          ...stageMapping,
          message: runnerEvent.message,
          startTime: eventTime,
          endTime: (runnerEvent.status === 'succeeded' || runnerEvent.status === 'failed') ? eventTime : null,
        });
      } else {
        const currentStage = newStages[existingStageIndex];
        const newStatus = currentStage.status === 'succeeded' || currentStage.status === 'failed' ? currentStage.status : runnerEvent.status;
        newStages[existingStageIndex] = {
          ...currentStage,
          status: newStatus,
          message: runnerEvent.message,
          endTime: (newStatus === 'succeeded' || newStatus === 'failed')
            ? (currentStage.endTime ?? eventTime)
            : null,
        };
      }
      return newStages;
    });

    let completionResult: Parameters<ConnectingStatusDisplayProps['onComplete']>[0] | null = null;
    let finalMessageText: string | null = null;

    if (runnerEvent.type === 'CONNECTION_STATUS' && runnerEvent.status === 'succeeded') {
      completionResult = { status: 'succeeded', runnerId: runnerEvent.runner_id, url: runnerEvent.url };
      finalMessageText = "succeeded! Connecting to terminal...";
    } else if (runnerEvent.type === 'RUNNER_READY') {
      completionResult = { status: 'failed', message: 'Runner ready signal received, but connection URL missing.' };
      finalMessageText = "Error: Could not retrieve connection details.";
    } else if (runnerEvent.status === 'failed') {
      const errorMessage = runnerEvent.message || 'An unknown error occurred.';
      completionResult = { status: 'failed', message: errorMessage };
      finalMessageText = `Error Encountered. Routing back...`;
    }

    if (completionResult && finalMessageText) {
      completionCalledRef.current = true;

      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }

      setTemporaryMessage({ status: completionResult.status, message: finalMessageText });

      console.log("Calling onComplete after 2.5s delay", completionResult);
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
        console.error("Failed to parse WebSocket message:", error, event.data);
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

  const isLoading = stages.length === 0 && !temporaryMessage;

  return (
    <div className="space-y-3">
      {isLoading && (
        <div className="flex items-center space-x-2 animate-pulse">
          <SpinnerIcon />
          <span className="text-gray-600 dark:text-gray-400">Initializing connection process...</span>
        </div>
      )}

      {!isLoading && stages.map((stage) => (
        <div key={stage.id} className="flex items-center space-x-2">
          {stage.status === 'in_progress' && <SpinnerIcon />}
          {stage.status === 'succeeded' && <SuccessIcon />}
          {stage.status === 'failed' && <ErrorIcon />}
          <span className={`text-sm ${stage.status === 'failed' ? 'text-red-700 dark:text-red-400' : 'text-gray-700 dark:text-gray-300'}`}>
            <span className="font-medium">{stage.label}:</span> {stage.message}
          </span>
          <span className="text-xs text-gray-500 dark:text-gray-400 flex-shrink-0">
            {stage.status !== 'in_progress' && stage.endTime ?
              formatElapsedTime(stage.startTime, stage.endTime) :
              (elapsedTimes[stage.id] || formatElapsedTime(stage.startTime, null))
            }
          </span>
        </div>
      ))}

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