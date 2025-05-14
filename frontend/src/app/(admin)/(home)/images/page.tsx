import { Metadata } from "next";
import React from "react";
import ImagesTable from "@/components/image/ImagesTable";
import AdminPageLayout from "@/components/layout/AdminPageLayout";

export const metadata: Metadata = {
  title: "Images | Cloud IDE",
  description: "Manage your virtual machine images",
};

export default function ImagesPage() {
  const breadcrumbItems = [
    { label: "Images" },
  ];

  return (
    <AdminPageLayout breadcrumbs={breadcrumbItems} >
      <ImagesTable />
    </AdminPageLayout>
  );
}