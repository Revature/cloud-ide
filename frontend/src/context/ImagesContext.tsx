"use client";
import { CloudConnector } from "@/types";
import React, { createContext, useContext, useState, ReactNode } from "react";


// Define machine configurations
export interface Machine {
  name: string;
  identifier: string;
  cpu_count: number;
  memory_size: number;
  storage_size: number;
}

// Available machine types
export const machineTypes: Machine[] = [
  {
    name: "Small",
    identifier: "t2.small",
    cpu_count: 1,
    memory_size: 2,
    storage_size: 20
  },
  {
    name: "Medium",
    identifier: "t2.medium",
    cpu_count: 2,
    memory_size: 4,
    storage_size: 50
  },
  {
    name: "Large",
    identifier: "t2.large",
    cpu_count: 2,
    memory_size: 8,
    storage_size: 100
  },
  {
    name: "XLarge",
    identifier: "t2.xlarge",
    cpu_count: 4,
    memory_size: 16,
    storage_size: 200
  },
  {
    name: "2XLarge",
    identifier: "t2.2xlarge",
    cpu_count: 8,
    memory_size: 32,
    storage_size: 500
  }
];

// Define the interface for Image
export interface VMImage {
  name: string;
  description: string;
  identifier: string;
  machine: Machine;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  cloudConnector?: CloudConnector; // Added cloud connector reference
}

// Define a separate interface for new images
export interface NewVMImage {
  name: string;
  description: string;
  machine: Machine;
  active: boolean;
  cloudConnector?: CloudConnector; // Added cloud connector reference
}

// Generate a random string to simulate backend-generated identifiers
const generateRandomId = () => {
  return 'img_' + Math.random().toString(36).substring(2, 12);
};

// Initial data with sample images
const initialImages: VMImage[] = [
  {
    name: "Ubuntu Developer",
    description: "Standard Ubuntu development environment with common development tools",
    identifier: "img_a7b3c9d2e5",
    machine: machineTypes[1], // Medium
    active: true,
    createdAt: "Jan 15, 2025",
    updatedAt: "Feb 20, 2025",
    cloudConnector: {
      id: 1,
      image: "/images/brand/aws-logo.svg", 
      provider: "AWS",
      name: "AWS",
      createdOn: "Jan 15, 2025", 
      region: "us-west-2",
      type: "EC2",
      active: true,
      accessKey: "AKIAIOSFODNN7EXAMPLE",
      secretKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
    }
  },
  {
    name: "Data Science Workbench",
    description: "Data science environment with Python, R, and Jupyter",
    identifier: "img_f8g6h4j2k1",
    machine: machineTypes[3], // XLarge
    active: true,
    createdAt: "Jan 20, 2025",
    updatedAt: "Feb 25, 2025",
    cloudConnector: {
      id: 2,
      image: "/images/brand/azure-logo.svg",
      name: "Azure", 
      provider: "Azure", 
      createdOn: "Feb 02, 2025", 
      region: "West US 2",
      type: "VM",
      active: true,
      accessKey: "azurekey098765432104",
      secretKey: "xyzABCdefGHIjklMNOpqrSTUvwXYZ0123456789",
    }
  },
  {
    name: "Windows Development",
    description: "Windows development environment with Visual Studio",
    machine: machineTypes[2], // Large
    identifier: "img_l3m7n9p4q2",
    active: false,
    createdAt: "Feb 01, 2025",
    updatedAt: "Feb 28, 2025",
    cloudConnector: {
      id: 3,
      image: "/images/brand/gcp-logo.svg",
      name: "GCP", 
      provider: "GCP", 
      createdOn: "Jan 28, 2025", 
      region: "us-central1",
      type: "Compute Engine",
      active: true,
      accessKey: "gcp_service_account_123",
      secretKey: "gcpauthkey_ABCDEFGHIJKLMNOPQRSTUVWXYZ012345",
    }
  },
  {
    name: "Image Builder",
    description: "Environment for building and customizing other images",
    identifier: "img_r5s1t8u3v6",
    machine: machineTypes[1], // Medium
    active: true,
    createdAt: "Jan 10, 2025",
    updatedAt: "Feb 10, 2025",
    cloudConnector: {
      id: 4,
      image: "/images/brand/aws-logo.svg", 
      name: "AWS",
      provider: "AWS",
      createdOn: "Jan 15, 2025", 
      region: "us-west-2",
      type: "EC2",
      active: true,
      accessKey: "AKIAIOSFODNN7EXAMPLE",
      secretKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
    }
  },
  {
    name: "Go Development",
    description: "Lightweight Go development environment",
    identifier: "img_w7x9y2z4a1",
    machine: machineTypes[1], // Medium
    active: true,
    createdAt: "Feb 15, 2025",
    updatedAt: "Mar 01, 2025",
    cloudConnector: {
      id: 5,
      image: "/images/brand/digitalocean-logo.svg",
      name: "DigitalOcean", 
      provider: "DigitalOcean", 
      createdOn: "Mar 05, 2025", 
      region: "NYC1",
      type: "Droplet",
      active: false,
      accessKey: "dopad_v1_1234567890abcdef",
      secretKey: "do_secret_key_01234567890abcdefghijklmnopqrstuvwxyz",
    }
  },
  {
    name: "DevOps Toolchain",
    description: "Environment with Docker, Kubernetes, Terraform, and CI/CD tools",
    identifier: "img_b6c2d8e3f5",
    machine: machineTypes[2], // Large
    active: true,
    createdAt: "Feb 20, 2025",
    updatedAt: "Mar 05, 2025",
    cloudConnector: {
      id:6,
      image: "/images/brand/aws-logo.svg", 
      name: "AWS",
      provider:"AWS",
      createdOn: "Jan 15, 2025", 
      region: "us-west-2",
      type: "EC2",
      active: true,
      accessKey: "AKIAIOSFODNN7EXAMPLE",
      secretKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
    }
  }
];

