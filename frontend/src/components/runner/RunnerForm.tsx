"use client";

import React, { useEffect, useState } from "react";
import Form from "@/components/form/Form";
import Label from "@/components/form/Label";
import Button from "@/components/ui/button/Button";
import Select from "@/components/form/Select";
import { Image } from "@/types/images";
import CodeEditor from "../ui/codeEditor/codeEditor";
import { useImages } from "@/hooks/type-query/useImages";
import BaseImageSelection from "../image/BaseImageSelection";

export interface RunnerFormData {
  image: Image;
  durationMinutes: number;
  envVars?: Record<string, unknown>;
  scriptVars?: Record<string, unknown>;
}

interface RunnerFormProps {
  onSubmit: (data: RunnerFormData) => void;
  onCancel: () => void;
}

const RunnerForm: React.FC<RunnerFormProps> = ({ onSubmit, onCancel }) => {
  const { data: images = [] } = useImages();

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
  const getSelectedImageObject = (): Image | undefined => {
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
          <div className="col-span-1 mb-4">
            <h2 className="text-lg font-medium text-gray-700 dark:text-white/80">
              Runner Configuration
            </h2>
            <div className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Configure the VM instance that will be provisioned.
            </div>
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

          {/* Image Selection (BaseImageSelection) */}
          <div className="col-span-full md:col-span-2">
            <BaseImageSelection
              images={images.filter((image) => image.status === "active")}
              onSelect={(image) => setSelectedImage(image.id.toString())}
            />
          </div>

          {/* Script Variables */}
          <div className="col-span-full md:col-span-1">
            <Label htmlFor="scriptVars">Script Variables (JSON)</Label>
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
          <div className="col-span-full md:col-span-1">
            <Label htmlFor="envVars">Environment Variables (JSON)</Label>
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