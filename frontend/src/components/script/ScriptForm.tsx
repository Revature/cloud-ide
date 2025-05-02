"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Label from "@/components/form/Label";
import Select from "@/components/form/Select";
import { useImageQuery } from "@/hooks/api/images/useImageQuery";
import { scriptsApi } from "@/services/cloud-resources/scripts";
import { SpinnerIcon, SuccessIcon, ErrorIcon } from "@/components/ui/icons/CustomIcons";
import CodeEditor from "../ui/codeEditor/codeEditor";

interface ScriptFormProps {
  initialData?: {
    name: string;
    description: string;
    imageId: number | null;
    script: string;
    event: string;
  };
}

const ScriptForm: React.FC<ScriptFormProps> = ({ initialData }) => {
  const router = useRouter();
  const [name, setName] = useState(initialData?.name || "");
  const [description, setDescription] = useState(initialData?.description || "");
  const [imageId, setImageId] = useState<number>(initialData?.imageId || 0);
  const [script, setScript] = useState(initialData?.script || "");
  const [event, setEvent] = useState(initialData?.event || "on_create");

  // State for submission status
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<"idle" | "success" | "error">("idle");

  // Fetch available images using the custom hook
  const { data: images = [], isLoading: isLoadingImages } = useImageQuery();

  // Create options for the "Associated Image" dropdown
  const imageOptions = images.map((image) => ({
    value: image.id.toString(),
    label: image.name || "Unnamed Image",
  }));

  // Add a "No Image" option
  imageOptions.unshift({ value: "0", label: "No Image" });

  // Event options
  const eventOptions = [
    { value: "on_create", label: "On Create - When a runner is first created" },
    { value: "on_awaiting_client", label: "On Awaiting Client - When a runner is assigned to a user but before connection" },
    { value: "on_connect", label: "On Connect - When a user connects to a runner" },
    { value: "on_disconnect", label: "On Disconnect - When a user disconnects from a runner" },
    { value: "on_terminate", label: "On Terminate - When a runner is being terminated" },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitStatus("idle");

    try {
      // Call the scriptsApi.create function to create a new script
      await scriptsApi.create({ name, description, event, image_id: imageId, script });
      setSubmitStatus("success");

      // Wait for 2 seconds before navigating back to the scripts list
      setTimeout(() => {
        router.push("/scripts");
      }, 2000);
    } catch (error) {
      console.error("Failed to create script:", error);
      setSubmitStatus("error");
    } finally {
      setIsSubmitting(false);
    }
  };

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
        <Label htmlFor="image">Associated Image</Label>
        {isLoadingImages ? (
          <p className="text-gray-500 dark:text-gray-400">Loading images...</p>
        ) : (
          <Select
            options={imageOptions}
            defaultValue={imageId.toString()}
            onChange={(value) => setImageId(parseInt(value))}
          />
        )}
      </div>

      <div>
        <Label htmlFor="script">Script</Label>
        <CodeEditor value={script} onChange={setScript} />
      </div>

      <div className="flex justify-end items-center space-x-4">
        <button
          type="button"
          onClick={() => router.back()}
          className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          disabled={isSubmitting}
        >
          Cancel
        </button>
        {isSubmitting ? (
          <div className="flex items-center space-x-2">
            <SpinnerIcon />
            <span>Saving Information...</span>
          </div>
        ) : submitStatus === "success" ? (
          <div className="flex items-center space-x-2 text-green-500">
            <SuccessIcon />
            <span>Saved Successfully</span>
          </div>
        ) : submitStatus === "error" ? (
          <div className="flex items-center space-x-2 text-red-500">
            <ErrorIcon />
            <span>Failed to Save</span>
          </div>
        ) : (
          <button
            type="submit"
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 focus:outline-none focus:ring focus:ring-blue-300"
          >
            Save Script
          </button>
        )}
      </div>
    </form>
  );
};

export default ScriptForm;