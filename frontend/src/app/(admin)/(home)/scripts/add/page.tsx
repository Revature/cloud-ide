"use client";

import React from "react";
import ScriptForm from "@/components/script/ScriptForm";
import Breadcrumb from "@/components/ui/breadcrumb/Breadcrumb";

export default function AddScriptPage() {

  const breadcrumbItems = [
    { label: "Home", href: "/" },
    { label: "Scripts", href: "/scripts" },
    { label: "Add Script" },
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
          Add Script
        </h1>
      </div>

      {/* Script Form */}
      <div className="bg-white dark:bg-white/[0.03] border border-gray-200 dark:border-white/[0.05] rounded-xl p-6">
        <ScriptForm />
      </div>
    </div>
  );
}