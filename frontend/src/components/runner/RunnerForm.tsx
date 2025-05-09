"use client";

import React, { useEffect, useState } from "react";
import Form from "@/components/form/Form";
import Label from "@/components/form/Label";
import Button from "@/components/ui/button/Button";
import Select from "@/components/form/Select";
import { useImageQuery } from "@/hooks/api/images/useImageQuery";
import { VMImage } from "@/types";
import CodeEditor from "../ui/codeEditor/codeEditor";

export interface RunnerFormData {
  image: VMImage;
  durationMinutes: number;
  envVars?: Record<string, unknown>;
  scriptVars?: Record<string, unknown>;
}

interface RunnerFormProps {
  onSubmit: (data: RunnerFormData) => void;
  onCancel: () => void;
}

const RunnerForm: React.FC<RunnerFormProps> = ({ onSubmit, onCancel }) => {
  const { data: images = [] } = useImageQuery();

  // Convert images for select dropdown
  const imageOptions = images.map((image) => ({
    value: image.id.toString(),
    label: `${image.name}`,
  }));

  // Duration options
  const durationOptions = [
    { value: "60", label: "1 hour" },
    { value: "120", label: "2 hours" },
    { value: "180", label: "3 hours (default)" },
    { value: "240", label: "4 hours" },
    { value: "360", label: "6 hours" },
    { value: "480", label: "8 hours" },
    { value: "720", label: "12 hours" },
    { value: "1440", label: "24 hours" },
  ];

  // Local state for form fields
  const [selectedImage, setSelectedImage] = useState<string>("");
  const [durationMinutes, setDurationMinutes] = useState<string>("180"); // Default to 3 hours
  const [envVars, setEnvVars] = useState<Record<string, unknown>>({});
  const [scriptVars, setScriptVars] = useState<Record<string, unknown>>({});
  const [scriptVarsError, setScriptVarsError] = useState(false);
  const [envVarsError, setEnvVarsError] = useState(false);
  const [allFieldsEdited, setAllFieldsEdited] = useState(false);

  // Set default image when images are loaded
  useEffect(() => {
    if (!selectedImage && images.length > 0) {
      setSelectedImage(images[0].id.toString());
    }
  }, [images, selectedImage]);

  // Check if all fields have been edited
  useEffect(() => {
    const isEdited =
      selectedImage &&
      durationMinutes &&
      !scriptVarsError &&
      !envVarsError &&
      Object.keys(envVars).length > 0 &&
      Object.keys(scriptVars).length > 0;

    setAllFieldsEdited(Boolean(isEdited));
  }, [selectedImage, durationMinutes, scriptVars, envVars, scriptVarsError, envVarsError]);

  // Get the selected image object
  const getSelectedImageObject = (): VMImage | undefined => {
    return images.find((image) => image.id.toString() === selectedImage);
  };

  // Handle form submission
  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    console.log("handleSubmit called");
    const selectedImageObj = getSelectedImageObject();
    if (!selectedImageObj) {
      console.error("No valid image selected");
      return;
    }

    const formData: RunnerFormData = {
      image: selectedImageObj,
      durationMinutes: parseInt(durationMinutes),
      envVars,
      scriptVars,
    };

    onSubmit(formData);
  };

  // Custom function to handle JSON input changes
  const handleJsonChange = (fieldName: "scriptVars" | "envVars", value: string) => {
    const isValid = (() => {
      try {
        JSON.parse(value);
        return true;
      } catch {
        return false;
      }
    })();

    if (fieldName === "scriptVars") {
      setScriptVarsError(!isValid);
      if (isValid) setScriptVars(JSON.parse(value));
    } else if (fieldName === "envVars") {
      setEnvVarsError(!isValid);
      if (isValid) setEnvVars(JSON.parse(value));
    }
  };

  return (
    <div className="container mx-auto">
      <Form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {/* Runner Configuration Section */}
          <div className="col-span-full mb-4">
            <h2 className="text-lg font-medium text-gray-700 dark:text-white/80">
              Runner Configuration
            </h2>
            <div className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Configure the VM instance that will be provisioned.
            </div>
          </div>

          {/* Image Selection */}
          <div className="col-span-full md:col-span-1">
            <Label htmlFor="image">VM Image</Label>
            {images.length > 0 ? (
              <Select
                options={imageOptions}
                defaultValue={selectedImage}
                onChange={(value) => setSelectedImage(value)}
              />
            ) : (
              <div className="flex items-center h-[42px] px-4 border border-gray-300 rounded-lg bg-gray-100 dark:bg-gray-800 dark:border-gray-700">
                <p className="text-gray-500 dark:text-gray-400 text-sm">
                  No active images available.
                  <a href="/images/add" className="text-brand-500 ml-1 hover:underline">
                    Add an image
                  </a>
                </p>
              </div>
            )}
          </div>

          {/* Session Duration */}
          <div className="col-span-full md:col-span-1">
            <Label htmlFor="duration">Session Duration</Label>
            <Select
              options={durationOptions}
              defaultValue={durationMinutes}
              onChange={(value) => setDurationMinutes(value)}
            />
          </div>

          {/* Script Variables
          <div className="col-span-full">
            <Label htmlFor="scriptVars">Script Variables (JSON)</Label>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Add any script-specific variables required for your image. For example, you can include fields like <code>git_url</code> and <code>git_username</code>.
            </p>
            <textarea
              id="scriptVars"
              name="scriptVars"
              placeholder='e.g., {"git_url": "https://github.com/user/repo", "git_username": "your-username"}'
              defaultValue={JSON.stringify(scriptVars || {}, null, 2)}
              onChange={(e) => handleJsonChange("scriptVars", e.target.value)}
              className={`dark:bg-dark-900 h-24 w-full rounded-lg border ${
                scriptVarsError ? "border-red-500" : "border-gray-300"
              } bg-transparent py-2.5 px-4 text-sm text-gray-800 shadow-theme-xs placeholder:text-gray-400 focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:placeholder:text-white/30 dark:focus:border-brand-800`}
            />
            {scriptVarsError && (
              <p className="mt-1 text-sm text-red-500">Invalid JSON format. Please correct the input.</p>
            )}
          </div>

          {/* Environment Variables */}
          {/* <div className="col-span-full">
            <Label htmlFor="envVars">Environment Variables (JSON)</Label>
            <textarea
              id="envVars"
              name="envVars"
              placeholder='e.g., {"key": "value"}'
              defaultValue={JSON.stringify(envVars || {}, null, 2)}
              onChange={(e) => handleJsonChange("envVars", e.target.value)}
              className={`dark:bg-dark-900 h-24 w-full rounded-lg border ${
                envVarsError ? "border-red-500" : "border-gray-300"
              } bg-transparent py-2.5 px-4 text-sm text-gray-800 shadow-theme-xs placeholder:text-gray-400 focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:placeholder:text-white/30 dark:focus:border-brand-800`}
            />
            {envVarsError && (
              <p className="mt-1 text-sm text-red-500">Invalid JSON format. Please correct the input.</p>
            )}
          </div> */} 
                    {/* Script Variables */}
          <div className="col-span-full">
            <Label htmlFor="scriptVars">Script Variables (JSON)</Label>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Add any script-specific variables required for your image. For example, you can include fields like <code>git_url</code> and <code>git_username</code>.
            </p>
            <CodeEditor
              language="json"
              value={JSON.stringify(scriptVars || {}, null, 2)}
              onChange={(value) => handleJsonChange("scriptVars", value)}
            />
            {scriptVarsError && (
              <p className="mt-1 text-sm text-red-500">Invalid JSON format. Please correct the input.</p>
            )}
          </div>
          
          {/* Environment Variables */}
          <div className="col-span-full">
            <Label htmlFor="envVars">Environment Variables (JSON)</Label>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Add any environment variables required for your runner. For example, you can include fields like <code>API_KEY</code> and <code>SECRET</code>.
            </p>
            <CodeEditor
              language="json"
              value={JSON.stringify(envVars || {}, null, 2)}
              onChange={(value) => handleJsonChange("envVars", value)}
              />
            {envVarsError && (
              <p className="mt-1 text-sm text-red-500">Invalid JSON format. Please correct the input.</p>
            )}
          </div>
        </div>

        {/* Form Actions */}
        <div className="flex justify-end gap-3 mt-8">
          <Button size="sm" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            size="sm"
            variant="primary"
            type="submit"
            disabled={!allFieldsEdited}
          >
            {!allFieldsEdited ? "Complete All Fields" : "Create Runner"}
          </Button>
        </div>
      </Form>
    </div>
  );
};

export default RunnerForm;