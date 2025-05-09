"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useImageQuery } from "@/hooks/api/images/useImageQuery";
import { useConnectorForItems } from "@/hooks/api/cloudConnectors/useConnectorForItem";
import { imagesApi } from "@/services/cloud-resources/images";
import { BaseTable } from "./BaseTable";
import ProxyImage from "@/components/ui/images/ProxyImage";
import { VMImage } from "@/types";

export default function RunnerPoolTable() {
  const { data: images = [], isLoading, error, refetch } = useImageQuery();
  const { connectorsById } = useConnectorForItems(images);
  const router = useRouter();

  const [editingPoolId, setEditingPoolId] = useState<number | null>(null);
  const [newPoolSize, setNewPoolSize] = useState<number | null>(null);

  // Handle updating the runner pool size
  const handleUpdatePoolSize = async (id: number) => {
    if (editingPoolId === id) {
      if (newPoolSize !== null) {
        try {
          await imagesApi.patchRunnerPoolSize(id, newPoolSize);
          await refetch();
        } catch (error) {
          console.error(`Error updating runner pool size for image ID ${id}:`, error);
        }
      }
      setEditingPoolId(null);
      setNewPoolSize(null);
    } else {
      setEditingPoolId(id);
      const currentPoolSize = images.find((image) => image.id === id)?.runnerPoolSize || 0;
      setNewPoolSize(currentPoolSize);
    }
  };

  // Define columns for the table
  const columns = [
    {
      header: "Image Name",
      accessor: (item: VMImage) => (
        <span className="block font-medium text-gray-700 text-theme-sm dark:text-gray-400">
          {item.name}
        </span>
      ),
      searchAccessor: (item: VMImage) => item.name || "",
    },
    {
      header: "Cloud Provider",
      accessor: (item: VMImage) => (
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
      searchAccessor: (item: VMImage) => connectorsById[item.cloudConnectorId]?.name || "",
    },
    {
      header: "Runner Pool Size",
      accessor: (item: VMImage) =>
        editingPoolId === item.id ? (
          <input
            type="number"
            min={1}
            max={10}
            value={newPoolSize ?? ""}
            onChange={(e) => setNewPoolSize(Number(e.target.value))}
            className="w-16 border border-gray-300 rounded-md text-center dark:border-gray-700 dark:bg-gray-800 dark:text-white"
          />
        ) : (
          <span className="text-gray-700 text-theme-sm dark:text-gray-400">
            {item.runnerPoolSize}
          </span>
        ),
      searchAccessor: (item: VMImage) => item.runnerPoolSize.toString(),
    },
  ];

  // Define actions for the table
  const actions = (item: VMImage) => ({
    "Edit Pool Size": () => handleUpdatePoolSize(item.id),
  });

  if (isLoading) {
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
      queryKeys={["images"]}
      itemsPerPage={5}
    />
  );
}