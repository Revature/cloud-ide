"use client";

import { useParams } from "next/navigation";
import RunnerView from "@/components/runner/RunnerView";
import AdminPageLayout from "@/components/layout/AdminPageLayout";

export default function ViewRunnerPage() {
  const params = useParams();
  const runnerId = parseInt(params.id as string, 10); // Parse runnerId directly from the URL

  // Define breadcrumb items
  const breadcrumbItems = [
    { label: "Runners", href: "/runners" },
    { label: `Runner ${runnerId}` },
  ];

  return (
    <AdminPageLayout breadcrumbs={breadcrumbItems} >
      <RunnerView />
    </AdminPageLayout>
  );
}