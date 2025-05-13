"use client";
import React, { useEffect, useState } from "react";
import Form from "@/components/form/Form";
import Input from "@/components/form/input/InputField";
import Label from "@/components/form/Label";
import Button from "@/components/ui/button/Button";
import Select from "@/components/form/Select";
import ProxyImage from "@/components/ui/images/ProxyImage";
import { Machine, machineTypes } from "@/types";
import { useCloudConnectorQuery } from "@/hooks/api/cloudConnectors/useCloudConnectorsData";
import { useImageQuery } from "@/hooks/api/images/useImageQuery";
import CodeEditor from "../ui/codeEditor/codeEditor";

export interface ImageFormData {
  baseImageIdentifier?: number;
  name: string;
  description: string;
  machine: { id: number };
  cloudConnector?: { id: number };
  scriptVars?: Record<string, unknown>;
  envVars?: Record<string, unknown>;
}

interface ImageFormProps {
  onSubmitAndConnect: (data: ImageFormData) => void;
  onCancel: () => void;
  isLoading: boolean;
}

const ImageForm: React.FC<ImageFormProps> = ({
  onSubmitAndConnect,
  onCancel,
  isLoading,
}) => {
  const [formValues, setFormValues] = useState<{
    name: string;
    description: string;
    selectedMachine: string;
    selectedConnector: number | null;
    baseImageIdentifier: number | null; // Allow both null and string
    scriptVars: Record<string, unknown>;
    envVars: Record<string, unknown>;
  }>({
    name: "",
    description: "",
    selectedMachine: machineTypes[1]?.identifier || "",
    selectedConnector: null,
    baseImageIdentifier: null, // No default image selected
    scriptVars: {},
    envVars: {},
  });

  const { data: connectors = [] } = useCloudConnectorQuery();
  const { data: images = [] } = useImageQuery();

  const [scriptVarsError, setScriptVarsError] = useState(false);
  const [envVarsError, setEnvVarsError] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const imageOptions = images.filter((image) => image.status === 'active').map((image) => ({
    value: image.id.toString(), // Convert the ID to a string
    label: `${image.name || "Unnamed Image"}`,
  }));

  useEffect(() => {
    // Clear form error when base image or connector changes
    if (formValues.baseImageIdentifier || formValues.selectedConnector) {
      setFormError(null);
    }
  }, [formValues.baseImageIdentifier, formValues.selectedConnector]);

  const handleChange = (field: string, value: unknown) => {
    setFormValues((prev) => ({ ...prev, [field]: value }));
  };

  const handleBaseImageChange = (imageId: string) => {
    const selectedImage = images.find((image) => image.id === parseInt(imageId));

    if (selectedImage) {
      setFormValues((prev) => ({
        ...prev,
        baseImageIdentifier: selectedImage.id || 0,
        selectedConnector: selectedImage.cloudConnectorId || 0,
      }));
      setFormError(null); // Clear any previous error
    }
  };

  const handleJsonChange = (fieldName: "scriptVars" | "envVars", value: string) => {
    const isValid = (() => {
      try {
        JSON.parse(value);
        return true;
      } catch {
        return false;
      }
    })();

    if (fieldName === "scriptVars") setScriptVarsError(!isValid);
    if (fieldName === "envVars") setEnvVarsError(!isValid);

    if (isValid) {
      handleChange(fieldName, JSON.parse(value));
    }
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!formValues.baseImageIdentifier) {
      setFormError("Please select a base image.");
      return;
    }

    const connector = connectors.find(
      (c) => c.id === formValues.selectedConnector
    );
    const machine = machineTypes.find(
      (m) => m.identifier === formValues.selectedMachine
    ) || machineTypes[1];

    const submitData: ImageFormData = {
      name: formValues.name,
      description: formValues.description,
      machine: machine,
      cloudConnector: connector,
      baseImageIdentifier: formValues.baseImageIdentifier,
      envVars: formValues.envVars,
      scriptVars: formValues.scriptVars,
    };

    onSubmitAndConnect(submitData);
  };

  const getSelectedMachineObject = (): Machine => {
    return machineTypes.find((m) => m.identifier === formValues.selectedMachine) || machineTypes[1];
  };

  const currentMachine = getSelectedMachineObject();

  return (
    <div className="container mx-auto">
      <Form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {/* Basic Information Section */}
          <div className="col-span-full mb-4">
            <h2 className="text-lg font-medium text-gray-700 dark:text-white/80">
              Basic Information
            </h2>
            <div className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              General information about the VM image
            </div>
          </div>

          {/* Image Name */}
          <div className="col-span-full md:col-span-1">
            <Label htmlFor="name">Image Name</Label>
            <Input
              id="name"
              name="name"
              placeholder="e.g., Ubuntu Developer"
              defaultValue={formValues.name}
              onChange={(e) => handleChange("name", e.target.value)}
            />
          </div>

          {/* Base Image */}
          <div className="col-span-full md:col-span-1">
            <Label htmlFor="image">Base Image</Label>
            {images.length > 0 ? (
              <Select
                defaultValue={formValues.baseImageIdentifier?.toString() || ""}
                onChange={(value) => handleBaseImageChange(value)}
                options={imageOptions}
              />
            ) : (
              <div className="flex items-center h-[42px] px-4 border border-gray-300 rounded-lg bg-gray-100 dark:bg-gray-800 dark:border-gray-700">
                <p className="text-gray-500 dark:text-gray-400 text-sm">
                  No active images available.
                </p>
              </div>
            )}
            {formError && (
              <p className="text-red-500 mt-2">{formError}</p>
            )}
          </div>

          {/* Description */}
          <div className="col-span-full">
            <Label htmlFor="description">Description</Label>
            <textarea
              id="description"
              name="description"
              placeholder="Description of the image and its purpose"
              value={formValues.description}
              onChange={(e) => handleChange("description", e.target.value)}
              className="h-24 w-full rounded-lg border border-gray-300 bg-transparent py-2.5 px-4 text-sm text-gray-800 shadow-theme-xs placeholder:text-gray-400 focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:placeholder:text-white/30 dark:focus:border-brand-800"
            />
          </div>

          {/* Script Variables */}
          <div className="col-span-full">
            <Label htmlFor="scriptVars">Script Variables (JSON)</Label>
            <CodeEditor
              language="json"
              value={JSON.stringify(formValues.scriptVars || {}, null, 2)}
              onChange={(value) => handleJsonChange("scriptVars", value)}
            />
            {scriptVarsError && (
              <p className="mt-1 text-sm text-red-500">Invalid JSON format. Please correct the input.</p>
            )}
          </div>

          {/* Environment Variables */}
          <div className="col-span-full">
            <Label htmlFor="envVars">Environment Variables (JSON)</Label>
            <CodeEditor
              language="json"
              value={JSON.stringify(formValues.envVars || {}, null, 2)}
              onChange={(value) => handleJsonChange("envVars", value)}
            />
            {envVarsError && (
              <p className="mt-1 text-sm text-red-500">Invalid JSON format. Please correct the input.</p>
            )}
          </div>

          {/* Selected Cloud Provider Info */}
          {formValues.selectedConnector && (() => {
            const connector = connectors.find((connector) => connector.id === formValues.selectedConnector);
            if(!connector) return null;

            return (
              <div className="col-span-full mb-4 mt-4">
                <h2 className="text-lg font-medium text-gray-700 dark:text-white/80">
                  Cloud Provider Information
                </h2>
                <div className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  Details of the selected cloud provider
                </div>
                <div className="mt-4 p-4 border border-gray-200 rounded-lg dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Provider</p>
                      <div className="flex items-center gap-2 mt-1">
                        <div className="w-6 h-6 relative flex-shrink-0">
                          {connector.image ? (
                            <ProxyImage
                              src={connector.image}
                              alt={connector.name || "Cloud provider"}
                              width={32}
                              height={32}
                              className="w-full h-full object-contain"
                            />
                          ) : (
                            <div className="w-full h-full bg-gray-200 dark:bg-gray-700 rounded-full"></div>
                          )}
                        </div>
                        <p className="text-base font-medium dark:text-gray-200">
                          {connector.name}
                        </p>
                      </div>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Region</p>
                      <p className="text-base font-medium dark:text-gray-200">
                        {connector.region}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Type</p>
                      <p className="text-base font-medium dark:text-gray-200">
                        {connector.type}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Status</p>
                      <p className="text-base font-medium dark:text-gray-200">
                        {connector.status ? "Active" : "Inactive"}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Machine Configuration Section */}
          <div className="col-span-full mb-4 mt-4">
            <h2 className="text-lg font-medium text-gray-700 dark:text-white/80">
              Machine Configuration
            </h2>
            <div className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Resource specifications for VM instances
            </div>
          </div>

          {/* Machine Details */}
          <div className="col-span-full p-4 border border-gray-200 rounded-lg dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">CPU</p>
                <p className="text-base font-medium dark:text-gray-200">
                  {currentMachine.cpuCount} {currentMachine.cpuCount === 1 ? "Core" : "Cores"}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Memory</p>
                <p className="text-base font-medium dark:text-gray-200">{currentMachine.memorySize} GB</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Storage</p>
                <p className="text-base font-medium dark:text-gray-200">{currentMachine.storageSize} GB</p>
              </div>
            </div>
            <div className="mt-3">
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Instance Type</p>
              <p className="text-base font-medium dark:text-gray-200">{currentMachine.identifier}</p>
            </div>
          </div>
        </div>

        {/* Form Actions */}
        <div className="flex justify-end gap-3 mt-8">
          <Button
            size="sm"
            variant="outline"
            onClick={onCancel}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button
            size="sm"
            variant="primary"
            type="submit"
            disabled={isLoading || !formValues.baseImageIdentifier}
          >
            {isLoading ? "Preparing..." : "Connect & Prepare"}
          </Button>
        </div>
      </Form>
    </div>
  );
};

export default ImageForm;