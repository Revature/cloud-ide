// src/components/image/ImageFormWithTerminal.tsx
/**
 * Image Form With Interactive Terminal
 * 
 * This component provides a multi-step form for creating VM images:
 * 1. Configuration step: Basic image details, machine specs, and cloud provider
 * 2. Terminal step: Simulates image creation and allows interactive customization
 * 
 * Features:
 * - Form validation for required fields
 * - Simulated image creation process
 * - Interactive terminal for custom environment setup
 * - Detection of customizations for improved description
 */
"use client";
import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Form from "@/components/form/Form";
import Input from "@/components/form/input/InputField";
import Label from "@/components/form/Label";
import Toggle from "@/components/form/input/Toggle";
import Button from "@/components/ui/button/Button";
import Select from "@/components/form/Select";
import InteractiveTerminal from '@/components/terminal/InteractiveTerminal';
import FallbackTerminal from '@/components/terminal/FallbackTerminal';
import ProxyImage from "@/components/ui/images/ProxyImage";
import { CloudConnector, Machine, machineTypes, VMImage } from "@/types";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";

// Define the shape of the data being submitted
export interface ImageFormData {
  name: string;
  description: string;
  machine: Machine;
  active: boolean;
  cloudConnector?: CloudConnector;
}

interface ImageFormWithTerminalProps {
  onSubmit?: (data: ImageFormData) => void;
  onCancel: () => void;
}

interface TerminalComponentProps {
  logs: string[];
  simulationComplete: boolean;
  onCommand?: (command: string) => void;
  allowInput?: boolean;
}

