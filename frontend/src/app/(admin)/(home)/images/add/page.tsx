// src/app/(admin)/(home)/images/add/page.tsx
"use client";
import { useRouter } from "next/navigation";
import ImageFormWithTerminal from "@/components/image/ImageFormWithTerminal";
import Button from "@/components/ui/button/Button";
import { ImageFormData } from "@/components/image/ImageFormWithTerminal";
import Breadcrumb from "@/components/ui/breadcrumb/Breadcrumb";

export default function AddImagePage() {
  const router = useRouter();
  
  const breadcrumbItems = [
    { label: "Home", href: "/" },
    { label: "Images", href: "/images" },
    { label: "Add Image" }
  ];
  
  const handleSubmit = (imageData: ImageFormData) => {
    console.log("Submitting image data:", imageData);
    // Here you would handle the API call to add the image
    
    // Navigate back to the images list page
    router.push("/images");
  };
  
  const handleCancel = () => {
    router.push("/images");
  };
  
  return (
    <div className="space-y-6">
      <div>
        <Breadcrumb items={breadcrumbItems} variant="withIcon" />
      </div>
      
      <div className="grid grid-cols-12 gap-4 md:gap-6">
        <div className="col-span-12">
          <div className="flex items-center mb-6">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleCancel} 
              className="mr-4"
            >
              <svg
                className="fill-current mr-2"
                width="20"
                height="20"
                viewBox="0 0 20 20"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  fillRule="evenodd"
                  clipRule="evenodd"
                  d="M2.58301 9.99868C2.58272 10.1909 2.65588 10.3833 2.80249 10.53L7.79915 15.5301C8.09194 15.8231 8.56682 15.8233 8.85981 15.5305C9.15281 15.2377 9.15297 14.7629 8.86018 14.4699L5.14009 10.7472L16.6675 10.7472C17.0817 10.7472 17.4175 10.4114 17.4175 9.99715C17.4175 9.58294 17.0817 9.24715 16.6675 9.24715L5.14554 9.24715L8.86017 5.53016C9.15297 5.23717 9.15282 4.7623 8.85983 4.4695C8.56684 4.1767 8.09197 4.17685 7.79917 4.46984L2.84167 9.43049C2.68321 9.568 2.58301 9.77087 2.58301 9.99715C2.58301 9.99766 2.58301 9.99817 2.58301 9.99868Z"
                  fill=""
                />
              </svg>
              Back
            </Button>
            <h1 className="text-2xl font-semibold text-gray-800 dark:text-white/90">
              Add New VM Image
            </h1>
          </div>
          
          <div className="bg-white dark:bg-white/[0.03] border border-gray-200 dark:border-white/[0.05] rounded-xl p-6">
            <ImageFormWithTerminal 
              onSubmit={handleSubmit} 
              onCancel={handleCancel} 
            />
          </div>
        </div>
      </div>
    </div>
  );
}