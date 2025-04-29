"use client";
import { useParams } from "next/navigation";
import ViewImage from "@/components/image/ImageView";
import Breadcrumb from "@/components/ui/breadcrumb/Breadcrumb";
import { useImageQuery } from "@/hooks/api/images/useImageQuery";

export default function ViewImagePage() {
  const params = useParams();
  const imageId = parseInt(params.id as string, 10); // Parse imageId directly from the URL

  // Fetch the specific image using the imageId
  const { data: image, isLoading, error } = useImageQuery(imageId);

  // Get image name for the breadcrumb if available
  const imageName = image?.name || "Image Details";

  const breadcrumbItems = [
    { label: "Home", href: "/" },
    { label: "Images", href: "/images" },
    { label: imageName },
  ];

  return (
    <div className="space-y-6">
      <div>
        <Breadcrumb items={breadcrumbItems} variant="withIcon" />
      </div>

      <div className="grid grid-cols-12 gap-4 md:gap-6">
        <div className="col-span-12">
          {isLoading ? (
            <div className="text-center text-gray-500">Loading image details...</div>
          ) : error ? (
            <div className="text-center text-red-500">Failed to load image details.</div>
          ) : image ? (
            <ViewImage />
          ) : (
            <div className="text-center text-gray-500">Image not found.</div>
          )}
        </div>
      </div>
    </div>
  );
}