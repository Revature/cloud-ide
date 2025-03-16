"use client";
import { useParams } from "next/navigation";
import ViewImage from "@/components/image/ImageView";
import Breadcrumb from "@/components/ui/breadcrumb/Breadcrumb";
import { useImages } from "@/context/ImagesContext";

export default function ViewImagePage() {
  const { images } = useImages();
  const params = useParams();
  const imageIndex = parseInt(params.id as string, 10);
  
  // Get image name for the breadcrumb if available
  const imageName = !isNaN(imageIndex) && images[imageIndex] 
    ? images[imageIndex].name 
    : "Image Details";
    
  const breadcrumbItems = [
    { label: "Home", href: "/" },
    { label: "Images", href: "/images" },
    { label: imageName }
  ];
  
  return (
    <div className="space-y-6">
      <div>
        <Breadcrumb items={breadcrumbItems} variant="withIcon" />
      </div>
      
      <div className="grid grid-cols-12 gap-4 md:gap-6">
        <div className="col-span-12">
          <ViewImage />
        </div>
      </div>
    </div>
  );
}