import { Metadata } from "next";
import React from "react";
import RunnersTable from "@/components/tables/BasicTables/RunnersTable";
import AdminPageLayout from "@/components/layout/AdminPageLayout";

export const metadata: Metadata = {
  title: "Runners | Cloud IDE",
  description: "Manage your virtual machine runners",
};

export default function RunnersPage() {
  const breadcrumbItems = [
    { label: "Runners" },
  ];

  return (
    <AdminPageLayout breadcrumbs={breadcrumbItems} >
      <RunnersTable />
    </AdminPageLayout>
  );
}