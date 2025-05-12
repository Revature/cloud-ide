"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useImageQuery } from "@/hooks/api/images/useImageQuery";
import { imagesApi } from "@/services/cloud-resources/images";
import Button from "@/components/ui/button/Button";

const RunnerPoolForm: React.FC = () => {
  const router = useRouter();
  const { data: images = [], isLoading, error } = useImageQuery();
  const [selectedImageId, setSelectedImageId] = useState<number | null>(null);
  const [poolSize, setPoolSize] = useState<number>(1); // Default pool size

  const handleSubmit = async () => {
    if (selectedImageId !== null) {
      try {
        // Use the imagesApi to patch the runner pool size
        await imagesApi.patchRunnerPoolSize(selectedImageId, poolSize);
        console.log(`Runner pool size updated to ${poolSize} for image ID ${selectedImageId}.`);
        router.push("/runner-pools");
      } catch (error) {
        console.error("Error updating runner pool size:", error);
        console.log("Failed to update runner pool size.");
      }
    }
  };

  const handleCancel = () => {
    router.push("/runner-pools");
  };

  if (isLoading) {
    return <div>Loading available pools...</div>;
  }

  if (error) {
    return <div>Error loading pools: {error instanceof Error ? error.message : "Unknown error"}</div>;
  }

  const availableImages = images.filter((image) => image.runnerPoolSize === 0 && image.status === "active");

  return (
    <div className="p-6 bg-white rounded-lg shadow-md dark:bg-gray-800">
      <h2 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">Add Runner Pool</h2>
      {availableImages.length === 0 ? (
        <p className="text-gray-600 dark:text-gray-400">No images available for adding runner pools.</p>
      ) : (
        <div className="space-y-4">
          {/* Select Image */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Select Image
            </label>
            <select
              className="w-full border border-gray-300 rounded-lg p-2 dark:bg-gray-900 dark:border-gray-700 dark:text-white"
              value={selectedImageId || ""}
              onChange={(e) => setSelectedImageId(Number(e.target.value))}
            >
              <option value="" disabled>
                Select an image
              </option>
              {availableImages.map((image) => (
                <option key={image.id} value={image.id}>
                  {image.name}
                </option>
              ))}
            </select>
          </div>

          {/* Image Details */}
          {selectedImageId && (
            <div>
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Image Details</h3>
              <div className="p-4 border border-gray-300 rounded-lg dark:bg-gray-900 dark:border-gray-700">
                <p className="text-gray-700 dark:text-gray-300">
                  <strong>Name:</strong> {images.find((img) => img.id === selectedImageId)?.name}
                </p>
                <p className="text-gray-700 dark:text-gray-300">
                  <strong>Description:</strong>{" "}
                  {images.find((img) => img.id === selectedImageId)?.description || "No description available"}
                </p>
              </div>
            </div>
          )}

          {/* Runner Pool Size */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Runner Pool Size
            </label>
            <input
              type="number"
              min={1}
              max={10}
              value={poolSize}
              onChange={(e) => setPoolSize(Number(e.target.value))}
              className="w-full border border-gray-300 rounded-lg p-2 dark:bg-gray-900 dark:border-gray-700 dark:text-white"
            />
          </div>

          {/* Form Actions */}
          <div className="flex justify-end gap-3">
            <Button size="sm" variant="outline" onClick={handleCancel}>
              Cancel
            </Button>
            <Button
              size="sm"
              variant="primary"
              onClick={handleSubmit}
              disabled={selectedImageId === null}
            >
              Add Runner Pool
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default RunnerPoolForm;