// Create context with default values
interface ImagesContextType {
  images: VMImage[];
  addImage: (image: NewVMImage) => void;
  updateImageStatus: (index: number, active: boolean) => void;
  updateImage: (index: number, updatedData: Partial<VMImage>) => void;
  getImageById: (index: number) => VMImage | undefined;
}

const ImagesContext = createContext<ImagesContextType>({
  images: initialImages,
  addImage: () => {},
  updateImageStatus: () => {},
  updateImage: () => {},
  getImageById: () => undefined
});

// Provider component
interface ImagesProviderProps {
  children: ReactNode;
}

export const ImagesProvider: React.FC<ImagesProviderProps> = ({ children }) => {
  const [images, setImages] = useState<VMImage[]>(initialImages);

  const addImage = (image: NewVMImage) => {
    console.log("Before adding image, current images:", images.length);

    const newImage: VMImage = {
      name: image.name,
      description: image.description,
      identifier: generateRandomId(),
      machine: image.machine,
      active: image.active,
      cloudConnector: image.cloudConnector, // Added cloud connector
      createdAt: new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      }),
      updatedAt: new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      })
    };

    console.log("New image to be added:", newImage);
    setImages(prev => {
      console.log("Inside setImages callback, previous state:", prev.length);
      const newState = [...prev, newImage];
      console.log("New state after adding image:", newState.length);
      return newState;
    });
    
    console.log("After setImages call");
  };

  const updateImageStatus = (index: number, active: boolean) => {
    setImages(prev => {
      const updated = [...prev];
      if (updated[index]) {
        updated[index] = { 
          ...updated[index], 
          active,
          updatedAt: new Date().toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
          })
        };
      }
      return updated;
    });
  };
  
  // Add function to update multiple properties of an image
  const updateImage = (index: number, updatedData: Partial<VMImage>) => {
    setImages(prev => {
      const updated = [...prev];
      if (updated[index]) {
        updated[index] = { 
          ...updated[index], 
          ...updatedData,
          updatedAt: new Date().toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
          })
        };
      }
      return updated;
    });
  };

  // Get image by index
  const getImageById = (index: number): VMImage | undefined => {
    return images[index];
  };

  return (
    <ImagesContext.Provider value={{ 
      images, 
      addImage, 
      updateImageStatus,
      updateImage,
      getImageById
    }}>
      {children}
    </ImagesContext.Provider>
  );
};

// Custom hook for using the context
export const useImages = () => useContext(ImagesContext);

export default ImagesContext;