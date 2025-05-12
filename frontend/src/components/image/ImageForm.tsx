"use client";
import React, { useEffect, useState } from "react";
import Form from "@/components/form/Form";
import Input from "@/components/form/input/InputField";
import Label from "@/components/form/Label";
import Button from "@/components/ui/button/Button";
import Select from "@/components/form/Select";
import ProxyImage from "@/components/ui/images/ProxyImage";
import { CloudConnector, Machine, machineTypes } from "@/types";
import { useCloudConnectorQuery } from "@/hooks/api/cloudConnectors/useCloudConnectorsData";
import { useImageQuery } from "@/hooks/api/images/useImageQuery";
import Link from "next/link";
import { useSyncedFormState } from "@/hooks/useSyncedFormState";
import CodeEditor from "../ui/codeEditor/codeEditor";

interface ImageFormDataForHook {
  name: string;
  description: string;
  selectedMachine: string; // Store identifier
  active: boolean;
  selectedConnector: string; // Store identifier (name)
  baseImageIdentifier: number; // Store identifier
  envVars: Record<string, unknown>; // JSON object for environment variables
  scriptVars?: Record<string, unknown>; // JSON object for script variables
}

// Define the shape of the data being submitted
export interface ImageFormData {
  baseImageIdentifier?: number;
  name: string;
  description: string;
  machine: { id: number };
  cloudConnector?: { id: number };
  scriptVars?: Record<string, unknown>; // JSON object for script variables
  envVars?: Record<string, unknown>; // JSON object for environment variables
}

interface ImageFormProps {
  onSubmitAndConnect: (data:ImageFormData) => void;
  onFinalSubmit: () => void;
  isLoading: boolean;
  canFinalSubmit: boolean;
  onCancel: () => void;
  initialData?: Partial<ImageFormDataForHook> | null;
}
// --- Define Default Values for the Form ---
const defaultFormValues: ImageFormDataForHook = {
  name: '',
  description: '',
  selectedMachine: machineTypes[1]?.identifier || '', // Ensure machineTypes is loaded or handle default safely
  active: true,
  selectedConnector: '', // Defaults will be set by useEffect below if possible
  baseImageIdentifier: 0, // Defaults will be set by useEffect below if possible
  envVars: {}, // Default to an empty object
};

const validateJsonInput = (value: string): boolean => {
  try {
    JSON.parse(value);
    return true;
  } catch {
    return false;
  }
};

