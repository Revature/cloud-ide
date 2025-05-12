// src/app/(admin)/(home)/images/add/page.tsx
"use client";

import ImageFormWithTerminal from "@/components/image/ImageFormWithTerminal";
import AdminPageLayout from "@/components/layout/AdminPageLayout";

export default function AddImagePage() {

  const breadcrumbItems = [
    { label: "Images", href: "/images" },
    { label: "Add Image" },
  ];

  return (
    <AdminPageLayout breadcrumbs={breadcrumbItems} >
      <ImageFormWithTerminal />
    </AdminPageLayout>
  );
}