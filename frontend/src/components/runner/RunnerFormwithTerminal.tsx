"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import RunnerForm, { RunnerFormData } from "./RunnerForm";
import ConnectingStatusDisplay from "@/components/ui/connection/ConnectingStatusDisplay";
import { useRouter } from "next/navigation";
import { useEnrichEnvData } from "@/hooks/useEnrichEnvData";
import { appRequestsApi } from '@/services/cloud-resources/appRequests'



type WorkflowStage = "form" | "webSocketSetup" | "connecting" | "error";

const RunnerFormWithTerminal: React.FC = () => {
  const [workflowStage, setWorkflowStage] = useState<WorkflowStage>("form");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [setupWebSocket, setSetupWebSocket] = useState<WebSocket | null>(null);
  const router = useRouter();

  const workflowStageRef = useRef(workflowStage);
  useEffect(() => {
    workflowStageRef.current = workflowStage;
  }, [workflowStage]);

  const { enrichEnvDataWithUserIp } = useEnrichEnvData();

  /**
   * Cleans up WebSocket connections and any associated timeouts.
   */
  const cleanupConnections = useCallback(() => {
    if (setupWebSocket && setupWebSocket.readyState === WebSocket.OPEN) {
      setupWebSocket.close(1000, "Client initiated cleanup");
    }
    setSetupWebSocket(null);
  }, [setupWebSocket]);

  /**
   * Handles form submission and initiates the WebSocket setup process.
   *
   * @param data - The data submitted from the runner form.
   */
  const handleFormSubmitAndConnect = useCallback(async (data: RunnerFormData, e?: React.FormEvent<HTMLFormElement>) => {
    e?.preventDefault();
    cleanupConnections();
    setErrorMessage(null);
    setWorkflowStage('webSocketSetup');
    // const SETUP_WS_URL = "ws://localhost:8000/api/v1/app_requests/runner_status";
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const SETUP_WS_URL = `${wsProtocol}//devide.revature.com/api/v1/app_requests/runner_status`;

    try {
      const enrichedEnvData = await enrichEnvDataWithUserIp({
        script_vars: JSON.stringify(data.scriptVars || {}),
        env_vars: JSON.stringify(data.envVars || {}),
      });

      const appRequest = {
        image_id: data.image.id,
        session_time: data.durationMinutes,
        runner_type: "temporary",
        user_email: 'ashoka.shringla@revature.com', // Replace with dynamic user email
        env_data: {
          script_vars: JSON.parse(enrichedEnvData.script_vars),
          env_vars: JSON.parse(enrichedEnvData.env_vars),
        },
      };

      const { lifecycle_token } = await appRequestsApi.createWithStatus(appRequest);

      const wsUrl = `${SETUP_WS_URL}/${lifecycle_token}`;
      const ws = new WebSocket(wsUrl);
      setSetupWebSocket(ws);
      setWorkflowStage('connecting');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to initiate runner creation.');
      setWorkflowStage('error');
      cleanupConnections();
    }
  }, [cleanupConnections, enrichEnvDataWithUserIp]);

  /**
   * Handles the completion of the WebSocket connection process.
   *
   * @param result - The result of the connection process.
   */
  const handleConnectionComplete = useCallback(
    (result: { status: "succeeded"; runnerId: number; url: string } | { status: "failed"; message: string }) => {
      if (result.status === "succeeded") {
        router.push(`/runners/view/${result.runnerId}?autoConnect=true&url=${encodeURIComponent(result.url)}`); // Pass the URL as a query parameter
      } else {
        setErrorMessage(result.message);
        setWorkflowStage("error");
      }
    },
    [router]
  );

  /**
   * Handles the cancellation of the workflow and cleans up resources.
   */
  const handleCancel = useCallback(() => {
    setWorkflowStage("form");
    setErrorMessage(null);
    cleanupConnections();
  }, [cleanupConnections]);

  return (
    <div>
      {errorMessage && <div style={{ color: "red", marginBottom: "1rem" }}>Error: {errorMessage}</div>}

      {workflowStage === "form" && (
        <RunnerForm
          onSubmit={handleFormSubmitAndConnect}
          onCancel={handleCancel}
        />
      )}

      {workflowStage === "webSocketSetup" && (
        <div className="flex flex-col items-center justify-center p-8 border rounded-lg bg-gray-50 dark:bg-gray-800 dark:border-gray-700 mt-4">
          <svg className="animate-spin h-8 w-8 text-blue-500 mb-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <h3 className="text-lg font-semibold dark:text-white mb-1">Initiating Runner...</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">Requesting connection details, please wait.</p>
        </div>
      )}

      {workflowStage === "connecting" && (
        <div className="mt-4 p-4 border rounded-lg bg-gray-50 dark:bg-gray-800 dark:border-gray-700">
          <h3 className="text-lg font-semibold mb-3 dark:text-white">Connecting to Runner...</h3>
          <ConnectingStatusDisplay
            webSocket={setupWebSocket}
            onComplete={handleConnectionComplete}
          />
        </div>
      )}
    </div>
  );
};

export default RunnerFormWithTerminal;