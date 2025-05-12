"use client";

import { useParams } from "next/navigation";
import ViewConnector from "@/components/cloud-connector/CloudConnectorView";
import { useCloudConnectorQuery } from "@/hooks/api/cloudConnectors/useCloudConnectorsData";
import AdminPageLayout from "@/components/layout/AdminPageLayout";

export default function ViewConnectorPage() {
  const params = useParams();
  const id = parseInt(params.id as string, 10);

  // Obtain connectors from CloudConnectorsTable ReactQuery
  const { data: connector } = useCloudConnectorQuery(id);

  // Get connector name for the breadcrumb if available
  const connectorName = connector?.name || "Connector Details";

  const breadcrumbItems = [
    { label: "Cloud Connectors", href: "/cloud-connectors" },
    { label: connectorName },
  ];

  return (
    <AdminPageLayout breadcrumbs={breadcrumbItems}>
      <ViewConnector />
    </AdminPageLayout>
  );
}