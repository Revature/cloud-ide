"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BaseTable } from "../tables/BaseTable";
import ProxyImage from "@/components/ui/images/ProxyImage";
import { Image } from "@/types/images";
import Link from "next/link";
import { useImages, usePatchRunnerPool } from "@/hooks/type-query/useImages";
import { useCloudConnectorsForItems } from "@/hooks/type-query/useCloudConnectors";

export default function RunnerPoolTable() {
  const { data: images = [], isLoading, error } = useImages(); 
  const { resourcesById: connectorsById, isLoading: connectorLoading } = useCloudConnectorsForItems(images);

  const { mutateAsync: updateRunnerPoolSize } = usePatchRunnerPool();

  const router = useRouter();

  const [editingPoolId, setEditingPoolId] = useState<number | null>(null);
  const [newPoolSize, setNewPoolSize] = useState<number | null>(null);

  // Handle updating the runner pool size
  const handleUpdatePoolSize = async (id: number) => {
    if (newPoolSize !== null) {
      try {
        await updateRunnerPoolSize({ id, data: newPoolSize });
        console.log(`Runner pool size updated to ${newPoolSize} for image ID ${id}.`);
      } catch (error) {
        console.error(`Error updating runner pool size for image ID ${id}:`, error);
      }
      setEditingPoolId(null);
      setNewPoolSize(null);
    }
  };

  // Handle deleting a runner pool
  const handleDeleteRunnerPool = async (item?: Image) => {
    if (item?.id) {
      try {
        await updateRunnerPoolSize({ id: item.id, data: 0 });
        console.log(`Runner pool deleted for image ID ${item.id}.`);
      } catch (error) {
        console.error(`Error deleting runner pool with ID ${item.id}:`, error);
      }
    }
  };

  // Define columns for the table
  const columns = [
    {
      header: "Image Name",
      accessor: (item: Image) => (
        <div>
          <Link
            href={`/images/view/${item.id}`}
            className="text-brand-500 hover:text-brand-600 dark:text-brand-400 dark:hover:text-brand-500 cursor-pointer"
          >
            {item.name}
          </Link>
        </div>
      ),
      searchAccessor: (item: Image) => item.name || "",
    },
    {
      header: "Cloud Provider",
      accessor: (item: Image) => (
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 relative flex-shrink-0">
            <ProxyImage
              src={connectorsById[item.cloudConnectorId]?.image || "/images/brand/default-logo.svg"}
              alt={connectorsById[item.cloudConnectorId]?.name || "Unknown"}
              width={32}
              height={32}
              className="w-full h-full object-contain"
            />
          </div>
          <span className="text-gray-700 text-theme-sm dark:text-gray-400">
            {connectorsById[item.cloudConnectorId]?.name || "Unknown"}
          </span>
        </div>
      ),
      searchAccessor: (item: Image) => connectorsById[item.cloudConnectorId]?.name || "",
    },
    {
      header: "Runner Pool Size",
      accessor: (item: Image) =>
        editingPoolId === item.id ? (
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={1}
              max={10}
              value={newPoolSize ?? ""}
              onChange={(e) => setNewPoolSize(Number(e.target.value))}
              className="w-16 border border-gray-300 rounded-md text-center dark:border-gray-700 dark:bg-gray-800 dark:text-white"
            />
            <button
            onClick={() => handleUpdatePoolSize(item.id)}
            className="relative p-2 text-gray-500 hover:text-green-500 transition-colors"
            title={"Confirm"}
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" className="size-6">
                <path stroke-linecap="round" stroke-linejoin="round" d="m4.5 12.75 6 6 9-13.5" />
              </svg>
            </button>
          </div>
        ) : (
          <span className="text-gray-700 text-theme-sm dark:text-gray-400">
            {item.runnerPoolSize}
          </span>
        ),
      searchAccessor: (item: Image) => item.runnerPoolSize.toString(),
    },
  ];

  // Define actions for the table
  const actions = (item: Image) => ({
    "Edit Pool Size": () => {
      setEditingPoolId(item.id);
      const currentPoolSize = images.find((image) => image.id === item.id)?.runnerPoolSize || 0;
      setNewPoolSize(currentPoolSize);
    },
  });

  if (isLoading || connectorLoading) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white p-10 text-center dark:border-white/[0.05] dark:bg-white/[0.03]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-brand-500 mx-auto"></div>
        <p className="mt-4 text-gray-500 dark:text-gray-400">Loading runner pools...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center dark:border-red-800/30 dark:bg-red-900/20">
        <p className="text-red-700 dark:text-red-400">
          Error loading runner pools: {error instanceof Error ? error.message : "Unknown error"}
        </p>
      </div>
    );
  }

  return (
    <BaseTable
      data={images.filter((image) => image.runnerPoolSize > 0)}
      columns={columns}
      title="Runner Pools"
      searchPlaceholder="Search runner pool..."
      actions={actions}
      onAddClick={() => router.push("/runner-pools/add")}
      addButtonText="Add Runner Pool"
      queryKey={["images"]}
      onDelete={handleDeleteRunnerPool}
      itemsPerPage={5}
    />
  );
}