"use client";
import React from "react";
import Form from "../form/Form";
import Input from "../form/input/InputField";
import {
  CloudIcon,
  GlobeIcon,
  KeyIcon,
  LockIcon,
  EyeOpenIcon,
  EyeClosedIcon,
} from "../../icons";
import Button from "../ui/button/Button";
import Select from "../form/Select";
import { BackendCloudConnectorRequest } from "@/types";
import { cloudConnectorsApi } from "@/services/cloud-resources/cloudConnectors";

type CloudProvider = "aws" | "azure" | "gcp";

interface RegionOption {
  value: string;
  label: string;
}

interface ProviderOption {
  value: CloudProvider;
  label: string;
}

interface CloudConnectorFormProps {
  onCancel: () => void;
}

const CloudConnectorForm: React.FC<CloudConnectorFormProps> = ({onCancel }) => {
  const [showAccessKey, setShowAccessKey] = React.useState(false);
  const [showSecretKey, setShowSecretKey] = React.useState(false);

  const cloudProviders: ProviderOption[] = [
    { value: "aws", label: "Amazon Web Services" },
    { value: "azure", label: "Microsoft Azure" },
    { value: "gcp", label: "Google Cloud Platform" },
  ];

  const regions: Record<CloudProvider, RegionOption[]> = {
    aws: [
      { value: "us-east-1", label: "US East (N. Virginia)" },
      { value: "us-west-2", label: "US West (Oregon)" },
      { value: "eu-west-1", label: "EU (Ireland)" },
      { value: "ap-northeast-1", label: "Asia Pacific (Tokyo)" },
    ],
    azure: [
      { value: "eastus", label: "East US" },
      { value: "westeurope", label: "West Europe" },
      { value: "southeastasia", label: "Southeast Asia" },
    ],
    gcp: [
      { value: "us-central1", label: "Iowa (us-central1)" },
      { value: "europe-west1", label: "Belgium (europe-west1)" },
      { value: "asia-east1", label: "Taiwan (asia-east1)" },
    ],
  };

  const [selectedProvider, setSelectedProvider] = React.useState(cloudProviders[0].value);
  const [selectedRegion, setSelectedRegion] = React.useState(regions.aws[0].value);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const formElements = form.elements as HTMLFormControlsCollection;

    const accessKeyInput = formElements.namedItem("accessKey") as HTMLInputElement;
    const secretKeyInput = formElements.namedItem("secretKey") as HTMLInputElement;

    const connectorData: BackendCloudConnectorRequest = {
      provider: selectedProvider,
      region: selectedRegion,
      access_key: accessKeyInput?.value || "",
      secret_key: secretKeyInput?.value || "",
    };

    // TODO: Add cloudConnectorsApi.create method to send POST request to the backend
    console.log("Connector Data:", connectorData);
    try {
      const response = await cloudConnectorsApi.create(connectorData);
      if (response) {
        console.log("Connector created successfully:", response);
        // Optionally, you can call a callback function to refresh the list of connectors or close the form
      }
      else {
        console.error("Failed to create connector");
      }
    }
    catch (error) {
      console.error("Error creating connector:", error);
    }
  };

  return (
    <Form onSubmit={handleSubmit}>
      <div className="grid grid-cols-1 gap-6">
        {/* Cloud Provider Selection */}
        <div className="relative">
          <Select
            options={cloudProviders}
            defaultValue={selectedProvider}
            onChange={(value) => {
              const provider = value as CloudProvider;
              setSelectedProvider(provider);
              setSelectedRegion(regions[provider][0].value);
            }}
            className="pl-11"
            placeholder="Select Cloud Provider"
          />
          <span className="absolute text-gray-500 -translate-y-1/2 pointer-events-none left-4 top-1/2 dark:text-gray-400">
            <CloudIcon />
          </span>
        </div>

        {/* Region Selection */}
        <div className="relative">
          <Select
            options={regions[selectedProvider]}
            defaultValue={selectedRegion}
            onChange={(value) => setSelectedRegion(value)}
            className="pl-11"
            placeholder="Select Region"
          />
          <span className="absolute text-gray-500 -translate-y-1/2 pointer-events-none left-4 top-1/2 dark:text-gray-400">
            <GlobeIcon />
          </span>
        </div>

        {/* Access Key Input */}
        <div className="relative">
          <Input
            type={showAccessKey ? "text" : "password"}
            placeholder="Access Key"
            id="accessKey"
            name="accessKey"
            className="pl-11 pr-10"
          />
          <span className="absolute text-gray-500 -translate-y-1/2 pointer-events-none left-4 top-1/2 dark:text-gray-400">
            <KeyIcon />
          </span>
          <button
            type="button"
            className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-500 dark:text-gray-400"
            onClick={() => setShowAccessKey(!showAccessKey)}
          >
            {showAccessKey ? <EyeClosedIcon /> : <EyeOpenIcon />}
          </button>
        </div>

        {/* Secret Key Input */}
        <div className="relative">
          <Input
            type={showSecretKey ? "text" : "password"}
            placeholder="Secret Key"
            id="secretKey"
            name="secretKey"
            className="pl-11 pr-10"
          />
          <span className="absolute text-gray-500 -translate-y-1/2 pointer-events-none left-4 top-1/2 dark:text-gray-400">
            <LockIcon />
          </span>
          <button
            type="button"
            className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-500 dark:text-gray-400"
            onClick={() => setShowSecretKey(!showSecretKey)}
          >
            {showSecretKey ? <EyeClosedIcon /> : <EyeOpenIcon />}
          </button>
        </div>

        {/* Form Actions */}
        <div className="flex justify-end gap-3 mt-4">
          <Button size="sm" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button size="sm" variant="primary" type="submit">
            Create Connector
          </Button>
        </div>
      </div>
    </Form>
  );
};

export default CloudConnectorForm;