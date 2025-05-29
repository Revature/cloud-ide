"use client";
import React, { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import Form from "@/components/form/Form";
import Input from "@/components/form/input/InputField";
import Button from "@/components/ui/button/Button";
import Label from "@/components/form/Label";
import ProxyImage from "@/components/ui/images/ProxyImage";
import TagInput from "@/components/ui/tag/TagInput";
import { useImageById, useUpdateImage } from "@/hooks/type-query/useImages";
import { useCloudConnectorsForItems } from "@/hooks/type-query/useCloudConnectors";
import { CloudConnector } from "@/types/cloudConnectors";
import TextArea from "../form/input/TextArea";

const ImageEditForm: React.FC = () => {
  const router = useRouter();
  const params = useParams();
  const imageId = parseInt(params.id as string, 10);

  // Fetch image and cloud connector data
  const { data: image, isLoading } = useImageById(imageId);
  const { resourcesById: connectorsById, isLoading: connectorsLoading } = useCloudConnectorsForItems(image ? [image] : []);
  const { mutateAsync: updateImage } = useUpdateImage();

  // State for form data
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    machineIdentifier: "",
    status: "",
    cloudConnector: undefined as CloudConnector | undefined,
    tags: [] as string[],
  });

  // Load image data into form state
  useEffect(() => {
    if (!isNaN(imageId) && image && connectorsById && formData.name === "") {
      console.log("set data", image);
      setFormData({
        name: image.name,
        description: image.description || "",
        machineIdentifier: image.machine?.identifier || "",
        status: image.status || "",
        cloudConnector: connectorsById[image.cloudConnectorId!],
        tags: image.tags || [],
      });
    }
  }, [image, connectorsById]);

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    try {
      if(image) {
        await updateImage({
          id:imageId, 
          data: {
              name: formData.name,
              description: formData.description,
              tags: formData.tags,
            }
          });
        router.back();
      }
    } catch (error) {
      console.error("Failed to update image:", error);
    }
  };

  // Handle navigation back
  const goBack = () => {
    router.back();
  };

  if (!image || isLoading || connectorsLoading) {
    return (
      <div className="flex justify-center">
        <div className="animate-pulse">Loading...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto pointer-events-auto">
        <Form onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 gap-6">
            {/* Image Name */}
            <div>
              <Label htmlFor="name">Image Name</Label>
              <Input
                id="name"
                name="name"
                defaultValue={formData.name}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
              />
            </div>

            {/* Tags */}
            <div>
              <Label>Tags</Label>
              <TagInput
                selectedTags={formData.tags}
                onAddTag={(tag) =>
                  setFormData((prev) => ({ ...prev, tags: [...prev.tags, tag] }))
                }
                onRemoveTag={(tag) =>
                  setFormData((prev) => ({
                    ...prev,
                    tags: prev.tags.filter((t) => t !== tag),
                  }))
                }
              />
            </div>

            {/* Description */}
            <div>
              <Label >Description</Label>
              <TextArea
                value={formData.description}
                onChange={(value: string) =>
                  setFormData((prev) => ({ ...prev, description: value }))
                }
                className="dark:bg-dark-900 h-24 w-full rounded-lg border border-gray-300 bg-transparent py-2.5 px-4 text-sm text-gray-800 shadow-theme-xs placeholder:text-gray-400 focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:placeholder:text-white/30 dark:focus:border-brand-800"
              />
            </div>

            {/* Cloud Provider Info */}
            {formData.cloudConnector && (
              <div>
                <h3 className="text-lg font-medium text-gray-700 dark:text-white/80">
                  Cloud Provider Information
                </h3>
                <div className="mt-4 p-4 border border-gray-200 rounded-lg dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                        Provider
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <div className="w-6 h-6 relative flex-shrink-0">
                          <ProxyImage
                            src={formData.cloudConnector?.image || ""}
                            alt={formData.cloudConnector?.name || "Cloud provider"}
                            width={32}
                            height={32}
                            className="w-full h-full object-contain"
                          />
                        </div>
                        <p className="text-base font-medium dark:text-gray-200">
                          {formData.cloudConnector?.name}
                        </p>
                      </div>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                        Region
                      </p>
                      <p className="text-base font-medium dark:text-gray-200">
                        {formData.cloudConnector.region}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

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
  );
};

export default ImageEditForm;