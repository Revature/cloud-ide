"use client";

import React, { useState, useEffect } from "react";
import Label from "@/components/form/Label";
import Select from "@/components/form/Select";
import { SpinnerIcon, SuccessIcon, ErrorIcon } from "@/components/ui/icons/CustomIcons";
import CodeEditor from "../ui/codeEditor/codeEditor";
import { ScriptRequest } from "@/types/scripts";
import { useScriptById, useUpdateScript } from "@/hooks/type-query/useScripts";
import Form from "../form/Form";
import Input from "../form/input/InputField";

interface ScriptEditFormProps {
  scriptId: number;
  imageId: number;
  onCancel: () => void; // Callback for cancel button
}

const ScriptEditForm: React.FC<ScriptEditFormProps> = ({ scriptId, onCancel, imageId }) => {

  // Fetch the script data using the script ID
  const { data: script, isLoading, error } = useScriptById(scriptId);
  const { mutateAsync: updateScript } = useUpdateScript(imageId);

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
    // { value: "on_connect", label: "On Connect - When a user connects to a runner" },
    // { value: "on_disconnect", label: "On Disconnect - When a user disconnects from a runner" },
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
      const updates:Partial<ScriptRequest> = {
        name,
        description,
        event,
        script: scriptContent,
      };
      await updateScript({ id: scriptId, data: updates });
      setSaveStatus("success");

      // Wait for 2 seconds before navigating back to the script's view page
      setTimeout(() => {
        onCancel();
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
    <Form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
      <div className="col-span-full md:col-span-1">
        <Label htmlFor="name">Script Name</Label>
        <Input
          id="name"
          type="text"
          defaultValue={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full mt-1 rounded-lg border-gray-300 shadow-sm focus:border-brand-300 focus:ring focus:ring-brand-200 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
          placeholder="Enter script name..."
        />
      </div>

      <div className="col-span-full md:col-span-1">
        <Label htmlFor="event">Event Type</Label>
        <Select
          options={eventOptions}
          defaultValue={event}
          onChange={(value) => setEvent(value)}
        />
      </div>

      <div className="col-span-full">
        <Label htmlFor="description">Description</Label>
        <textarea
          id="description"
          name="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="dark:bg-dark-900 h-24 w-full rounded-lg border border-gray-300 bg-transparent py-2.5 px-4 text-sm text-gray-800 shadow-theme-xs placeholder:text-gray-400 focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:placeholder:text-white/30 dark:focus:border-brand-800"
        />
      </div>

      <div>
        <Label htmlFor="script">Script</Label>
        <CodeEditor value={scriptContent} onChange={setScriptContent} language="shell"/>
      </div>
      </div>

      <div className="flex justify-end items-center space-x-4">
        <button
          type="button"
          onClick={onCancel}
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
    </Form>
  );
};

export default ScriptEditForm;