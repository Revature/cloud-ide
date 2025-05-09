"use client";
import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useImageQuery } from "@/hooks/api/images/useImageQuery";
import { useMachineForItems } from "@/hooks/api/machines/useMachineForItems";
import { useConnectorForItems } from "@/hooks/api/cloudConnectors/useConnectorForItem";
import { imagesApi } from "@/services/cloud-resources/images";
import ProxyImage from "@/components/ui/images/ProxyImage";
import { BaseTable } from "./BaseTable";
import Link from "next/link";
import { VMImage } from "@/types";
import StatusBadge from "@/components/ui/badge/StatusBadge";

export default function ImagesTable() {
  const router = useRouter();
  const queryClient = useQueryClient();

  // Fetch images using React Query
  const { data: images = [], isLoading: imagesLoading, error: imagesError } = useImageQuery();
  const { machinesById, isLoading: machineLoading, isError: machineError } = useMachineForItems(images);
  const { connectorsById, isLoading: connectorLoading, isError: connectorError } = useConnectorForItems(images);

  // Join the data
  const enrichedImages = useMemo(
    () =>
      images.map((image) => {
        const matchingMachine = image.machineId ? machinesById[image.machineId] : null;
        const matchingConnector = image.cloudConnectorId ? connectorsById[image.cloudConnectorId] : null;

        return {
          ...image,
          cloudConnector: matchingConnector || undefined,
          machine: matchingMachine || undefined,
        };
      }),
    [images, machinesById, connectorsById]
  );

  // Loading state for any query
  const isLoading = imagesLoading || machineLoading || connectorLoading;

  // Error state for any query
  const error = imagesError || connectorError || machineError;

  // Navigate to edit image page
  const navigateToEditImage = (id: number) => {
    router.push(`/images/edit/${id}`);
  };

  // Handle delete functionality
  const handleDelete = async (id: number) => {
    try {
      await imagesApi.delete(id);
      queryClient.invalidateQueries({ queryKey: ["images"] });
    } catch (error) {
      console.error("Error deleting image:", error);
    }
  };

  // Define columns for the table
  const columns = [
    {
      header: "Image",
      accessor: (item: VMImage) => (
        <div>
          <Link
            href={`view/${item.id}`}
            className="text-brand-500 hover:text-brand-600 dark:text-brand-400 dark:hover:text-brand-500 cursor-pointer"
          >
            {item.name}
          </Link>
          <span
            className="block text-xs text-gray-500 dark:text-gray-500 max-w-[200px] truncate cursor-help"
            title={item.description}
          >
            {item.description}
          </span>
        </div>
      ),
      searchAccessor: (item: VMImage) => item.name,
    },
    {
      header: "Cloud Provider",
      accessor: (item:VMImage) =>
        item.cloudConnector ? (
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 relative flex-shrink-0">
              <ProxyImage
                src={item.cloudConnector.image || "/images/brand/default-logo.svg"}
                alt={item.cloudConnector.name || "Cloud provider"}
                width={32}
                height={32}
                className="w-full h-full object-contain"
              />
            </div>
            <span className="text-gray-700 text-theme-sm dark:text-gray-400">{item.cloudConnector.name}</span>
          </div>
        ) : (
          <span className="text-gray-500 text-theme-sm dark:text-gray-500">Not specified</span>
        ),
        searchAccessor: (item: VMImage) => item.cloudConnector?.name || "",
    },
    {
      header: "Machine",
      accessor: (item:VMImage) => item.machine?.name || "N/A",
      searchAccessor: (item: VMImage) => item.machine?.name || "",
    },
    {
      header: "Resources",
      accessor: (item:VMImage) => (
        <div className="flex flex-col">
          <span>
            {item.machine?.cpuCount || 0} CPU{(item.machine?.cpuCount || 0) > 1 ? "s" : ""}
          </span>
          <span>{item.machine?.memorySize || 0} GB RAM</span>
          <span>{item.machine?.storageSize || 0} GB Storage</span>
        </div>
      ),
      searchAccessor: (item: VMImage) => item.machine?.name || "",
    },
    {
      header: "Identifier",
      accessor: (item: VMImage) => (
        <span className="inline-block px-2 py-1 text-xs font-medium bg-gray-100 text-gray-800 rounded dark:bg-gray-700 dark:text-gray-300">
          {item.identifier}
        </span>
      ),
      searchAccessor: (item: VMImage) => item.identifier || "",
    },
    {
      header: "Status",
      accessor: (item: VMImage) => <StatusBadge status={item.status} />,
      searchAccessor: (item: VMImage) => item.status || "",
    },
  ];

  // Define actions for the table
  const actions = (item: VMImage) => ({
    "Edit Image": () => navigateToEditImage(item.id),
    "View Details": () => router.push(`/images/view/${item.id}`),
  });

  if (isLoading) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white p-10 text-center dark:border-white/[0.05] dark:bg-white/[0.03]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-brand-500 mx-auto"></div>
        <p className="mt-4 text-gray-500 dark:text-gray-400">Loading images and related data...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center dark:border-red-800/30 dark:bg-red-900/20">
        <p className="text-red-700 dark:text-red-400">Error loading data: {(error as Error).message}</p>
      </div>
    );
  }

  return (
    <BaseTable
      data={enrichedImages}
      columns={columns}
      title="Images"
      searchPlaceholder="Search images..."
      onSearchChange={(value) => console.log("Search term:", value)} // Optional: Handle search term changes
      actions={actions}
      onDelete={(item) => handleDelete(item.id)}
      itemsPerPage={5} 
      onAddClick={() => router.push("/images/add")} // Add Button functionality
      addButtonText="Add Image" // Custom Add Button text
      queryKeys={["images"]}    />
  );
}