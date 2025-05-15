import React from "react";
import AdminPageLayout from "@/components/layout/AdminPageLayout";
import { Metadata } from "next";
import CloudConnectorsTable from "@/components/cloud-connector/CloudConnectorsTable";

export const metadata: Metadata = {
  title: "Cloud Connectors | Cloud IDE",
  description: "Manage your cloud connections",
};

export default function CloudConnectors() {
  const breadcrumbItems = [
    { label: "Cloud Connectors" },
  ];

  return (
    <AdminPageLayout breadcrumbs={breadcrumbItems}>
      <CloudConnectorsTable />
    </AdminPageLayout>
  );
}