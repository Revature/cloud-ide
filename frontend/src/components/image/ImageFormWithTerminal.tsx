"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import ImageForm, { ImageFormData } from "./ImageForm";
import { appRequestsApi } from "@/services/cloud-resources/appRequests";
import ImageRunnerTerminal from "./ImageRunnerTerminal";
import ConnectingStatusDisplay from "../ui/connection/ConnectingStatusDisplay";
import type { ConnectingStatusDisplayProps } from "../ui/connection/ConnectingStatusDisplay";
import Button from "../ui/button/Button";
import { useRouter } from "next/navigation";
import { SuccessIcon } from "../ui/icons/CustomIcons";
import { useEnrichEnvData } from "@/hooks/useEnrichEnvData";
import { useAuth } from "@workos-inc/authkit-nextjs/components";
import { AppRequest } from "@/types/app-requests";
import { ImageRequest } from "@/types/images";
import { useCreateImage } from "@/hooks/type-query/useImages";

type WorkflowStage =
  | "form"
  | "webSocketSetup"
  | "connecting"
  | "terminal"
  | "submitting"
  | "success"
  | "error";

/**
 * A React component that combines an image form with a terminal for interactive workflows.
 * It manages multiple stages of the workflow, including form submission, WebSocket setup,
 * terminal interaction, and final submission.
 */
