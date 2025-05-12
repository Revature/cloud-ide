"use client";
import { useRouter } from "next/navigation";
import { useCloudConnectorQuery } from "@/hooks/api/cloudConnectors/useCloudConnectorsData";
import { BaseTable } from "./BaseTable";
import ProxyImage from "@/components/ui/images/ProxyImage";
import StatusBadge from "@/components/ui/badge/StatusBadge";
import { CloudConnector } from "@/types";
import Link from "next/link";
// import { cloudConnectorsApi } from "@/services";
// import { useQueryClient } from "@tanstack/react-query";

export default function CloudConnectorsTable() {
  const { data: connectorsData = [], isLoading, error } = useCloudConnectorQuery();
  const router = useRouter();
  // const queryClient = useQueryClient();

  // Define columns for the table
  const columns = [
    {
      header: "Provider",
      accessor: (item: CloudConnector) => (
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 flex items-center justify-center">
            {item.image ? (
              <ProxyImage
                width={32}
                height={32}
                src={item.image}
                alt={item.name || "Cloud Provider"}
              />
            ) : (
              <div className="w-8 h-8 bg-gray-200 dark:bg-gray-700 rounded-full flex items-center justify-center">
                <span className="text-xs text-gray-500 dark:text-gray-400">?</span>
              </div>
            )}
          </div>
          <div>
            <Link
              href={`view/${item.id}`}
              className="text-brand-500 hover:text-brand-600 dark:text-brand-400 dark:hover:text-brand-500 cursor-pointer"
            >
              {item.name}
            </Link>
          </div>
        </div>
      ),
      searchAccessor: (item: CloudConnector) => item.name || "",
    },
    {
      header: "Added",
      accessor: (item: CloudConnector) => item.createdOn,
      searchAccessor: (item: CloudConnector) => item.createdOn || "",
    },
    {
      header: "Region",
      accessor: (item: CloudConnector) => item.region,
      searchAccessor: (item: CloudConnector) => item.region || "",
    },
    {
      header: "Status",
      accessor: (item: CloudConnector) => <StatusBadge status={item.status} />,
      searchAccessor: (item: CloudConnector) => item.status || "",
    },
  ];

  // Define actions for the table
  const actions = (item: CloudConnector) => ({
    "Edit Connector": () => router.push(`/cloud-connectors/edit/${item.id}`),
    "View Details": () => router.push(`/cloud-connectors/view/${item.id}`),
  });

  // // Handle delete functionality
  //   const handleDelete = async (id: number) => {
  //     try {
  //       await cloudConnectorsApi.delete(id);
  //       queryClient.invalidateQueries({ queryKey: ["cloud-connectors"] });
  //     } catch (error) {
  //       console.error("Error deleting image:", error);
  //     }
  //   };

  if (isLoading) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center dark:border-white/[0.05] dark:bg-white/[0.03]">
        <div className="animate-pulse">Loading cloud connectors...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center dark:border-white/[0.05] dark:bg-white/[0.03]">
        <div className="text-red-500">
          Error loading cloud connectors: {error.message}
        </div>
      </div>
    );
  }

  return (
    <BaseTable
      data={connectorsData}
      columns={columns}
      title="Cloud Connectors"
      searchPlaceholder="Search connectors..."
      actions={actions}
      // onDelete={(item) => item && handleDelete(item.id)}
      onAddClick={() => router.push("/cloud-connectors/add")}
      addButtonText="Add Connector"
      queryKeys={["cloud-connectors"]}
      itemsPerPage={5}
    />
  );
}