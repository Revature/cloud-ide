"use client";
import React from 'react';
import { useParams } from "next/navigation";
import ConnectorEditPage from '@/components/cloud-connector/CloudConnectorEditForm';
import Breadcrumb from "@/components/ui/breadcrumb/Breadcrumb";
import { useCloudConnectors } from "@/context/CloudConnectorsContext";

export default function Page() {
  const { connectors } = useCloudConnectors();
  const params = useParams();
  const connectorIndex = parseInt(params.id as string, 10);
  
  // Get connector name for the breadcrumb if available
  const connectorName = !isNaN(connectorIndex) && connectors[connectorIndex] 
    ? connectors[connectorIndex].name 
    : "Connector";
    
  const breadcrumbItems = [
    { label: "Home", href: "/" },
    { label: "Cloud Connectors", href: "/cloud-connectors" },
    { label: connectorName, href: `/cloud-connectors/view/${connectorIndex}` },
    { label: "Edit" }
  ];
  
  return (
    <div className="space-y-6">
      <div>
        <Breadcrumb items={breadcrumbItems} variant="withIcon" />
      </div>
      
      <div className="grid grid-cols-12 gap-4 md:gap-6">
        <div className="col-span-12">
          <ConnectorEditPage />
        </div>
      </div>
    </div>
  );
}