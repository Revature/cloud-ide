"use client";

import React, { useMemo } from "react";
import { useRouter } from "next/navigation";
import { BaseTable } from "../tables/BaseTable";
import StatusBadge from "@/components/ui/badge/StatusBadge";
import { Runner } from "@/types/runner";
import { useImagesForItems } from "@/hooks/type-query/useImages";
import { useMachinesForItems } from "@/hooks/type-query/useMachines";
import { useRunners, useStartRunner, useStopRunner, useTerminateRunner } from "@/hooks/type-query/useRunners";
import LatencyIndicator from "../ui/connection/LatencyIndicator";
import { useLatencyForRegions } from "@/hooks/useLatencyForRegions";
import { useCloudConnectorsForItems } from "@/hooks/type-query/useCloudConnectors";

const RunnersTable: React.FC = () => {
  const router = useRouter();

  // Fetch runners
  const { data: runners = [], isLoading, error } = useRunners();

  // Fetch related images and machines using `useResourceForItems`
  const { resourcesById: imagesById, isLoading: imagesLoading} = useImagesForItems(runners);
  const { resourcesById: machinesById, isLoading: machinesLoading } = useMachinesForItems(runners);
  const { resourcesById: connectorsById, isLoading: connectorsLoading } = useCloudConnectorsForItems(Object.values(imagesById));
  const { data: latencyData, isLoading: isLatencyLoading } = useLatencyForRegions();


  // Delete runner mutation
  const { mutate: deleteRunner } = useTerminateRunner(); 
  const { mutate: startRunner } = useStartRunner();
  const { mutate: stopRunner } = useStopRunner();


  // Enrich runners with related data
  const enrichedRunners = useMemo(() => {
    return runners.map((runner) => ({
      ...runner,
      image: runner.imageId ? imagesById[runner.imageId] : undefined,
      machine: runner.machineId ? machinesById[runner.machineId] : undefined,
    })).reverse();
  }, [runners, imagesById, machinesById]);

  // Define columns for the table
  const columns = [
    {
      header: "ID",
      accessor: (item: Runner) => (
        <a
          href={`view/${item.id}`}
          className="text-brand-500 hover:text-brand-600 dark:text-brand-400 dark:hover:text-brand-500 cursor-pointer"
        >
          {item.id}
        </a>
      ),
      searchAccessor: (item: Runner) => item.id.toString() || "",
    },
    {
      header: "Image",
      accessor: (item: Runner) => (
        <div>
          <p className="font-medium text-gray-700 text-theme-sm dark:text-gray-400">
            {item.image ? item.image.name : "NO NAME"}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-500">
            {item.machine ? item.machine.name : "N/A"} (CPU, GB)
          </p>
        </div>
      ),
      searchAccessor: (item: Runner) => item.image?.name || "",
    },
    {
      header: "Latency",
      accessor: (item: Runner) => (
        <LatencyIndicator latency={latencyData?.[connectorsById[item.image!.cloudConnectorId]?.region]} />
      ),
    },
    {
      header: "User",
      accessor: (item: Runner) => item.userId || "In pool (no user assigned)",
      searchAccessor: (item: Runner) => (item.userId ? item.userId.toString() : ""),
    },
    {
      header: "State",
      accessor: (item: Runner) => <StatusBadge status={item.state} />,
      searchAccessor: (item: Runner) => item.state || "",
    },
  ];

  // Define actions for the table
  const actions = (item: Runner) => ({
    "Start Runner": () => startRunner({ id: item.id }),
    "Stop Runner": () => stopRunner({id: item.id}),
    "View Details": () => router.push(`/runners/view/${item.id}`),
  });

  // Handle delete functionality
  const handleDelete = (item?: Runner) => {
    if (!item) return;
    deleteRunner(item.id, {
      onSuccess: () => {
        console.log(`Runner ${item.id} deleted successfully.`);
      },
      onError: (error) => {
        console.error("Error deleting runner:", error);
      },
    });
  };

  if (isLoading || isLatencyLoading || connectorsLoading || imagesLoading || machinesLoading) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white p-10 text-center dark:border-white/[0.05] dark:bg-white/[0.03]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-brand-500 mx-auto"></div>
        <p className="mt-4 text-gray-500 dark:text-gray-400">Loading runners and related data...</p>
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
      data={enrichedRunners}
      columns={columns}
      title="Runners"
      searchPlaceholder="Search runners..."
      onDelete={(item) => handleDelete(item)}
      actions={actions}
      onAddClick={() => router.push("/runners/add")}
      addButtonText="Add Runner"
      queryKey={["runners"]}
      itemsPerPage={5}
    />
  );
};

export default RunnersTable;