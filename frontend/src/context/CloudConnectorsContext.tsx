"use client";
import React, { createContext, useContext, useState, ReactNode } from "react";

// Define the interface for cloud connector
export interface CloudConnector {
  image: string;
  name: string;
  added: string;
  region: string;
  type: string;
  active: boolean;
  // Add credential fields
  accessKey: string;
  secretKey: string;
}

// Define a separate interface for new connectors
export interface NewCloudConnector {
  provider: string;
  name?: string;
  region: string;
  type: string;
  status?: boolean;
  accessKey: string;
  secretKey: string;
}

// Initial data with dummy credentials
const initialConnectors: CloudConnector[] = [
  {
    image: "images/brand/aws-logo.svg", 
    name: "AWS",
    added: "Jan 15, 2025", 
    region: "us-west-2",
    type: "EC2",
    active: true,
    accessKey: "AKIAIOSFODNN7EXAMPLE",
    secretKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
  },
  {
    image: "images/brand/azure-logo.svg",
    name: "Azure", 
    added: "Feb 02, 2025", 
    region: "West US 2",
    type: "VM",
    active: true,
    accessKey: "azurekey098765432104",
    secretKey: "xyzABCdefGHIjklMNOpqrSTUvwXYZ0123456789",
  },
  {
    image: "images/brand/gcp-logo.svg",
    name: "GCP", 
    added: "Jan 28, 2025", 
    region: "us-central1",
    type: "Compute Engine",
    active: true,
    accessKey: "gcp_service_account_123",
    secretKey: "gcpauthkey_ABCDEFGHIJKLMNOPQRSTUVWXYZ012345",
  },
  {
    image: "images/brand/digitalocean-logo.svg",
    name: "DigitalOcean", 
    added: "Mar 05, 2025", 
    region: "NYC1",
    type: "Droplet",
    active: false,
    accessKey: "dopad_v1_1234567890abcdef",
    secretKey: "do_secret_key_01234567890abcdefghijklmnopqrstuvwxyz",
  }
];

// Create context with default values
interface CloudConnectorsContextType {
  connectors: CloudConnector[];
  addConnector: (connector: NewCloudConnector) => void;
  updateConnectorStatus: (index: number, active: boolean) => void;
  updateConnector: (index: number, updatedData: Partial<CloudConnector>) => void;
}

const CloudConnectorsContext = createContext<CloudConnectorsContextType>({
  connectors: initialConnectors,
  addConnector: () => {},
  updateConnectorStatus: () => {},
  updateConnector: () => {},
});

// Provider component
interface CloudConnectorsProviderProps {
  children: ReactNode;
}

export const CloudConnectorsProvider: React.FC<CloudConnectorsProviderProps> = ({ children }) => {
  const [connectors, setConnectors] = useState<CloudConnector[]>(initialConnectors);

  const addConnector = (connector: NewCloudConnector) => {
    // Map provider names to their image paths
    const providerImages: Record<string, string> = {
      aws: "/images/brand/aws-logo.svg",
      azure: "/images/brand/azure-logo.svg",
      gcp: "/images/brand/gcp-logo.svg",
    };

    // Map provider values to display names
    const providerNames: Record<string, string> = {
      aws: "AWS",
      azure: "Azure",
      gcp: "GCP",
    };

    const newConnector: CloudConnector = {
      image: providerImages[connector.provider as string] || "/images/brand/default-logo.svg",
      name: connector.name || providerNames[connector.provider as string] || connector.provider as string,
      added: new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      }),
      region: connector.region as string,
      type: connector.type as string,
      active: connector.status || false,
      accessKey: connector.accessKey,
      secretKey: connector.secretKey,
    };

    setConnectors(prev => [...prev, newConnector]);
  };

  const updateConnectorStatus = (index: number, active: boolean) => {
    setConnectors(prev => {
      const updated = [...prev];
      if (updated[index]) {
        updated[index] = { ...updated[index], active };
      }
      return updated;
    });
  };
  
  // Add new function to update multiple properties of a connector
  const updateConnector = (index: number, updatedData: Partial<CloudConnector>) => {
    setConnectors(prev => {
      const updated = [...prev];
      if (updated[index]) {
        updated[index] = { ...updated[index], ...updatedData };
      }
      return updated;
    });
  };

  return (
    <CloudConnectorsContext.Provider value={{ 
      connectors, 
      addConnector, 
      updateConnectorStatus,
      updateConnector
    }}>
      {children}
    </CloudConnectorsContext.Provider>
  );
};

// Custom hook for using the context
export const useCloudConnectors = () => useContext(CloudConnectorsContext);