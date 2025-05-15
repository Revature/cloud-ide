import { Metadata } from "next";
import React from "react";
import RunnerPoolTable from "@/components/runner-pool/RunnerPoolTable";
import AdminPageLayout from "@/components/layout/AdminPageLayout";

export const metadata: Metadata = {
  title: "Runner Pools | Cloud IDE",
  description: "Manage your pool of runners",
};

export default function RunnerPoolsPage() {
  const breadcrumbItems = [
    { label: "Runner Pools" },
  ];

  return (
    <AdminPageLayout breadcrumbs={breadcrumbItems}>
      <RunnerPoolTable />
    </AdminPageLayout>
  );
}