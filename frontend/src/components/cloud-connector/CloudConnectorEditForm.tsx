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
import Button from "../ui/button/Button";
import Select from "../form/Select";
import { useCloudConnectorById } from '@/hooks/type-query/useCloudConnectors';

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
  const id = parseInt(params.id as string, 10);

   // Obtain connectors from CloudConnectorsTable ReactQuery
   const { data:connector, isLoading} = useCloudConnectorById(id);
  
  // State for form data
  const [providerName, setProviderName] = useState('');
  const [formData, setFormData] = useState({
    provider: 'aws' as CloudProvider,
    region: '',
    status: '',
    type: '',
    accessKey: '',
    secretKey: '',
  });
  
  const [showAccessKey, setShowAccessKey] = useState(false);
  const [showSecretKey, setShowSecretKey] = useState(false);

  // Load connector data
  useEffect(() => {
    if (!isNaN(id) && connector) {
      if (connector.status && connector.type) {
        const providerKey = displayNameToProvider[connector.type] || 'aws';
        
        setProviderName(connector.type);
        setFormData({
          provider: providerKey,
          region: connector.region,
          type: connector.type,
          accessKey: connector.accessKey, // Load actual credential data
          secretKey: connector.secretKey, // Load actual credential data
          status: connector.status,
        });
      }
    }
  }, [id, connector, router]);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    // TODO: Implement Update to Backend
    
    router.push('/cloud-connectors');
  };

  const goBack = () => {
    router.push('/cloud-connectors');
  };

  if (isLoading) {
    return (
      <div className="flex justify-center">
        <div className="animate-pulse">Loading...</div>
      </div>
    );
  }

  return (
    <>
      <div className="flex items-center mb-6">
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