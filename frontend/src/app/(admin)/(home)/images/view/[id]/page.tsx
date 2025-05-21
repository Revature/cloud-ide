"use client";

import { useParams } from "next/navigation";
import ViewImage from "@/components/image/ImageView";
import AdminPageLayout from "@/components/layout/AdminPageLayout";
import { useImageById } from "@/hooks/type-query/useImages";

export default function ViewImagePage() {
  const params = useParams();
  const imageId = parseInt(params.id as string, 10); // Parse imageId directly from the URL

  // Fetch the specific image using the imageId
  const { data: image } = useImageById(imageId);

  // Get image name for the breadcrumb if available
  const imageName = image?.name || "Image Details";

  const breadcrumbItems = [
    { label: "Images", href: "/images" },
    { label: imageName },
  ];

  return (
    <AdminPageLayout breadcrumbs={breadcrumbItems} >
      <ViewImage />
    </AdminPageLayout>
  );
}