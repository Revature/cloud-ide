import { Metadata } from "next";
import React from "react";
import RunnersTable from "@/components/tables/BasicTables/RunnersTable";
import Breadcrumb from "@/components/ui/breadcrumb/Breadcrumb";


export const metadata: Metadata = {
  title: "Runners | Cloud IDE",
  description: "Manage your virtual machine runners",
};

export default function RunnersPage() {
  
  const breadcrumbItems = [
    { label: "Home", href: "/" },
    { label: "Runners" }
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
          <RunnersTable />
        </div>
      </div>
    </div>
  );
}