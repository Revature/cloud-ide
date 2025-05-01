import { Metadata } from "next";
import React from "react";
import Breadcrumb from "@/components/ui/breadcrumb/Breadcrumb";
import RunnerPoolTable from "@/components/tables/BasicTables/RunnerPoolTable";


export const metadata: Metadata = {
  title: "Runners | Cloud IDE",
  description: "Manage your virtual machine runners",
};

export default function RunnersPage() {
  
  const breadcrumbItems = [
    { label: "Home", href: "/" },
    { label: "RunnerPool" }
  ];
  
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Breadcrumb items={breadcrumbItems} variant="withIcon" />
        </div>
      </div>

      <div className="grid grid-cols-12 gap-4 md:gap-6">
        <div className="col-span-12">
          <RunnerPoolTable />
        </div>
      </div>
    </div>
  );
}