const ImageForm: React.FC<ImageFormProps> = ({
  onSubmitAndConnect,
  onFinalSubmit,
  isLoading,
  canFinalSubmit,
  onCancel,
  initialData
}) => {


  const { values, handleChange, setValues } = useSyncedFormState<ImageFormDataForHook>(
    initialData,
    defaultFormValues
  );
  
  // Obtain info from out ReactQuery
  const { data:connectors = [] } = useCloudConnectorQuery()
  const { data:images = [] } = useImageQuery()

  const [scriptVarsError, setScriptVarsError] = useState(false);
  const [envVarsError, setEnvVarsError] = useState(false);

  useEffect(() => {
    let needsUpdate = false;
    const newState = { ...values };

    // Set default connector only if not already set and the form is being initialized
    if (!initialData?.selectedConnector && !values.selectedConnector && connectors && connectors.length > 0) {
      const defaultConnector = connectors.find((c) => c.status)?.name ?? "";
      if (defaultConnector) {
        newState.selectedConnector = defaultConnector;
        needsUpdate = true;
      }
    }

    // Set default base image only if not already set
    if (!initialData?.baseImageIdentifier && !values.baseImageIdentifier && images && images.length > 0) {
      const defaultImageId = images[0]?.id ?? ""; // Use the ID instead of the identifier
      if (defaultImageId) {
        newState.baseImageIdentifier = defaultImageId;
        needsUpdate = true;
      }
    }

    if (needsUpdate) {
      setValues(newState);
    }
  }, [connectors, images, values, setValues, initialData]);

  const getSelectedMachineObject = (): Machine => {
    return machineTypes.find(m => m.identifier === values.selectedMachine) || machineTypes[1];
  };
  const getSelectedConnectorObject = (): CloudConnector | undefined => {
    return connectors.find(c => c.name === values.selectedConnector && c.status);
  };

  // Create options for the base image dropdown
  const imageOptions = images.filter((image) => image.status === 'active').map((image) => ({
    value: image.id.toString(), // Convert the ID to a string
    label: `${image.name || "Unnamed Image"}`,
  }));

  const handleFinalSubmitClick = () => {
    onFinalSubmit();
  }

  const handleSubmitForConnect = (e?: React.FormEvent<HTMLFormElement>) => {
    e?.preventDefault();
    const connector = getSelectedConnectorObject();
    const machine = getSelectedMachineObject();

    const submitData: ImageFormData = {
      name: values.name,
      description: values.description,
      machine: machine,
      cloudConnector: connector,
      baseImageIdentifier: values.baseImageIdentifier, // This now holds the ID
      envVars: values.envVars,
      scriptVars: values.scriptVars,
    };
    onSubmitAndConnect(submitData);
  };

  // Custom function to handle JSON input changes
  const handleJsonChange = (fieldName: "scriptVars" | "envVars", value: string) => {
    const isValid = validateJsonInput(value);
  
    if (fieldName === "scriptVars") {
      setScriptVarsError(!isValid);
    } else if (fieldName === "envVars") {
      setEnvVarsError(!isValid);
    }
  
    // Do not update the form state if the JSON is invalid
    if (isValid) {
      handleChange(fieldName, JSON.parse(value));
    }
  };

  // Helper function to check if all required fields are edited
  const areAllFieldsEdited = (): boolean => {
    const requiredFields = [
      values.name,
      values.description,
      values.selectedMachine,
      values.selectedConnector,
      values.baseImageIdentifier,
    ];
  
    // Check if all required fields are non-empty and differ from their default values
    return requiredFields.every((field) => field !== "" && field !== undefined && field !== null) &&
      JSON.stringify(values) !== JSON.stringify(defaultFormValues);
  };

  // Get the current machine details for display
  const currentMachine = getSelectedMachineObject();

  return (
    <div className="container mx-auto">
      <Form onSubmit={handleSubmitForConnect}>
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
              defaultValue={values.name}
              onChange={(e) => handleChange('name', e.target.value)}
            />
          </div>

          {/* Base Image */}
          <div className="col-span-full md:col-span-1">
            <Label htmlFor="image">Base Image</Label>
            {images.length > 0 ? (
              <Select
                options={imageOptions}
                defaultValue={values.baseImageIdentifier.toString()}
                onChange={(value) => handleChange("baseImageIdentifier", value)}
              />
            ) : (
              <div className="flex items-center h-[42px] px-4 border border-gray-300 rounded-lg bg-gray-100 dark:bg-gray-800 dark:border-gray-700">
                <p className="text-gray-500 dark:text-gray-400 text-sm">
                  No active images available.
                  <Link href="/images" className="text-brand-500 ml-1 hover:underline">
                    Add an image
                  </Link>
                </p>
              </div>
            )}
          </div>

          {/* Description */}
          <div className="col-span-full">
            <Label htmlFor="description">Description</Label>
            <textarea
              id="description"
              name="description"
              placeholder="Description of the image and its purpose"
              defaultValue={values.description}
              onChange={(e) => handleChange('description', e.target.value)}
              className="dark:bg-dark-900 h-24 w-full rounded-lg border border-gray-300 bg-transparent py-2.5 px-4 text-sm text-gray-800 shadow-theme-xs placeholder:text-gray-400 focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:placeholder:text-white/30 dark:focus:border-brand-800"
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
              defaultValue={JSON.stringify(values.scriptVars || {}, null, 2)}
              onChange={(e) => handleJsonChange("scriptVars", e.target.value)}
              className={`dark:bg-dark-900 h-24 w-full rounded-lg border ${
                scriptVarsError ? "border-red-500" : "border-gray-300"
              } bg-transparent py-2.5 px-4 text-sm text-gray-800 shadow-theme-xs placeholder:text-gray-400 focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:placeholder:text-white/30 dark:focus:border-brand-800`}
            />
            {scriptVarsError && (
              <p className="mt-1 text-sm text-red-500">Invalid JSON format. Please correct the input.</p>
            )}
          </div> */}

          {/* Environment Variables
          <div className="col-span-full">
            <Label htmlFor="envVars">Environment Variables (JSON)</Label>
            <textarea
              id="envVars"
              name="envVars"
              placeholder='e.g., {"key": "value"}'
              defaultValue={JSON.stringify(values.envVars || {}, null, 2)}
              onChange={(e) => handleJsonChange("envVars", e.target.value)}
              className={`dark:bg-dark-900 h-24 w-full rounded-lg border ${
                envVarsError ? "border-red-500" : "border-gray-300"
              } bg-transparent py-2.5 px-4 text-sm text-gray-800 shadow-theme-xs placeholder:text-gray-400 focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:placeholder:text-white/30 dark:focus:border-brand-800`}
            />
            {envVarsError && (
              <p className="mt-1 text-sm text-red-500">Invalid JSON format. Please correct the input.</p>
            )}
          </div> */}

        <div className="col-span-full">
            <Label htmlFor="scriptVars">Script Variables (JSON)</Label>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Add any script-specific variables required for your image. For example, you can include fields like <code>git_url</code> and <code>git_username</code>.
            </p>
            <CodeEditor
              language="json"
              value={JSON.stringify(values.scriptVars || {}, null, 2)}
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
              value={JSON.stringify(values.envVars || {}, null, 2)}
              onChange={(value) => handleJsonChange("envVars", value)}
              />
            {envVarsError && (
              <p className="mt-1 text-sm text-red-500">Invalid JSON format. Please correct the input.</p>
            )}
          </div>   

          {/* Selected Cloud Provider Info */}
          {values.selectedConnector && (() => {
            // Get the connector object inside this scope
            const connector = getSelectedConnectorObject();
            // Only proceed if we have a connector
            if (!connector) return null;
            
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
                              alt={connector.name || 'Cloud provider'}
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
                <p className="text-base font-medium dark:text-gray-200">{currentMachine.cpuCount} {currentMachine.cpuCount === 1 ? "Core" : "Cores"}</p>
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

        {/* --- Form Actions --- */}
        <div className="flex justify-end gap-3 mt-8 items-center">
          <Button
            size="sm"
            variant="outline"
            onClick={onCancel}
            disabled={isLoading && canFinalSubmit}
            type="button" // Ensure it's not type="submit"
          >
            Cancel
          </Button>
          {!canFinalSubmit ? (
            <Button
              size="sm"
              variant="primary"
              type="submit"
              disabled={
                isLoading ||
                !values.selectedConnector ||
                connectors.filter((c) => c.status).length === 0 ||
                !areAllFieldsEdited()
              }
              title={
                !values.selectedConnector || connectors.filter((c) => c.status).length === 0
                  ? "You need an active cloud connector"
                  : "Prepare terminal session"
              }
            >
              {isLoading ? "Preparing..." : "Connect & Prepare"}
            </Button>
          ) : (
            <Button
              size="sm"
              variant="success"
              type="button"
              onClick={handleFinalSubmitClick}
              disabled={isLoading}
            >
              {isLoading ? "Submitting..." : "Submit Final Request"}
            </Button>
          )}
          {isLoading && <span className="text-sm italic">Processing...</span>}
        </div>
      </Form>
    </div>
  );
};

export default ImageForm;