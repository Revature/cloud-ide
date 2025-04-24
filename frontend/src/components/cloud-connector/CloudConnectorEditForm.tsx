"use client";
import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
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
import Toggle from "../form/input/Toggle";
import Label from "../form/Label";
import Button from "../ui/button/Button";
import Select from "../form/Select";
import { useCloudConnectorQuery } from '@/hooks/api/cloudConnectors/useCloudConnectorsData';

type CloudProvider = 'aws' | 'azure' | 'gcp' | 'digitalocean';

interface RegionOption {
  value: string;
  label: string;
}

// Define the regions for each provider
const regions: Record<CloudProvider, RegionOption[]> = {
  aws: [
    { value: "us-east-1", label: "US East (N. Virginia)" },
    { value: "us-west-2", label: "US West (Oregon)" },
    { value: "eu-west-1", label: "EU (Ireland)" },
    { value: "ap-northeast-1", label: "Asia Pacific (Tokyo)" }
  ],
  azure: [
    { value: "eastus", label: "East US" },
    { value: "westeurope", label: "West Europe" },
    { value: "southeastasia", label: "Southeast Asia" }
  ],
  gcp: [
    { value: "us-central1", label: "Iowa (us-central1)" },
    { value: "europe-west1", label: "Belgium (europe-west1)" },
    { value: "asia-east1", label: "Taiwan (asia-east1)" }
  ],
  digitalocean: [
    { value: "nyc1", label: "New York 1" },
    { value: "sfo2", label: "San Francisco 2" },
    { value: "sgp1", label: "Singapore 1" },
    { value: "lon1", label: "London 1" }
  ]
};

// Define the service types for each provider
const types: Record<CloudProvider, string[]> = {
  aws: ["S3", "EC2", "RDS", "DynamoDB"],
  azure: ["Blob Storage", "Virtual Machines", "SQL Database", "Cosmos DB"],
  gcp: ["Cloud Storage", "Compute Engine", "Cloud SQL", "Firestore"],
  digitalocean: ["Droplet", "Spaces", "Kubernetes", "Databases"]
};

// Map display names back to provider values
const displayNameToProvider: Record<string, CloudProvider> = {
  'AWS': 'aws',
  'Azure': 'azure',
  'GCP': 'gcp',
  'DigitalOcean': 'digitalocean'
};

const ConnectorEditForm: React.FC = () => {
  const router = useRouter();
  const params = useParams();
  const connectorIndex = parseInt(params.id as string, 10) - 1;

   // Obtain connectors from CloudConnectorsTable ReactQuery
   const { data:connectors = [] } = useCloudConnectorQuery()
  
  // State for form data
  const [providerName, setProviderName] = useState('');
  const [formData, setFormData] = useState({
    provider: 'aws' as CloudProvider,
    region: '',
    type: '',
    accessKey: '',
    secretKey: '',
    active: false
  });
  
  const [showAccessKey, setShowAccessKey] = useState(false);
  const [showSecretKey, setShowSecretKey] = useState(false);

  // Load connector data
  useEffect(() => {
    if (!isNaN(connectorIndex) && connectors[connectorIndex]) {
      const connector = connectors[connectorIndex];
      if (connector.active && connector.type) {
        const providerKey = displayNameToProvider[connector.type] || 'aws';
        
        setProviderName(connector.type);
        setFormData({
          provider: providerKey,
          region: connector.region,
          type: connector.type,
          accessKey: connector.accessKey, // Load actual credential data
          secretKey: connector.secretKey, // Load actual credential data
          active: connector.active
        });
      }
    } else {
      // Handle invalid index
      router.push('/cloud-connectors');
    }
  }, [connectorIndex, connectors, router]);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    // TODO: Implement Update to Backend
    
    router.push('/cloud-connectors');
  };

  const handleToggleChange = (enabled: boolean) => {
    setFormData(prev => ({
      ...prev,
      active: enabled
    }));
  };

  const goBack = () => {
    router.push('/cloud-connectors');
  };

  return (
    <>
      <div className="flex items-center mb-6">
        <Button 
          variant="outline" 
          size="sm"
          onClick={goBack}
          className="mr-4"
        >
          <svg
            className="w-4 h-4 mr-2"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M19 12H5M5 12L12 19M5 12L12 5"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          Back
        </Button>
        <h2 className="text-2xl font-bold text-gray-800 dark:text-white/90">Edit Cloud Connector</h2>
      </div>

      <div className="bg-white dark:bg-white/[0.03] rounded-2xl border border-gray-200 dark:border-white/[0.05] p-6">
        <Form onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 gap-6">
            {/* Provider Name (editable) */}
            <div className="relative">
              <Input
                type="text"
                defaultValue={providerName}
                id="name"
                name="name"
                className="pl-11"
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setProviderName(e.target.value)}
              />
              <span className="absolute text-gray-500 -translate-y-1/2 pointer-events-none left-4 top-1/2 dark:text-gray-400">
                <CloudIcon />
              </span>
            </div>
            
            {/* Region selection */}
            <div className="relative">
              <Select
                options={regions[formData.provider]}
                defaultValue={formData.region}
                onChange={(value) => setFormData(prev => ({ ...prev, region: value }))}
                className="pl-11"
                placeholder="Select Region"
              />
              <span className="absolute text-gray-500 -translate-y-1/2 pointer-events-none left-4 top-1/2 dark:text-gray-400">
                <GlobeIcon />
              </span>
            </div>

            {/* Type selection */}
            <div className="relative">
              <Select
                options={types[formData.provider].map((type) => ({ value: type, label: type }))}
                defaultValue={formData.type}
                onChange={(value) => setFormData(prev => ({ ...prev, type: value }))}
                className="pl-11"
                placeholder="Select Service Type"
              />
              <span className="absolute text-gray-500 -translate-y-1/2 pointer-events-none left-4 top-1/2 dark:text-gray-400">
                <GlobeIcon />
              </span>
            </div>
            
            {/* Access Key (editable) */}
            <div className="relative">
              <Input
                type={showAccessKey ? "text" : "password"}
                placeholder="Access Key"
                id="accessKey"
                name="accessKey"
                className="pl-11 pr-10"
                defaultValue={formData.accessKey}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => 
                  setFormData(prev => ({ ...prev, accessKey: e.target.value }))}
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
            
            {/* Secret Key (editable) */}
            <div className="relative">
              <Input
                type={showSecretKey ? "text" : "password"}
                placeholder="Secret Key"
                id="secretKey"
                name="secretKey"
                className="pl-11 pr-10"
                defaultValue={formData.secretKey}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => 
                  setFormData(prev => ({ ...prev, secretKey: e.target.value }))}
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
            
            {/* Active/Inactive Toggle */}
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-3">
                <Toggle enabled={formData.active} setEnabled={handleToggleChange} />
                <Label className="mb-0">
                  {formData.active ? "Active" : "Inactive"}
                </Label>
              </div>
            </div>

            {/* Form Actions */}
            <div className="flex justify-end gap-3 mt-4">
              <Button size="sm" variant="outline" onClick={goBack}>
                Cancel
              </Button>
              <Button size="sm" variant="primary" type="submit">
                Save Changes
              </Button>
            </div>
          </div>
        </Form>
      </div>
    </>
  );
};

export default ConnectorEditForm;