"use client";
import { useParams } from "next/navigation";
import ViewConnector from "@/components/cloud-connector/CloudConnectorView";
import Breadcrumb from "@/components/ui/breadcrumb/Breadcrumb";
import { useCloudConnectors } from "@/context/CloudConnectorsContext";

export default function ViewConnectorPage() {
  const { connectors } = useCloudConnectors();
  const params = useParams();
  const connectorIndex = parseInt(params.id as string, 10);
  
  // Get connector name for the breadcrumb if available
  const connectorName = !isNaN(connectorIndex) && connectors[connectorIndex] 
    ? connectors[connectorIndex].name 
    : "Connector Details";
    
  const breadcrumbItems = [
    { label: "Home", href: "/" },
    { label: "Cloud Connectors", href: "/cloud-connectors" },
    { label: connectorName }
  ];
  
  return (
    <div className="space-y-6">
      <div>
        <Breadcrumb items={breadcrumbItems} variant="withIcon" />
      </div>
      
      <div className="grid grid-cols-12 gap-4 md:gap-6">
        <div className="col-span-12">
          <ViewConnector />
        </div>
      </div>
    </div>
  );
}