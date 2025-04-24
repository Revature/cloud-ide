"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import ImageForm, { ImageFormData } from "./ImageForm";
import { runnersApi } from "@/services/cloud-resources/runners";
import ImageRunnerTerminal from "./ImageRunnerTerminal";
import ConnectingStatusDisplay from '../ui/connection/ConnectingStatusDisplay'; 
import type { ConnectingStatusDisplayProps } from '../ui/connection/ConnectingStatusDisplay';
import Button from "../ui/button/Button";
import { useRouter } from "next/navigation";
import { SuccessIcon } from "../ui/icons/CustomIcons";
import { BackendAppRequest } from "@/types";
import { useEnrichEnvData } from "@/hooks/useEnrichEnvData";

const SETUP_WS_URL = 'ws://localhost:8000/api/v1/app_requests/runner_status';

type WorkflowStage = 'form' | 'webSocketSetup' | 'connecting' | 'terminal' | 'readyToSubmit' | 'submitting' | 'success' | 'error';

/**
 * A React component that combines an image form with a terminal for interactive workflows.
 * It manages multiple stages of the workflow, including form submission, WebSocket setup,
 * terminal interaction, and final submission.
 */
const ImageFormWithTerminal: React.FC = () => {
  const [workflowStage, setWorkflowStage] = useState<WorkflowStage>('form');
  const [imageFormData, setImageFormData] = useState<ImageFormData | null>(null);
  const [runnerId, setRunnerId] = useState<number>(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [setupWebSocket, setSetupWebSocket] = useState<WebSocket | null>(null);
  const runnerIdReceivedRef = useRef<boolean>(false);
  const setupTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const router = useRouter();

  const workflowStageRef = useRef(workflowStage);
  useEffect(() => {
    workflowStageRef.current = workflowStage;
  }, [workflowStage]);

  // Move the hook call to the top level
  const { enrichEnvDataWithUserIp } = useEnrichEnvData();

  /**
   * Cleans up WebSocket connections and any associated timeouts.
   */
  const cleanupConnections = useCallback(() => {
    if (setupWebSocket && setupWebSocket.readyState === WebSocket.OPEN) {
      setupWebSocket.close(1000, "Client initiated cleanup");
    }
    setSetupWebSocket(null);
    if (setupTimeoutRef.current) {
      clearTimeout(setupTimeoutRef.current);
      setupTimeoutRef.current = null;
    }
  }, [setupWebSocket]);

  /**
   * Handles form submission and initiates the WebSocket setup process.
   *
   * @param data - The data submitted from the image form.
   * @param e - The form submission event.
   */
  const handleFormSubmitAndConnect = useCallback(async (data: ImageFormData, e?: React.FormEvent<HTMLFormElement>) => {
    e?.preventDefault();
    cleanupConnections();
    setImageFormData(data);
    setErrorMessage(null);
    runnerIdReceivedRef.current = false;
    setRunnerId(0);
    setWorkflowStage('webSocketSetup');

    let webSocketRequestId: string | null = null;

    try {
      // Use the enriched env_data
      const enrichedEnvData = await enrichEnvDataWithUserIp({
        script_vars: JSON.stringify(data.scriptVars || {}),
        env_vars: JSON.stringify(data.envVars || {}),
      });

      // Construct the BackendAppRequest object
      const appRequest: BackendAppRequest = {
        image_id: data.baseImageIdentifier || 0,
        user_email: "ashoka.shringla@revature.com", // Replace with dynamic user email if available
        session_time: 60, // Default session time
        runner_type: "temporary", // Default runner type
        env_data: {
          script_vars: JSON.parse(enrichedEnvData.script_vars),
          env_vars: JSON.parse(enrichedEnvData.env_vars),
        },
      };

      const apiResponseWithStatus = await fetch("http://localhost:8020/api/v1/app_requests/with_status", {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(appRequest),
      });

      if (!apiResponseWithStatus.ok) {
        throw new Error(`HTTP error ${apiResponseWithStatus.status}`);
      }

      const withStatusResponse = await apiResponseWithStatus.json();
      webSocketRequestId = withStatusResponse.request_id;

      if (!webSocketRequestId) {
        throw new Error("Invalid requestId received from API.");
      }

      const wsUrl = `${SETUP_WS_URL}/${webSocketRequestId}`;
      const ws = new WebSocket(wsUrl);
      setSetupWebSocket(ws);
      setWorkflowStage('connecting');

      ws.onopen = () => {
        if (workflowStageRef.current === 'connecting') {
          console.log(`Setup WS Opened (Req ID: ${webSocketRequestId}).`);
        } else {
          ws.close(1000, "Stale connection attempt");
        }
      };

      ws.onerror = (event) => {
        if (workflowStageRef.current === 'connecting') {
          setErrorMessage(`Failed to establish WebSocket connection. ${event}`);
          setWorkflowStage('error');
          cleanupConnections();
        }
      };

      ws.onclose = (event) => {
        if (workflowStageRef.current === 'connecting') {
          console.warn(`Setup WS closed early: Code=${event.code}`);
        }
      };
    } catch (error) {
      if (workflowStageRef.current === 'connecting') {
        setErrorMessage(error instanceof Error ? error.message : 'Failed to initiate terminal session.');
        setWorkflowStage('error');
        cleanupConnections();
      }
    }
  }, [cleanupConnections, enrichEnvDataWithUserIp]);

  /**
   * Handles the completion of the terminal interaction step.
   *
   * @param e - The form submission event.
   */
  const handleTerminalClose = useCallback((e?: React.FormEvent<HTMLFormElement>) => {
    e?.preventDefault();
    setWorkflowStage('readyToSubmit');
  }, []);

  /**
   * Handles the final submission of the image creation request.
   */
  const handleFinalSubmit = useCallback(async () => {
    if (!imageFormData) {
      setErrorMessage('Image Form Data is Missing');
      setWorkflowStage('error');
      return;
    }

    setWorkflowStage('submitting');

    try {
      const payload = {
        name: imageFormData.name,
        description: imageFormData.description,
        machine_id: imageFormData.machine.id,
        cloud_connector_id: imageFormData.cloudConnector?.id,
        runner_id: runnerId,
      };

      console.log("Payload being sent to the API:", payload);

      const apiCreateImage = await fetch("http://localhost:8020/api/v1/images/", {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const response = await apiCreateImage.json();
      if (!response) throw new Error('Failed to submit Image.');

      setWorkflowStage('success');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "An unknown error has occurred");
      setWorkflowStage('error');
    }
  }, [imageFormData, runnerId]);

  /**
   * Handles the cancellation of the workflow and cleans up resources.
   */
  const handleCancel = useCallback(async () => {
    const currentRunnerId = runnerId;

    setWorkflowStage('form');
    setImageFormData(null);
    setRunnerId(0);
    setErrorMessage(null);

    if (currentRunnerId !== null) {
      try {
        if (runnerId) await runnersApi.getById(runnerId);
      } catch (error) {
        console.error("Failed to request runner cleanup on cancel:", error);
      }
    }

    cleanupConnections();
  }, [runnerId, cleanupConnections]);

  /**
   * Handles the completion of the WebSocket connection process.
   *
   * @param result - The result of the connection process.
   */
  const handleConnectionComplete: ConnectingStatusDisplayProps['onComplete'] = useCallback((result) => {
    if (result.status !== 'failed') {
      setRunnerId(result.runnerId);
      setWorkflowStage('terminal');
    } else {
      setErrorMessage(result.message);
      setWorkflowStage('error');
      setRunnerId(0);
    }
  }, []);

  const isLoading = workflowStage === 'connecting' || workflowStage === 'submitting';
  const canFinalSubmit = workflowStage === 'readyToSubmit' && imageFormData !== null;

  return (
    <div>
      {errorMessage && <div style={{ color: 'red', marginBottom: '1rem' }}>Error: {errorMessage}</div>}

      {workflowStage === 'success' && (
        <div style={{ color: 'green' }}>Request Submitted Successfully!</div>
      )}

      {(workflowStage === 'form' || workflowStage === 'submitting' || workflowStage === 'readyToSubmit' || workflowStage === 'error') && (
        <ImageForm
          onSubmitAndConnect={handleFormSubmitAndConnect}
          onFinalSubmit={handleFinalSubmit}
          isLoading={isLoading}
          canFinalSubmit={canFinalSubmit}
          onCancel={handleCancel}
          initialData={imageFormData}
        />
      )}

      {workflowStage === 'webSocketSetup' && (
        <div className="flex flex-col items-center justify-center p-8 border rounded-lg bg-gray-50 dark:bg-gray-800 dark:border-gray-700 mt-4">
          <svg className="animate-spin h-8 w-8 text-blue-500 mb-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <h3 className="text-lg font-semibold dark:text-white mb-1">Initiating Instance...</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">Requesting connection details, please wait.</p>
        </div>
      )}

      {workflowStage === 'connecting' && (
        <div className="mt-4 p-4 border rounded-lg bg-gray-50 dark:bg-gray-800 dark:border-gray-700">
          <h3 className="text-lg font-semibold mb-3 dark:text-white">Connecting to Instance...</h3>
          <ConnectingStatusDisplay
            webSocket={setupWebSocket}
            onComplete={handleConnectionComplete}
          />
        </div>
      )}

      {workflowStage === 'terminal' && (
        <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
          <div className="h-150 w-full">
            <ImageRunnerTerminal
              runnerId={runnerId}
              onInteractionComplete={handleTerminalClose}
              onWorkflowError={(error) => {
                setErrorMessage(`Terminal session error: ${error}`);
                setRunnerId(0);
              }}
            />
          </div>
        </div>
      )}

      {workflowStage === 'success' && (
        <div className="flex flex-col items-center justify-center p-6 border border-green-300 rounded-lg bg-green-50 dark:bg-green-900/50 dark:border-green-700 mt-4 text-center shadow-sm">
          <SuccessIcon className="w-12 h-12 text-green-500 dark:text-green-400 mb-3" />
          <h3 className="text-xl font-semibold text-green-800 dark:text-green-200 mb-2">
            Submission Successful!
          </h3>
          <p className="text-sm text-gray-700 dark:text-gray-300 mb-5 max-w-md">
            Your image creation request has been submitted. It should appear in the Images tab within a few minutes once processing is complete.
          </p>
          <Button
            variant="primary"
            size="sm"
            onClick={() => router.push('/images')}
          >
            Go to Images
          </Button>
        </div>
      )}
    </div>
  );
};

export default ImageFormWithTerminal;