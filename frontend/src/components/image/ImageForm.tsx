"use client";
import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useImages, machineTypes, Machine } from "@/context/ImagesContext";
import { useCloudConnectors, CloudConnector } from "@/context/CloudConnectorsContext";
import Form from "@/components/form/Form";
import Input from "@/components/form/input/InputField";
import Label from "@/components/form/Label";
import Toggle from "@/components/form/input/Toggle";
import Button from "@/components/ui/button/Button";
import Select from "@/components/form/Select";
import Image from "next/image";

// Define the shape of the data being submitted
export interface ImageFormData {
  name: string;
  description: string;
  machine: Machine;
  active: boolean;
  cloudConnector?: CloudConnector;
}

interface ImageFormProps {
  onSubmit?: (data: ImageFormData) => void;
  onCancel: () => void;
}

const ImageForm: React.FC<ImageFormProps> = ({ onSubmit, onCancel }) => {
  const { addImage } = useImages();
  const { connectors } = useCloudConnectors();
  const router = useRouter();
  const [active, setActive] = useState(true);

  // Convert machine types for select dropdown
  const machineOptions = machineTypes.map(machine => ({
    value: machine.identifier,
    label: `${machine.name} (${machine.cpu_count} CPU, ${machine.memory_size} GB RAM, ${machine.storage_size} GB Storage)`
  }));

  // Create options for cloud connectors dropdown
  const cloudConnectorOptions = connectors
    .filter(connector => connector.active) // Only show active connectors
    .map(connector => ({
      value: connector.name,
      label: `${connector.name} (${connector.region})`
    }));

  // State for form data with default values
  const [selectedMachine, setSelectedMachine] = useState(machineTypes[1].identifier); // Default to Medium
  const [selectedConnector, setSelectedConnector] = useState(
    connectors.length > 0 && connectors[0].active ? connectors[0].name : ""
  );
  const [description, setDescription] = useState("");
  const [name, setName] = useState("");

  // Handle machine selection change
  const handleMachineChange = (value: string) => {
    setSelectedMachine(value);
  };

  // Handle cloud connector selection change
  const handleConnectorChange = (value: string) => {
    setSelectedConnector(value);
  };

  // Get the selected machine object
  const getSelectedMachineObject = (): Machine => {
    return machineTypes.find(m => m.identifier === selectedMachine) || machineTypes[1];
  };

  // Get the selected cloud connector object
  const getSelectedConnectorObject = (): CloudConnector | undefined => {
    return connectors.find(c => c.name === selectedConnector);
  };

  // Create a manual form submission handler
  const manualSubmit = () => {
    console.log("Manual form submission");
    
    // Create new image object using state values
    const newImage: ImageFormData = {
      name: name,
      description: description,
      machine: getSelectedMachineObject(),
      active: active,
      cloudConnector: getSelectedConnectorObject()
    };
    
    console.log("Submitting new image:", newImage);
    
    // Add the image using context
    addImage(newImage);
    
    // Call optional onSubmit prop
    if (onSubmit) {
      onSubmit(newImage);
    }
    
    // Navigate back to images list
    router.push('/images');
  };

  // This will be called by the Form component
  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    // The default prevention is handled by the Form component
    console.log("Form onSubmit called");
    manualSubmit();
    console.log(e);
  };

  // Get the current machine details for display
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
              defaultValue={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          {/* Cloud Provider */}
          <div className="col-span-full md:col-span-1">
            <Label htmlFor="cloudConnector">Cloud Provider</Label>
            {connectors.filter(c => c.active).length > 0 ? (
              <Select
                options={cloudConnectorOptions}
                defaultValue={selectedConnector}
                onChange={handleConnectorChange}
              />
            ) : (
              <div className="flex items-center h-[42px] px-4 border border-gray-300 rounded-lg bg-gray-100 dark:bg-gray-800 dark:border-gray-700">
                <p className="text-gray-500 dark:text-gray-400 text-sm">
                  No active cloud connectors available. 
                  <a href="/cloud-connectors" className="text-brand-500 ml-1 hover:underline">
                    Add a connector
                  </a>
                </p>
              </div>
            )}
          </div>

          {/* Machine Type */}
          <div className="col-span-full md:col-span-1">
            <Label htmlFor="machine">Machine Type</Label>
            <Select
              options={machineOptions}
              defaultValue={selectedMachine}
              onChange={handleMachineChange}
            />
          </div>

          {/* Active/Inactive Toggle */}
          <div className="col-span-full md:col-span-1">
            <Label>Status</Label>
            <div className="flex items-center gap-3 mt-2">
              <Toggle enabled={active} setEnabled={setActive} />
              <Label className="mb-0">
                {active ? "Active" : "Inactive"}
              </Label>
            </div>
          </div>

          {/* Description */}
          <div className="col-span-full">
            <Label htmlFor="description">Description</Label>
            <textarea
              id="description"
              name="description"
              placeholder="Description of the image and its purpose"
              defaultValue={description}
              onChange={(e) => setDescription(e.target.value)}
              className="dark:bg-dark-900 h-24 w-full rounded-lg border border-gray-300 bg-transparent py-2.5 px-4 text-sm text-gray-800 shadow-theme-xs placeholder:text-gray-400 focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:placeholder:text-white/30 dark:focus:border-brand-800"
            />
          </div>

          {/* Selected Cloud Provider Info */}
          {selectedConnector && (() => {
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
                            <Image 
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
                        {connector.active ? "Active" : "Inactive"}
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
                <p className="text-base font-medium dark:text-gray-200">{currentMachine.cpu_count} {currentMachine.cpu_count === 1 ? "Core" : "Cores"}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Memory</p>
                <p className="text-base font-medium dark:text-gray-200">{currentMachine.memory_size} GB</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Storage</p>
                <p className="text-base font-medium dark:text-gray-200">{currentMachine.storage_size} GB</p>
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
          <Button size="sm" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button 
            size="sm" 
            variant="primary"
            disabled={!selectedConnector || connectors.filter(c => c.active).length === 0}
          >
            {!selectedConnector || connectors.filter(c => c.active).length === 0 
              ? <span title="You need an active cloud connector to create an image">Create Image</span>
              : "Create Image"
            }
          </Button>
        </div>
      </Form>
    </div>
  );
};

export default ImageForm;