const ImageFormWithTerminal: React.FC<ImageFormWithTerminalProps> = ({ onSubmit, onCancel }) => {
  const router = useRouter();
  const [active, setActive] = useState(true);

  // State for terminal components
  const [terminalLoading, setTerminalLoading] = useState(true);
  const [terminalError, setTerminalError] = useState<Error | null>(null);
  const [Terminal, setTerminal] = useState<React.ComponentType<TerminalComponentProps> | null>(null);

  // Multi-step form state
  const [currentStep, setCurrentStep] = useState(1);
  const [terminalLogs, setTerminalLogs] = useState<string[]>([]);
  const [simulationComplete, setSimulationComplete] = useState(false);
  const [customizationsApplied, setCustomizationsApplied] = useState(false);

  // Obtain connectors from CloudConnectorsTable ReactQuery
  const { data:connectors = [] } = useQuery<CloudConnector[]>({
    queryKey: ['cloudConnectors'],
  })

  // Obtain connectors from CloudConnectorsTable ReactQuery
  const { data:images = [] } = useQuery<VMImage[]>({
    queryKey: ['images'],
  })

  // Convert machine types for select dropdown
  const machineOptions = machineTypes.map(machine => ({
    value: machine.identifier,
    label: `${machine.name} (${machine.cpuCount} CPU, ${machine.memorySize} GB RAM, ${machine.storageSize} GB Storage)`
  }));

  // Create options for cloud connectors dropdown
  const cloudConnectorOptions = connectors
    .filter(connector => connector.active)
    .map(connector => { 
      if(connector.name)  
      return {
          value: connector.name,
          label: `${connector.name} (${connector.region})`
      }
      else 
      return {
        value: 'aws',
        label: `${connector.provider} (${connector.region})`
      }
    });
    
    // State for form data with default values
    const [selectedMachine, setSelectedMachine] = useState(machineTypes[1].identifier); // Default to Medium
    const [selectedConnector, setSelectedConnector] = useState(
      connectors.length > 0 && connectors[0].active ? connectors[0].name : ""
    );
    const [selectedImage, setSelectedImage] = useState(images.length > 0 ? images[0].identifier : "");
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

  const handleImageChange = (value: string) => {
    setSelectedImage(value);
  }

  // Get the selected machine object
  const getSelectedMachineObject = (): Machine => {
    return machineTypes.find(m => m.identifier === selectedMachine) || machineTypes[1];
  };

  // Get the selected cloud connector object
  const getSelectedConnectorObject = (): CloudConnector | undefined => {
    return connectors.find((c => c.name === selectedConnector));
  };

  // Get the selected image object
  const getSelectedImageObject = (): VMImage | undefined => {
    return images.find((c => c.identifier === selectedImage));
  };
    
  // Create options for cloud connectors dropdown
  const imageOptions = images
    .map(image => { 
      if(image.name)  
      return {
          value: image.identifier,
          label: `${image.name}`
      }
      else 
      return {
        value: '',
        label: `Create Available Base Image`
      }
    });
    
  // Dynamically load the InteractiveTerminal component
  useEffect(() => {
    const loadTerminalComponent = async () => {
      try {
        // Change from Terminal to InteractiveTerminal
        const terminalModule = await import('@/components/terminal/InteractiveTerminal');
        setTerminal(() => terminalModule.default);
        setTerminalLoading(false);
      } catch (err) {
        console.error('Error loading interactive terminal component:', err);
        setTerminalError(err instanceof Error ? err : new Error('Unknown error loading terminal'));
        setTerminalLoading(false);
      }
    };

    loadTerminalComponent();
  }, []);

  // Handle terminal commands when in interactive mode
  const handleTerminalCommand = (command: string) => {
    // If a custom command changes the environment, we mark it as customized
    if (command.trim() !== '' && 
       (command.includes('apt-get') || 
        command.includes('npm') || 
        command.includes('pip') || 
        command.includes('curl') || 
        command.includes('wget') ||
        command.includes('install'))) {
      setCustomizationsApplied(true);
    }
  };

  // Function to simulate command execution in the terminal
  const simulateTerminalCommands = async () => {
    const selectedConnector = getSelectedConnectorObject();
    const machine = getSelectedMachineObject();
    const image = getSelectedImageObject();
    
    // Clear previous logs
    setTerminalLogs([]);
    setSimulationComplete(false);
    setCustomizationsApplied(false);
    
    // Initial setup
    setTerminalLogs(prev => [...prev, `Welcome to Cloud IDE Image Builder`]);
    await new Promise(resolve => setTimeout(resolve, 800));
    setTerminalLogs(prev => [...prev, `Terminal session started at ${new Date().toLocaleString()}`]);
    await new Promise(resolve => setTimeout(resolve, 1000));
    setTerminalLogs(prev => [...prev, `$ cd ~/image-builder`]);
    await new Promise(resolve => setTimeout(resolve, 400));
    setTerminalLogs(prev => [...prev, `$ echo ${image?.name}`]);
    await new Promise(resolve => setTimeout(resolve, 400));

    // Start the image creation process
    setTerminalLogs(prev => [...prev, `$ ./create-image.sh --name="${name}" --provider="${selectedConnector?.name || 'unknown'}" --region="${selectedConnector?.region || 'unknown'}" --type="${selectedConnector?.type || 'unknown'}"`]);
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // Authentication and connection
    setTerminalLogs(prev => [...prev, `[INFO] Authenticating with ${selectedConnector?.name || 'cloud provider'}...`]);
    await new Promise(resolve => setTimeout(resolve, 1000));
    setTerminalLogs(prev => [...prev, `[INFO] Using credentials from secure vault`]);
    await new Promise(resolve => setTimeout(resolve, 800));
    setTerminalLogs(prev => [...prev, `[INFO] Connection established to ${selectedConnector?.region || 'unknown'} region`]);
    await new Promise(resolve => setTimeout(resolve, 600));
    
    // Resource validation
    setTerminalLogs(prev => [...prev, `$ ./validate-resources.sh --cpu=${machine.cpuCount} --memory=${machine.memorySize} --storage=${machine.storageSize}`]);
    await new Promise(resolve => setTimeout(resolve, 1200));
    setTerminalLogs(prev => [...prev, `[INFO] CPU: ${machine.cpuCount} core${machine.cpuCount > 1 ? 's' : ''} - VALIDATED`]);
    await new Promise(resolve => setTimeout(resolve, 500));
    setTerminalLogs(prev => [...prev, `[INFO] Memory: ${machine.memorySize}GB - VALIDATED`]);
    await new Promise(resolve => setTimeout(resolve, 500));
    setTerminalLogs(prev => [...prev, `[INFO] Storage: ${machine.storageSize}GB - VALIDATED`]);
    await new Promise(resolve => setTimeout(resolve, 500));
    setTerminalLogs(prev => [...prev, `[INFO] Resource validation complete. Proceeding with image creation.`]);
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Base image setup
    setTerminalLogs(prev => [...prev, `$ sudo ./setup-base-image.sh`]);
    await new Promise(resolve => setTimeout(resolve, 800));
    setTerminalLogs(prev => [...prev, `[INFO] Downloading base image template...`]);
    
    // Progress simulation for download
    for (let i = 0; i <= 100; i += 10) {
      setTerminalLogs(prev => [...prev, `Progress: ${i}% - Downloading base image`]);
      await new Promise(resolve => setTimeout(resolve, 300));
    }
    
    // System dependencies
    setTerminalLogs(prev => [...prev, `[INFO] Base image downloaded successfully`]);
    await new Promise(resolve => setTimeout(resolve, 600));
    setTerminalLogs(prev => [...prev, `$ sudo apt-get update && sudo apt-get install -y build-essential git curl wget`]);
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // Show some package installation logs
    const packages = [
      'build-essential', 'git', 'curl', 'wget', 'python3', 'python3-pip', 
      'nodejs', 'npm', 'docker.io', 'java-11-openjdk'
    ];
    
    for (const pkg of packages) {
      setTerminalLogs(prev => [...prev, `[INFO] Installing ${pkg}...`]);
      await new Promise(resolve => setTimeout(resolve, 300));
    }
    
    setTerminalLogs(prev => [...prev, `[INFO] All system dependencies installed successfully`]);
    await new Promise(resolve => setTimeout(resolve, 800));
    
    // Configuration progress
    setTerminalLogs(prev => [...prev, `$ ./configure-environment.sh --ide=code-server --start-on-boot=true`]);
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Progress for configuration
    for (let i = 0; i <= 100; i += 20) {
      setTerminalLogs(prev => [...prev, `Progress: ${i}% - Configuring environment`]);
      await new Promise(resolve => setTimeout(resolve, 400));
    }
    
    // Final steps
    setTerminalLogs(prev => [...prev, `[INFO] Environment configuration completed`]);
    await new Promise(resolve => setTimeout(resolve, 600));
    setTerminalLogs(prev => [...prev, `$ ./finalize-image.sh --name="${name}" --description="${description || 'No description provided'}"`]);
    await new Promise(resolve => setTimeout(resolve, 1200));
    setTerminalLogs(prev => [...prev, `[SUCCESS] Image configuration completed successfully!`]);
    await new Promise(resolve => setTimeout(resolve, 800));
    setTerminalLogs(prev => [...prev, `[INFO] Image "${name}" is ready for customization`]);
    await new Promise(resolve => setTimeout(resolve, 600));
    
    // Add interactive mode instructions with more emphasis
    setTerminalLogs(prev => [...prev, ``]);
    setTerminalLogs(prev => [...prev, `\x1b[1;32m[INTERACTIVE MODE ENABLED]\x1b[0m`]);
    setTerminalLogs(prev => [...prev, `You can now use this terminal to customize your image before finalizing it.`]);
    setTerminalLogs(prev => [...prev, `Try these commands:`]);
    setTerminalLogs(prev => [...prev, `  • \x1b[33mapt-get install <package>\x1b[0m - Install system packages`]);
    setTerminalLogs(prev => [...prev, `  • \x1b[33mnpm install <package>\x1b[0m    - Install Node.js packages`]);
    setTerminalLogs(prev => [...prev, `  • \x1b[33mpip install <package>\x1b[0m    - Install Python packages`]);
    setTerminalLogs(prev => [...prev, `  • \x1b[33mhelp\x1b[0m                     - See all available commands`]);
    setTerminalLogs(prev => [...prev, ``]);
    
    // Mark simulation as complete to enable interactive input
    setSimulationComplete(true);
  };

  // This will be called after validating the form on step 1
  const handleContinueToTerminal = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    // Validate form data
    if (!name || (!selectedConnector && connectors.filter(c => c.active).length > 0)) {
      alert("Please fill in all required fields");
      return;
    }
    
    // Move to terminal step
    setCurrentStep(2);
    
    // Start terminal simulation after a brief delay
    setTimeout(() => {
      simulateTerminalCommands();
    }, 500);
  };

  // Final submission after terminal preview
  const handleFinalSubmit = () => {
    // Create new image object using state values
    const newImage: ImageFormData = {
      name: name,
      description: customizationsApplied 
        ? `${description || 'Custom image'} (with terminal customizations)` 
        : description,
      machine: getSelectedMachineObject(),
      active: active,
      cloudConnector: getSelectedConnectorObject()
    };
    
    console.log("Submitting new image:", newImage);
    
    // TODO: Implement Creating Image with Backend Request
    
    // Call optional onSubmit prop
    if (onSubmit) {
      onSubmit(newImage);
    }
    
    // Navigate back to images list
    router.push('/images');
  };

  // Go back to the form step
  const handleBackToForm = () => {
    setCurrentStep(1);
  };

  // Get the current machine details for display
  const currentMachine = getSelectedMachineObject();

  return (
    <div className="container mx-auto">
      {currentStep === 1 && (
        <Form onSubmit={handleContinueToTerminal}>
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
                    <Link href="/cloud-connectors" className="text-brand-500 ml-1 hover:underline">
                      Add a connector
                    </Link>
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

            {/* Image */}
            <div className="col-span-full md:col-span-1">
              <Label htmlFor="image">Base Image</Label>
              {images.length > 0 ? (
                <Select
                  options={imageOptions}
                  defaultValue={selectedImage}
                  onChange={handleImageChange}
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
                value={description}
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

          {/* Form Actions */}
          <div className="flex justify-end gap-3 mt-8">
            <Button size="sm" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
            <Button 
              size="sm" 
              variant="primary"
              type="submit"
              disabled={!selectedConnector || connectors.filter(c => c.active).length === 0 || !name}
            >
              {!selectedConnector || connectors.filter(c => c.active).length === 0 
                ? <span title="You need an active cloud connector to create an image">Continue</span>
                : "Continue"
              }
            </Button>
          </div>
        </Form>
      )}

      {currentStep === 2 && (
        <div className="space-y-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-medium text-gray-700 dark:text-white/80">
              Image Configuration Terminal
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Creating image: <span className="font-medium">{name}</span>
            </p>
          </div>

          {/* Terminal Component */}
          <div className="border border-gray-200 rounded-lg dark:border-gray-700 bg-gray-900 text-white p-1 font-mono terminal-shadow">
          {terminalLoading ? (
            <div className="h-96 w-full rounded-lg bg-gray-800 p-4 font-mono text-gray-300 animate-pulse">
              Loading terminal...
            </div>
          ) : terminalError || !Terminal ? (
            <FallbackTerminal logs={terminalLogs} />
          ) : (
            <InteractiveTerminal 
              logs={terminalLogs} 
              simulationComplete={simulationComplete}
              onCommand={handleTerminalCommand}
              allowInput={true}
            />
          )}
          </div>

          {/* Additional Info */}
          {simulationComplete && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-blue-800 dark:bg-blue-900/20 dark:border-blue-800/30 dark:text-blue-300">
              <h3 className="font-medium text-blue-900 dark:text-blue-200 mb-2">Interactive Mode</h3>
              <p className="text-sm">
                You can now use the terminal to customize your image environment before finalizing it.
                Try commands like <code className="bg-blue-100 dark:bg-blue-800/30 px-1 rounded">apt-get install</code>, <code className="bg-blue-100 dark:bg-blue-800/30 px-1 rounded">npm install</code>, or <code className="bg-blue-100 dark:bg-blue-800/30 px-1 rounded">pip install</code> to add packages.
              </p>
              <p className="text-sm mt-2">
                Type <code className="bg-blue-100 dark:bg-blue-800/30 px-1 rounded">help</code> to see available commands or <code className="bg-blue-100 dark:bg-blue-800/30 px-1 rounded">exit</code> to disable terminal input.
              </p>
              {customizationsApplied && (
                <p className="text-sm mt-2 font-medium text-blue-900 dark:text-blue-200">
                  ✓ Custom environment modifications detected
                </p>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3 mt-8">
            <Button size="sm" variant="outline" onClick={handleBackToForm}>
              Back
            </Button>
            <Button 
              size="sm" 
              variant="primary"
              onClick={handleFinalSubmit}
              disabled={!simulationComplete}
            >
              {customizationsApplied ? "Create Custom Image" : "Create Image"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ImageFormWithTerminal;