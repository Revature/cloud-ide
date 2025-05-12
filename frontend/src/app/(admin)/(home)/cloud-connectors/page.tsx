import React from "react";
import CloudConnectorsTable from "@/components/tables/BasicTables/CloudConnectorsTable";
import AdminPageLayout from "@/components/layout/AdminPageLayout";
import { Metadata } from "next";

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