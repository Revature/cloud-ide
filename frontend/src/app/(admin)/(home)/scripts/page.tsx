"use client";

import React from "react";
import ScriptsTable from "@/components/tables/BasicTables/ScriptsTable";
import Breadcrumb from "@/components/ui/breadcrumb/Breadcrumb";

export default function ScriptsPage() {
  const breadcrumbItems = [
    { label: "Home", href: "/" },
    { label: "Scripts", href: "/scripts" },
  ];

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div>
        <Breadcrumb items={breadcrumbItems} variant="withIcon" />
      </div>

      {/* Page Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-800 dark:text-white/90">
          Scripts
        </h1>
      </div>

      {/* Scripts Table */}
      <div className="bg-white dark:bg-white/[0.03] border border-gray-200 dark:border-white/[0.05] rounded-xl p-6">
        <ScriptsTable />
      </div>
    </div>
  );
}