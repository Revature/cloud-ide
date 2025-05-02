"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Label from "@/components/form/Label";
import Select from "@/components/form/Select";
import { useScriptsQuery } from "@/hooks/api/scripts/useScriptsQuery";
import { scriptsApi } from "@/services/cloud-resources/scripts";
import { SpinnerIcon, SuccessIcon, ErrorIcon } from "@/components/ui/icons/CustomIcons";
import CodeEditor from "../ui/codeEditor/codeEditor";
import { useQueryClient } from "@tanstack/react-query";

interface ScriptEditFormProps {
  scriptId: number;
}

const ScriptEditForm: React.FC<ScriptEditFormProps> = ({ scriptId }) => {
  const router = useRouter();
  const queryClient = useQueryClient();

  // Fetch the script data using the script ID
  const { data: script, isLoading, error } = useScriptsQuery(scriptId);

  // State for form fields
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [event, setEvent] = useState("on_create");
  const [scriptContent, setScriptContent] = useState("");

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

  useEffect(() => {
    if (script) {
      setName(script.name);
      setDescription(script.description);
      setEvent(script.event);
      setScriptContent(script.script);
    }
  }, [script]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveStatus("idle");

    try {
      // Call the scriptsApi.update function to update the script
      await scriptsApi.update(scriptId, { name, description, event, script: scriptContent });
      setSaveStatus("success");

      // Invalidate the query to refresh the script data
      queryClient.invalidateQueries({ queryKey: ["script", scriptId] });

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
          placeholder="Enter script name..."
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
          placeholder="Description about what this script does..."
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
        <CodeEditor value={scriptContent} onChange={setScriptContent} />
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