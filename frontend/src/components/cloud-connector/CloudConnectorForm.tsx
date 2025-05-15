"use client";
import React, { useState } from "react";
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
import { useRouter } from "next/navigation";
import { CloudConnectorRequest } from "@/types/cloudConnectors";
import { useCreateCloudConnector } from "@/hooks/type-query/useCloudConnectors";

type CloudProvider = "aws" | "azure" | "gcp";

interface RegionOption {
  value: string;
  label: string;
}

interface ProviderOption {
  value: CloudProvider;
  label: string;
}

const CloudConnectorForm: React.FC = () => {
  const [showAccessKey, setShowAccessKey] = useState(false);
  const [showSecretKey, setShowSecretKey] = useState(false);
  const [buttonState, setButtonState] = useState<"idle" | "testing" | "failed" | "success">("idle");
  const router = useRouter();
  const { mutateAsync: createCloudConnector } = useCreateCloudConnector();

  const cloudProviders: ProviderOption[] = [
    { value: "aws", label: "Amazon Web Services" },
    { value: "azure", label: "Microsoft Azure" },
    { value: "gcp", label: "Google Cloud Platform" },
  ];

  const regions: Record<CloudProvider, RegionOption[]> = {
    aws: [
      { value: "us-east-1", label: "US East (N. Virginia)" },
      { value: "us-east-2", label: "US East (Ohio)" },
      { value: "us-west-1", label: "US West (N. California)" },
      { value: "us-west-2", label: "US West (Oregon)" },
      { value: "ap-south-1", label: "Asia Pacific (Mumbai)" },
      { value: "ap-southeast-1", label: "Asia Pacific (Singapore)" },
      { value: "ap-southeast-2", label: "Asia Pacific (Sydney)" },
      { value: "ap-northeast-1", label: "Asia Pacific (Tokyo)" },
      { value: "ap-northeast-2", label: "Asia Pacific (Seoul)" },
      { value: "ap-northeast-3", label: "Asia Pacific (Osaka)" },
      { value: "ca-central-1", label: "Canada (Central)" },
      { value: "eu-central-1", label: "Europe (Frankfurt)" },
      { value: "eu-west-1", label: "Europe (Ireland)" },
      { value: "eu-west-2", label: "Europe (London)" },
      { value: "eu-west-3", label: "Europe (Paris)" },
      { value: "eu-north-1", label: "Europe (Stockholm)" },
      { value: "sa-east-1", label: "South America (São Paulo)" },
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

  const [selectedProvider, setSelectedProvider] = useState(cloudProviders[0].value);
  const [selectedRegion, setSelectedRegion] = useState(regions.aws[0].value);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setButtonState("testing");

    const form = e.currentTarget;
    const formElements = form.elements as HTMLFormControlsCollection;

    const accessKeyInput = formElements.namedItem("accessKey") as HTMLInputElement;
    const secretKeyInput = formElements.namedItem("secretKey") as HTMLInputElement;

    const connectorData: CloudConnectorRequest = {
      provider: selectedProvider,
      region: selectedRegion,
      access_key: accessKeyInput?.value || "",
      secret_key: secretKeyInput?.value || "",
    };

    try {
      const response = await createCloudConnector(connectorData);
      if (response) {
        setButtonState("success");
        setTimeout(() => {
          router.push("/cloud-connectors");
        }, 2000);
      } else {
        setButtonState("failed");
      }
    } catch (error) {
      console.error("Error creating connector:", error);
      setButtonState("failed");
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
          <Button size="sm" variant="outline" onClick={() => router.back()}>
            Cancel
          </Button>
          <Button
            size="sm"
            variant={
              buttonState === "idle"
                ? "primary"
                : buttonState === "testing"
                ? "secondary"
                : buttonState === "failed"
                ? "destructive"
                : "success"
            }
            type="submit"
            disabled={buttonState === "testing"}
          >
            {buttonState === "idle" && "Create Connector"}
            {buttonState === "testing" && (
              <>
                <span className="spinner mr-2"></span> Testing Connection...
              </>
            )}
            {buttonState === "failed" && "Connection Failed"}
            {buttonState === "success" && "Created"}
          </Button>
        </div>
      </div>
    </Form>
  );
};

export default CloudConnectorForm;