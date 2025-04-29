"use client";
import React, { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { CloudConnector } from "@/types/cloudConnectors"
import Form from "@/components/form/Form";
import Input from "@/components/form/input/InputField";
import Select from "@/components/form/Select";
import Button from "@/components/ui/button/Button";
import Label from "@/components/form/Label";
import Toggle from "@/components/form/input/Toggle";
import ProxyImage from "@/components/ui/images/ProxyImage";
import { machineTypes } from "@/types";
import { useImageQuery } from "@/hooks/api/images/useImageQuery";

// Convert machine types for select dropdown
const machineOptions = machineTypes.map(machine => ({
  value: machine.identifier,
  label: `${machine.name} (${machine.cpuCount} CPU, ${machine.memorySize} GB RAM, ${machine.storageSize} GB Storage)`
}));

const EditImageForm: React.FC = () => {
  const router = useRouter();
  const params = useParams();
  const imageIndex = parseInt(params.id as string, 10);

  // Obtain images from ImagesTable ReactQuery
  const { data:images = [] } = useImageQuery()

  // State for form data
  const [formData, setFormData] = useState<{
    name: string;
    description: string;
    machineIdentifier: string;
    active: boolean;
    cloudConnector?: CloudConnector;
  }>({
    name: "",
    description: "",
    machineIdentifier: "",
    active: true,
    cloudConnector: undefined
  });

  // Get the selected machine object
  const getSelectedMachine = () => {
    return machineTypes.find(m => m.identifier === formData.machineIdentifier) || machineTypes[1]; // Default to Medium
  };
  
  // State for displaying form
  const [loading, setLoading] = useState(true);
  
  // Load image data
  useEffect(() => {
    if (!isNaN(imageIndex) && images[imageIndex]) {
      const image = images[imageIndex];
      if (image.machine){
        setFormData({
          name: image.name,
          description: image.description || "",
          machineIdentifier: image.machine.identifier,
          active: image.active,
          cloudConnector: image.cloudConnector
        });
      }
      
      setLoading(false);
    } else {
      // Handle invalid index
      router.push('/images');
    }
  }, [imageIndex, images, router]);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    // TODO: Implement Update Image Request to Backend
    
    router.push('/images');
  };

  const handleToggleChange = (enabled: boolean) => {
    setFormData(prev => ({
      ...prev,
      active: enabled
    }));
  };

  const goBack = () => {
    router.push('/images');
  };

  if (loading) {
    return (
      <div className="flex justify-center">
        <div className="animate-pulse">Loading...</div>
      </div>
    );
  }

  // Get the current machine details for display
  const currentMachine = getSelectedMachine();

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
        <h2 className="text-2xl font-bold text-gray-800 dark:text-white/90">Edit Image</h2>
      </div>

      <div className="bg-white dark:bg-white/[0.03] rounded-2xl border border-gray-200 dark:border-white/[0.05] p-6">
        <Form onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {/* Basic Information Section */}
            <div className="col-span-full mb-4">
              <h2 className="text-lg font-medium text-gray-700 dark:text-white/80">
                Basic Information
              </h2>
              <div className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                General information about the image
              </div>
            </div>

            {/* Image Name */}
            <div className="col-span-full md:col-span-1">
              <Label htmlFor="name">Image Name</Label>
              <Input
                name="name"
                defaultValue={formData.name}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => 
                  setFormData(prev => ({ ...prev, name: e.target.value }))}
              />
            </div>

            {/* Cloud Provider (Read-only) */}
            <div className="col-span-full md:col-span-1">
              <Label htmlFor="cloudConnector">Cloud Provider</Label>
              {formData.cloudConnector ? (
                <div className="flex items-center gap-2 h-[42px] px-4 border border-gray-300 rounded-lg bg-gray-100 dark:bg-gray-800 dark:border-gray-700">
                  <div className="w-6 h-6 relative flex-shrink-0">
                  <ProxyImage
                    src={formData.cloudConnector.image ? formData.cloudConnector.image : ""} 
                    alt={formData.cloudConnector.name || "Cloud provider"}
                    width={32}
                    height={32}
                    className="w-full h-full object-contain"
                  />
                  </div>
                  <span className="text-gray-700 dark:text-gray-300">
                    {formData.cloudConnector.name} ({formData.cloudConnector.region})
                  </span>
                </div>
              ) : (
                <div className="flex items-center h-[42px] px-4 border border-gray-300 rounded-lg bg-gray-100 dark:bg-gray-800 dark:border-gray-700">
                  <p className="text-gray-500 dark:text-gray-400 text-sm">
                    No cloud provider specified
                  </p>
                </div>
              )}
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Cloud provider cannot be changed after image creation
              </p>
            </div>

            {/* Machine Type */}
            <div className="col-span-full md:col-span-1">
              <Label htmlFor="machine">Machine Type</Label>
              <Select
                defaultValue={formData.machineIdentifier}
                options={machineOptions}
                onChange={(value) => setFormData(prev => ({ ...prev, machineIdentifier: value }))}
              />
            </div>

            {/* Active/Inactive Toggle */}
            <div className="col-span-full md:col-span-1">
              <Label>Status</Label>
              <div className="flex items-center gap-3 mt-2">
                <Toggle enabled={formData.active} setEnabled={handleToggleChange} />
                <Label className="mb-0">
                  {formData.active ? "Active" : "Inactive"}
                </Label>
              </div>
            </div>

            {/* Description */}
            <div className="col-span-full">
              <Label htmlFor="description">Description</Label>
              <textarea
                id="description"
                name="description"
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                className="dark:bg-dark-900 h-24 w-full rounded-lg border border-gray-300 bg-transparent py-2.5 px-4 text-sm text-gray-800 shadow-theme-xs placeholder:text-gray-400 focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:placeholder:text-white/30 dark:focus:border-brand-800"
              />
            </div>

            {/* Cloud Provider Info */}
            {formData.cloudConnector && (
              <div className="col-span-full mb-4 mt-4">
                <h2 className="text-lg font-medium text-gray-700 dark:text-white/80">
                  Cloud Provider Information
                </h2>
                <div className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  Details of the cloud provider for this image
                </div>
                <div className="mt-4 p-4 border border-gray-200 rounded-lg dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Provider</p>
                      <div className="flex items-center gap-2 mt-1">
                        <div className="w-6 h-6 relative flex-shrink-0">
                          <ProxyImage
                            src={formData.cloudConnector.image ? formData.cloudConnector.image : ""} 
                            alt={formData.cloudConnector.name || "Cloud provider"}
                            width={32}
                            height={32}
                            className="w-full h-full object-contain"
                          />
                        </div>
                        <p className="text-base font-medium dark:text-gray-200">
                          {formData.cloudConnector.name}
                        </p>
                      </div>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Region</p>
                      <p className="text-base font-medium dark:text-gray-200">
                        {formData.cloudConnector.region}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Type</p>
                      <p className="text-base font-medium dark:text-gray-200">
                        {formData.cloudConnector.type}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Status</p>
                      <p className={`text-base font-medium ${
                        formData.cloudConnector.active 
                          ? "text-green-600 dark:text-green-400" 
                          : "text-gray-500 dark:text-gray-400"
                      }`}>
                        {formData.cloudConnector.active ? "Active" : "Inactive"}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Machine Configuration Preview Section */}
            <div className="col-span-full mb-4 mt-4">
              <h2 className="text-lg font-medium text-gray-700 dark:text-white/80">
                Machine Configuration
              </h2>
              <div className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Resource specifications for VM instances
              </div>
            </div>

            {/* Machine Details Preview */}
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
            <Button size="sm" variant="outline" onClick={goBack}>
              Cancel
            </Button>
            <Button size="sm" variant="primary">
              Save Changes
            </Button>
          </div>
        </Form>
      </div>
    </>
  );
};

export default EditImageForm;