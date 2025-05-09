"use client";

import React from "react";
import { useParams } from "next/navigation";
import EditImageForm from "@/components/image/ImageEditForm";
import AdminPageLayout from "@/components/layout/AdminPageLayout";
import { useImageQuery } from "@/hooks/api/images/useImageQuery";

export default function EditImagePage() {
  const params = useParams();
  const imageId = parseInt(params.id as string, 10);

  // Fetch image details using useImageQuery
  const { data: image } = useImageQuery(imageId);

  // Get image name for the breadcrumb if available
  const imageName = image?.name || "Image";

  const breadcrumbItems = [
    { label: "Images", href: "/images" },
    { label: imageName, href: `/images/view/${imageId}` },
    { label: "Edit" },
  ];

  return (
    <AdminPageLayout breadcrumbs={breadcrumbItems} >
      <EditImageForm />
    </AdminPageLayout>
  );
}