const ImageFormWithTerminal: React.FC = () => {
  const [workflowStage, setWorkflowStage] = useState<WorkflowStage>("form");
  const [imageFormData, setImageFormData] = useState<ImageFormData | null>(null);
  const [runnerId, setRunnerId] = useState<number>(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [setupWebSocket, setSetupWebSocket] = useState<WebSocket | null>(null);
  const [cloudIdeUrl, setCloudIdeUrl] = useState<string | null>(null);
  const runnerIdReceivedRef = useRef<boolean>(false);
  const setupTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const { user } = useAuth();
  const { enrichEnvDataWithUserIp } = useEnrichEnvData();
  const router = useRouter();
  const { mutateAsync: createImage } = useCreateImage();


  const workflowStageRef = useRef(workflowStage);
  useEffect(() => {
    workflowStageRef.current = workflowStage;
  }, [workflowStage]);

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
   */
  const handleFormSubmitAndConnect = useCallback(
    async (data: ImageFormData) => {
      cleanupConnections();
      setImageFormData(data);
      setErrorMessage(null);
      runnerIdReceivedRef.current = false;
      setRunnerId(0);
      setWorkflowStage("webSocketSetup");

      const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const deploymentUrl = window.location.protocol === "https:" ? process.env["NEXT_PUBLIC_DEPLOYMENT_URL"] : "localhost:8000";
      const SETUP_WS_URL = `${wsProtocol}//${deploymentUrl}/api/v1/app_requests/runner_status`;

      try {
        const enrichedEnvData = await enrichEnvDataWithUserIp({
          script_vars: JSON.stringify(data.scriptVars || {}),
          env_vars: JSON.stringify(data.envVars || {}),
        });

        const appRequest: AppRequest = {
          image_id: data.baseImageIdentifier || 0,
          user_email: user?.email || "ashoka.shringla@revature.com",
          session_time: 60,
          runner_type: "temporary",
          env_data: {
            script_vars: JSON.parse(enrichedEnvData.script_vars),
            env_vars: JSON.parse(enrichedEnvData.env_vars),
          },
        };

        console.log("App Request Payload:", appRequest);

        const { lifecycle_token } = await appRequestsApi.createWithStatus(appRequest);

        if (!lifecycle_token) {
          throw new Error("Invalid requestId received from API.");
        }

        const wsUrl = `${SETUP_WS_URL}?lifecycle_token=${lifecycle_token}`;
        console.log("WebSocket URL:", wsUrl);
        const ws = new WebSocket(wsUrl);
        setSetupWebSocket(ws);
        setWorkflowStage('connecting');

        ws.onopen = () => {
          if (workflowStageRef.current === "connecting") {
            console.log(`Setup WS Opened (Req ID: ${lifecycle_token}).`);
          } else {
            ws.close(1000, "Stale connection attempt");
          }
        };

        ws.onerror = (event) => {
          if (workflowStageRef.current === "connecting") {
            setErrorMessage(`Failed to establish WebSocket connection. ${event}`);
            setWorkflowStage("error");
            cleanupConnections();
          }
        };

        ws.onclose = (event) => {
          if (workflowStageRef.current === "connecting") {
            console.warn(`Setup WS closed early: Code=${event.code}`);
          }
        };
      } catch (error) {
        if (workflowStageRef.current === "connecting") {
          setErrorMessage(
            error instanceof Error
              ? error.message
              : "Failed to initiate terminal session."
          );
          setWorkflowStage("error");
          cleanupConnections();
        }
      }
    },
    [cleanupConnections, enrichEnvDataWithUserIp, user]
  );

  /**
   * Handles the final submission of the image creation request.
   */
  const handleFinalSubmit = useCallback(async () => {
    if (!imageFormData) {
      setErrorMessage("Image Form Data is Missing");
      setWorkflowStage("error");
      return;
    }

    setWorkflowStage("submitting");

    try {
      const payload: ImageRequest = {
        name: imageFormData.name,
        description: imageFormData.description,
        machine_id: imageFormData.machine.id,
        cloud_connector_id: imageFormData.cloudConnector!.id,
        runner_id: runnerId,
        tags: imageFormData.tags || [],
      };

      console.log("Payload being sent to the API:", payload);

      await createImage(payload);

      setWorkflowStage("success");
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "An unknown error has occurred"
      );
      setWorkflowStage("error");
    }
  }, [imageFormData, runnerId, createImage]);

  /**
   * Handles the cancellation of the workflow and cleans up resources.
   */
  const handleCancel = useCallback(() => {
    setWorkflowStage("form");
    setImageFormData(null);
    setRunnerId(0);
    setErrorMessage(null);
    cleanupConnections();
  }, [cleanupConnections]);

  /**
   * Handles the completion of the WebSocket connection process.
   *
   * @param result - The result of the connection process.
   */
  const handleConnectionComplete: ConnectingStatusDisplayProps["onComplete"] =
    useCallback((result) => {
      if (result.status !== "failed") {
        setRunnerId(result.runnerId);
        setCloudIdeUrl(result.url);
        setWorkflowStage("terminal");
      } else {
        setErrorMessage(result.message);
        setWorkflowStage("error");
        setRunnerId(0);
      }
    }, []);

  const handleTerminalClose = useCallback(() => {
    handleFinalSubmit();
  }, [handleFinalSubmit]);

  const isLoading = workflowStage === "connecting";

  return (
    <div>
      {errorMessage && (
        <div style={{ color: "red", marginBottom: "1rem" }}>
          Error: {errorMessage}
        </div>
      )}

      {workflowStage === "success" && (
        <div className="flex flex-col items-center justify-center p-6 border border-green-300 rounded-lg bg-green-50 dark:bg-green-900/50 dark:border-green-700 mt-4 text-center shadow-sm">
          <SuccessIcon className="w-12 h-12 text-green-500 dark:text-green-400 mb-3" />
          <h3 className="text-xl font-semibold text-green-800 dark:text-green-200 mb-2">
            Submission Successful!
          </h3>
          <p className="text-sm text-gray-700 dark:text-gray-300 mb-5 max-w-md">
            Your image creation request has been submitted. It should appear in
            the Images tab within a few minutes once processing is complete.
          </p>
          <Button
            variant="primary"
            size="sm"
            onClick={() => router.push("/images")}
          >
            Go to Images
          </Button>
        </div>
      )}

      {(workflowStage === "form" || workflowStage === "error") && (
        <ImageForm
          onSubmitAndConnect={handleFormSubmitAndConnect}
          isLoading={isLoading}
          onCancel={handleCancel}
        />
      )}

      {workflowStage === "webSocketSetup" && (
        <div className="flex flex-col items-center justify-center p-8 border rounded-lg bg-gray-50 dark:bg-gray-800 dark:border-gray-700 mt-4">
          <svg
            className="animate-spin h-8 w-8 text-blue-500 mb-3"
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
          <h3 className="text-lg font-semibold dark:text-white mb-1">
            Initiating Instance...
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Requesting connection details, please wait.
          </p>
        </div>
      )}

      {workflowStage === "connecting" && (
        <ConnectingStatusDisplay
          webSocket={setupWebSocket}
          onComplete={handleConnectionComplete}
        />
      )}

      {(workflowStage === "terminal" || workflowStage === "submitting") && (
        <>
          <div className="flex justify-end mb-4">
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
          </div>
          <ImageRunnerTerminal
            runnerId={runnerId}
            onInteractionComplete={handleTerminalClose}
            onWorkflowError={(error) => {
              setErrorMessage(`Terminal session error: ${error}`);
              setRunnerId(0);
            }}
          />
      </>
      )}
    </div>
    
  );
};

export default ImageFormWithTerminal;