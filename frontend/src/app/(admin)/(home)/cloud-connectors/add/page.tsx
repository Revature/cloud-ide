"use client";

import AdminPageLayout from "@/components/layout/AdminPageLayout";
import CloudConnectorForm from "@/components/cloud-connector/CloudConnectorForm";

export default function AddCloudConnectorPage() {
  const breadcrumbItems = [
    { label: "Cloud Connectors", href: "/cloud-connectors" },
    { label: "Add Connector" },
  ];

  return (
    <AdminPageLayout breadcrumbs={breadcrumbItems} >
      <CloudConnectorForm />
    </AdminPageLayout>
  );
}