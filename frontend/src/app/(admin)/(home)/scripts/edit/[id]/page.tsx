"use client";

import React from "react";
import { useParams } from "next/navigation";
import ScriptEditForm from "@/components/script/ScriptEditForm";
import Breadcrumb from "@/components/ui/breadcrumb/Breadcrumb";
import { useScriptsQuery } from "@/hooks/api/scripts/useScriptsQuery";

export default function EditScriptPage() {
  const params = useParams();
  const scriptId = parseInt(params.id as string, 10);

  // Fetch scripts using React Query
  const { data: scripts = [] } = useScriptsQuery();

  // Get script name for the breadcrumb if available
  const script = scripts.find((s) => s.id === scriptId);
  const scriptName = script?.name || "Script";

  const breadcrumbItems = [
    { label: "Home", href: "/" },
    { label: "Scripts", href: "/scripts" },
    { label: scriptName, href: `/scripts/view/${scriptId}` },
    { label: "Edit" },
  ];

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div>
        <Breadcrumb items={breadcrumbItems} variant="withIcon" />
      </div>

      {/* Edit Script Form */}
      <div className="grid grid-cols-12 gap-4 md:gap-6">
        <div className="col-span-12">
          <ScriptEditForm scriptId={scriptId} />
        </div>
      </div>
    </div>
  );
}