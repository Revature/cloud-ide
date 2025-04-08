"use client";
import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useRunners, NewRunner } from "@/context/RunnersContext";
import Form from "@/components/form/Form";
import Label from "@/components/form/Label";
import Button from "@/components/ui/button/Button";
import Select from "@/components/form/Select";
import { VMImage } from "@/types";
import { useQuery } from "@tanstack/react-query";

// Define the shape of the form data
export interface RunnerFormData {
  image: VMImage;
  durationMinutes: number;
}

interface RunnerFormProps {
  onSubmit?: (data: RunnerFormData) => void;
  onCancel: () => void;
}

const RunnerForm: React.FC<RunnerFormProps> = ({ onSubmit, onCancel }) => {
  const { addRunner } = useRunners();
  const router = useRouter();

  // Obtain images from ImagesTable ReactQuery
  const { data:images = [] } = useQuery<VMImage[]>({
    queryKey: ['images'],
  })

  // Default duration options in minutes
  const durationOptions = [
    { value: "60", label: "1 hour" },
    { value: "120", label: "2 hours" },
    { value: "180", label: "3 hours (default)" },
    { value: "240", label: "4 hours" },
    { value: "360", label: "6 hours" },
    { value: "480", label: "8 hours" },
    { value: "720", label: "12 hours" },
    { value: "1440", label: "24 hours" }
  ];

  // Filter only active images for the dropdown
  const activeImages = images.filter(image => image.active);
  
  // Convert images for select dropdown
  const imageOptions = activeImages.map((image, index) => {
    if(image.machine){
      return {
        value: index.toString(),
        label: `${image.name} (${image.machine.name}: ${image.machine.cpuCount} CPU, ${image.machine.memorySize} GB RAM)`
      };
    } else {
      return {
        value: index.toString(),
        label: `${image.name} No Information on Machine)`
      };
    }
  });

  // State for form data with default values
  const [selectedImage, setSelectedImage] = useState(
    activeImages.length > 0 ? "0" : ""
  );
  const [durationMinutes, setDurationMinutes] = useState("180"); // Default to 3 hours

  // Handle image selection change
  const handleImageChange = (value: string) => {
    setSelectedImage(value);
  };

  // Handle duration selection change
  const handleDurationChange = (value: string) => {
    setDurationMinutes(value);
  };

  // Get the selected image object
  const getSelectedImageObject = (): VMImage | undefined => {
    if (selectedImage === "" || !activeImages[parseInt(selectedImage)]) {
      return undefined;
    }
    return activeImages[parseInt(selectedImage)];
  };

  // Create a manual form submission handler
  const manualSubmit = () => {
    console.log("Manual form submission");
    
    const selectedImageObj = getSelectedImageObject();
    
    if (!selectedImageObj) {
      console.error("No valid image selected");
      return;
    }
    
    // Create new runner object using state values
    const newRunner: NewRunner = {
      image: selectedImageObj,
      durationMinutes: parseInt(durationMinutes)
    };
    
    console.log("Submitting new runner:", newRunner);
    
    // Add the runner using context
    addRunner(newRunner);
    
    // Call optional onSubmit prop
    if (onSubmit) {
      onSubmit(newRunner);
    }
    
    // Navigate back to runners list
    router.push('/runners');
  };

  // This will be called by the Form component
  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    // The default prevention is handled by the Form component
    console.log("Form onSubmit called", e.currentTarget);
    manualSubmit();
  };

  // Get the current image details for display
  const selectedImageObj = getSelectedImageObject();

  return (
    <div className="container mx-auto">
      <Form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {/* Basic Information Section */}
          <div className="col-span-full mb-4">
            <h2 className="text-lg font-medium text-gray-700 dark:text-white/80">
              Runner Configuration
            </h2>
            <div className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Configure the VM instance that will be provisioned
            </div>
          </div>

          {/* Image Selection */}
          <div className="col-span-full md:col-span-1">
            <Label htmlFor="image">VM Image</Label>
            {activeImages.length > 0 ? (
              <Select
                options={imageOptions}
                defaultValue={selectedImage}
                onChange={handleImageChange}
              />
            ) : (
              <div className="flex items-center h-[42px] px-4 border border-gray-300 rounded-lg bg-gray-100 dark:bg-gray-800 dark:border-gray-700">
                <p className="text-gray-500 dark:text-gray-400 text-sm">
                  No active images available. 
                  <a href="/images/add" className="text-brand-500 ml-1 hover:underline">
                    Add an image
                  </a>
                </p>
              </div>
            )}
          </div>

          {/* Session Duration */}
          <div className="col-span-full md:col-span-1">
            <Label htmlFor="duration">Session Duration</Label>
            <Select
              options={durationOptions}
              defaultValue={durationMinutes}
              onChange={handleDurationChange}
            />
          </div>

          {/* Selected Image Information */}
          {selectedImageObj && (
            <div className="col-span-full mb-4 mt-4">
              <h2 className="text-lg font-medium text-gray-700 dark:text-white/80">
                Selected Image Details
              </h2>
              <div className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Details of the image that will be used for this runner
              </div>
              <div className="mt-4 p-4 border border-gray-200 rounded-lg dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Image Name</p>
                    <p className="text-base font-medium text-gray-800 dark:text-gray-200">
                      {selectedImageObj.name}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Identifier</p>
                    <p className="text-base font-medium text-gray-800 dark:text-gray-200">
                      {selectedImageObj.identifier}
                    </p>
                  </div>
                  <div className="col-span-full">
                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Description</p>
                    <p className="text-base text-gray-800 dark:text-gray-200">
                      {selectedImageObj.description}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Hardware Configuration Section */}
          {selectedImageObj && (
            <>
              <div className="col-span-full mb-4 mt-4">
                <h2 className="text-lg font-medium text-gray-700 dark:text-white/80">
                  Hardware Configuration
                </h2>
                <div className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  Resource specifications for the runner instance
                </div>
              </div>

              {/* Machine Details */}
              <div className="col-span-full p-4 border border-gray-200 rounded-lg dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400">CPU</p>
                    <p className="text-base font-medium text-gray-800 dark:text-gray-200">
                      {selectedImageObj.machine ? selectedImageObj.machine.cpuCount : 0} {selectedImageObj.machine ? selectedImageObj.machine.cpuCount === 1 ? "Core" : "Cores" : "Core"}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Memory</p>
                    <p className="text-base font-medium text-gray-800 dark:text-gray-200">
                      {selectedImageObj.machine ? selectedImageObj.machine.memorySize : 0} GB
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Storage</p>
                    <p className="text-base font-medium text-gray-800 dark:text-gray-200">
                      {selectedImageObj.machine ? selectedImageObj.machine.storageSize : 0 } GB
                    </p>
                  </div>
                </div>
                <div className="mt-3">
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Instance Type</p>
                  <p className="text-base font-medium text-gray-800 dark:text-gray-200">
                    {selectedImageObj.machine ? selectedImageObj.machine.identifier : "AMI ID missing"}
                  </p>
                </div>
              </div>
            </>
          )}

          {/* Session Information */}
          <div className="col-span-full mb-4 mt-4">
            <h2 className="text-lg font-medium text-gray-700 dark:text-white/80">
              Session Information
            </h2>
            <div className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Details about the runner session
            </div>
            <div className="mt-4 p-4 border border-gray-200 rounded-lg dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Key Pair</p>
                  <p className="text-base font-medium text-gray-800 dark:text-gray-200">
                    Generated automatically
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Session Duration</p>
                  <p className="text-base font-medium text-gray-800 dark:text-gray-200">
                    {parseInt(durationMinutes) / 60} {parseInt(durationMinutes) === 60 ? "hour" : "hours"}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Initial State</p>
                  <p className="text-base font-medium text-gray-800 dark:text-gray-200">
                    Starting (boots automatically)
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Runner URL</p>
                  <p className="text-base font-medium text-gray-800 dark:text-gray-200">
                    Available after runner is ready
                  </p>
                </div>
              </div>
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
            disabled={!selectedImageObj || activeImages.length === 0}
          >
            {!selectedImageObj || activeImages.length === 0 
              ? <span title="You need to select an active image to create a runner">Create Runner</span>
              : "Create Runner"
            }
          </Button>
        </div>
      </Form>
    </div>
  );
};

export default RunnerForm;