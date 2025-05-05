"use client";

import React from "react";
import { useRouter, useParams } from "next/navigation";
import Button from "@/components/ui/button/Button";
import { useScriptsQuery } from "@/hooks/api/scripts/useScriptsQuery";
import { useImageForItems } from "@/hooks/api/images/useImageForItems";
import Link from "next/link";
import CodeEditor from "../ui/codeEditor/codeEditor";

// Function to get event color
const getEventColor = (event: string) => {
  switch (event) {
    case "on_create":
      return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400";
    case "on_awaiting_client":
      return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400";
    case "on_connect":
      return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400";
    case "on_disconnect":
      return "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400";
    case "on_terminate":
      return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400";
    default:
      return "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300";
  }
};

// Function to get event label
const getEventLabel = (event: string) => {
  switch (event) {
    case "on_create":
      return "On Create";
    case "on_awaiting_client":
      return "Awaiting Client";
    case "on_connect":
      return "On Connect";
    case "on_disconnect":
      return "On Disconnect";
    case "on_terminate":
      return "On Terminate";
    default:
      return event;
  }
};

const ScriptView: React.FC = () => {
  const router = useRouter();
  const params = useParams();
  const scriptId = parseInt(params.id as string, 10);

  const { data: script, isLoading, error } = useScriptsQuery(scriptId);

  // Fetch associated image details
  const { imagesById } = useImageForItems([{ imageId: script?.imageId }]);

  const goBack = () => {
    router.push("/scripts");
  };

  const navigateToEdit = () => {
    router.push(`/scripts/edit/${scriptId}`);
  };

  if (isLoading) {
    return (
      <div className="flex justify-center">
        <div className="animate-pulse">Loading...</div>
      </div>
    );
  }

  if (error || !script) {
    return (
      <div className="flex flex-col items-center">
        <p className="text-red-500 dark:text-red-400 mb-4">
          {error ? `Error loading data: ${error instanceof Error ? error.message : "Unknown error"}` : "Script not found"}
        </p>
        <Button onClick={goBack}>Back to Scripts</Button>
      </div>
    );
  }

  const associatedImage = script.imageId ? imagesById[script.imageId] : null;

  return (
    <>
      <div className="flex items-center mb-6">
        <Button variant="outline" size="sm" onClick={goBack} className="mr-4">
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
        <h2 className="text-2xl font-bold text-gray-800 dark:text-white/90">Script Details</h2>
      </div>

      <div className="bg-white dark:bg-white/[0.03] rounded-2xl border border-gray-200 dark:border-white/[0.05] p-6">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h3 className="text-xl font-semibold text-gray-800 dark:text-white/90">{script.name}</h3>
            <p className="text-gray-500 dark:text-gray-400">Created on {script.createdAt}</p>
          </div>
          <div className="flex gap-3">
            <Button size="sm" variant="outline" onClick={navigateToEdit}>
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="stroke-current mr-2"
              >
                <path
                  d="M11 4H4C3.46957 4 2.96086 4.21071 2.58579 4.58579C2.21071 4.96086 2 5.46957 2 6V20C2 20.5304 2.21071 21.0391 2.58579 21.4142C2.96086 21.7893 3.46957 22 4 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V13"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M18.5 2.50001C18.8978 2.10219 19.4374 1.87869 20 1.87869C20.5626 1.87869 21.1022 2.10219 21.5 2.50001C21.8978 2.89784 22.1213 3.4374 22.1213 4.00001C22.1213 4.56262 21.8978 5.10219 21.5 5.50001L12 15L8 16L9 12L18.5 2.50001Z"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              Edit
            </Button>
          </div>
        </div>

        <div className="mb-6">
          <p className="text-gray-600 dark:text-gray-300">{script.description}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
          <div>
            <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Associated Image</h4>
            <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4">
              {associatedImage ? (
                <>
                  <p>
                    <Link
                      href={`/images/view/${associatedImage.id}`}
                      className="text-brand-500 hover:text-brand-600 dark:text-brand-400 dark:hover:text-brand-500 font-medium"
                    >
                      {associatedImage.name}
                    </Link>
                  </p>
                  <p className="text-gray-500 dark:text-gray-400 mt-2">{associatedImage.description || "No description available."}</p>
                  <p className="text-gray-500 dark:text-gray-400 mt-2">Created on: {associatedImage.createdOn}</p>
                </>
              ) : (
                <p className="text-gray-500 dark:text-gray-400">No associated image.</p>
              )}
            </div>
          </div>

          <div>
            <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Metadata</h4>
            <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4 space-y-4">
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-300">Created By</span>
                <span className="text-gray-800 dark:text-white">{script.createdBy}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-300">Last Modified By</span>
                <span className="text-gray-800 dark:text-white">{script.modifiedBy}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-300">Updated At</span>
                <span className="text-gray-800 dark:text-white">{script.updatedAt}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-300">Event</span>
                <span
                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getEventColor(
                    script.event
                  )}`}
                >
                  {getEventLabel(script.event)}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div>
          <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Script Content</h4>
          <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4">
            <CodeEditor value={script.script || "No script content available."} readOnly={true} />
          </div>
        </div>
      </div>
    </>
  );
};

export default ScriptView;