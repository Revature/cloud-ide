"use client";
import React from 'react';
import { useParams } from "next/navigation";
import ConnectorEditPage from '@/components/cloud-connector/CloudConnectorEditForm';
import { useCloudConnectorQuery } from '@/hooks/api/cloudConnectors/useCloudConnectorsData';
import AdminPageLayout from '@/components/layout/AdminPageLayout';

export default function Page() {
  const params = useParams();
  const id = parseInt(params.id as string, 10);

  // Obtain connectors from CloudConnectorsTable ReactQuery
  const { data:connector } = useCloudConnectorQuery(id)
  
  // Get connector name for the breadcrumb if available
  const connectorName = connector?.name || "Connector";
    
  const breadcrumbItems = [
    { label: "Cloud Connectors", href: "/cloud-connectors" },
    { label: connectorName, href: `/cloud-connectors/view/${id}` },
    { label: "Edit" }
  ];
  
  return (
    <AdminPageLayout breadcrumbs={breadcrumbItems}>
          <ConnectorEditPage />
    </AdminPageLayout>
  );
}