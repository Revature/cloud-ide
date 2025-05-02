"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Label from "@/components/form/Label";
import Select from "@/components/form/Select";
import { useScriptsQuery } from "@/hooks/api/scripts/useScriptsQuery";
import { scriptsApi } from "@/services/cloud-resources/scripts";
import { SpinnerIcon, SuccessIcon, ErrorIcon } from "@/components/ui/icons/CustomIcons";

interface ScriptEditFormProps {
  scriptId: number;
}

const ScriptEditForm: React.FC<ScriptEditFormProps> = ({ scriptId }) => {
  const router = useRouter();

  // Fetch the script data using the script ID
  const { data: script, isLoading, error } = useScriptsQuery(scriptId);

  // State for form fields
  const [name, setName] = useState(script?.name || "");
  const [description, setDescription] = useState(script?.description || "");
  const [event, setEvent] = useState(script?.event || "on_create");
  const [scriptContent, setScriptContent] = useState(script?.script || "");

  // State for save status
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "success" | "error">("idle");

  // Event options
  const eventOptions = [
    { value: "on_create", label: "On Create - When a runner is first created" },
    { value: "on_awaiting_client", label: "On Awaiting Client - When a runner is assigned to a user but before connection" },
    { value: "on_connect", label: "On Connect - When a user connects to a runner" },
    { value: "on_disconnect", label: "On Disconnect - When a user disconnects from a runner" },
    { value: "on_terminate", label: "On Terminate - When a runner is being terminated" },
  ];

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const content = event.target?.result as string;
        setScriptContent(content);
      };
      reader.readAsText(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveStatus("idle");

    try {
      // Call the scriptsApi.update function to update the script
      await scriptsApi.update(scriptId, { name, description, event, script: scriptContent });
      setSaveStatus("success");

      // Wait for 2 seconds before navigating back to the script's view page
      setTimeout(() => {
        router.push(`/scripts/view/${scriptId}`);
      }, 2000);
    } catch (error) {
      console.error("Failed to update script:", error);
      setSaveStatus("error");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return <div className="text-center text-gray-500">Loading script data...</div>;
  }

  if (error || !script) {
    return (
      <div className="text-center text-red-500">
        {error ? "Failed to load script data." : "Script not found."}
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <Label htmlFor="name">Script Name</Label>
        <input
          id="name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full mt-1 rounded-lg border-gray-300 shadow-sm focus:border-brand-300 focus:ring focus:ring-brand-200 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
          required
        />
      </div>

      <div>
        <Label htmlFor="description">Description</Label>
        <textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="w-full mt-1 rounded-lg border-gray-300 shadow-sm focus:border-brand-300 focus:ring focus:ring-brand-200 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
          rows={4}
          required
        />
      </div>

      <div>
        <Label htmlFor="event">Event Type</Label>
        <Select
          options={eventOptions}
          defaultValue={event}
          onChange={(value) => setEvent(value)}
        />
      </div>

      <div>
        <Label htmlFor="script">Script</Label>
        <textarea
          id="script"
          value={scriptContent}
          onChange={(e) => setScriptContent(e.target.value)}
          className="w-full mt-1 rounded-lg border-gray-300 shadow-sm focus:border-brand-300 focus:ring focus:ring-brand-200 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
          rows={10}
          placeholder="Write your script here..."
        />
        <div className="mt-2">
          <Label htmlFor="fileUpload">Or Upload a Script File</Label>
          <input
            id="fileUpload"
            type="file"
            accept=".txt,.js,.py,.sh"
            onChange={handleFileUpload}
            className="mt-1 block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border file:border-gray-300 file:text-sm file:font-semibold file:bg-gray-50 file:text-gray-700 hover:file:bg-gray-100 dark:file:bg-gray-800 dark:file:text-gray-300 dark:hover:file:bg-gray-700"
          />
        </div>
      </div>

      <div className="flex justify-end items-center space-x-4">
        <button
          type="button"
          onClick={() => router.back()}
          className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          disabled={isSaving}
        >
          Cancel
        </button>
        {isSaving ? (
          <div className="flex items-center space-x-2">
            <SpinnerIcon />
            <span>Saving Information...</span>
          </div>
        ) : saveStatus === "success" ? (
          <div className="flex items-center space-x-2 text-green-500">
            <SuccessIcon />
            <span>Saved Successfully</span>
          </div>
        ) : saveStatus === "error" ? (
          <div className="flex items-center space-x-2 text-red-500">
            <ErrorIcon />
            <span>Failed to Save</span>
          </div>
        ) : (
          <button
            type="submit"
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 focus:outline-none focus:ring focus:ring-blue-300"
          >
            Save Changes
          </button>
        )}
      </div>
    </form>
  );
};

export default ScriptEditForm;