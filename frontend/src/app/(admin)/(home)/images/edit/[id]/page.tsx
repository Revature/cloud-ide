"use client";
import React from 'react';
import { useParams } from "next/navigation";
import EditImageForm from '@/components/image/ImageEditForm';
import Breadcrumb from "@/components/ui/breadcrumb/Breadcrumb";
import { useImages } from "@/context/ImagesContext";

export default function EditImagePage() {
  const { images } = useImages();
  const params = useParams();
  const imageIndex = parseInt(params.id as string, 10);
  
  // Get image name for the breadcrumb if available
  const imageName = !isNaN(imageIndex) && images[imageIndex] 
    ? images[imageIndex].name 
    : "Image";
    
  const breadcrumbItems = [
    { label: "Home", href: "/" },
    { label: "Images", href: "/images" },
    { label: imageName, href: `/images/view/${imageIndex}` },
    { label: "Edit" }
  ];
  
  return (
    <div className="space-y-6">
      <div>
        <Breadcrumb items={breadcrumbItems} variant="withIcon" />
      </div>
      
      <div className="grid grid-cols-12 gap-4 md:gap-6">
        <div className="col-span-12">
          <EditImageForm />
        </div>
      </div>
    </div>
  );
}