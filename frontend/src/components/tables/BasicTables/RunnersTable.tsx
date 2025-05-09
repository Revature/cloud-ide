"use client";

import React, { useMemo } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useRunnerQuery } from "@/hooks/api/runners/useRunnersData";
import { useMachineForItems } from "@/hooks/api/machines/useMachineForItems";
import { useImageForItems } from "@/hooks/api/images/useImageForItems";
import { runnersApi } from "@/services/cloud-resources/runners";
import { BaseTable } from "./BaseTable";
import StatusBadge from "@/components/ui/badge/StatusBadge";
import { Runner } from "@/types/runner";

const RunnersTable: React.FC = () => {
  const router = useRouter();
  const queryClient = useQueryClient();

  // Fetch runners and related data
  const { data: runners = [], isLoading, error } = useRunnerQuery();
  const { machinesById } = useMachineForItems(runners);
  const { imagesById } = useImageForItems(runners);

  // Enrich runners with related data
  const enrichedRunners = useMemo(
    () =>
      runners.map((runner) => {
        const matchingMachine = runner.machineId ? machinesById[runner.machineId] : null;
        const matchingImage = runner.imageId ? imagesById[runner.imageId] : null;

        return {
          ...runner,
          image: matchingImage || undefined,
          machine: matchingMachine || undefined,
        };
      }).reverse(),
    [runners, machinesById, imagesById]
  );

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
    "Start Runner": () => handleStart(item.id),
    "Stop Runner": () => handleStop(item.id),
    "View Details": () => router.push(`/runners/view/${item.id}`),
  });

  // Handle delete functionality
  const handleDelete = async (item: Runner) => {
    try {
      await runnersApi.terminate(item.id);
      queryClient.invalidateQueries({ queryKey: ["runners"] });
    } catch (error) {
      console.error("Error terminating runner:", error);
    }
  };

  // Handle start functionality
  const handleStart = async (runnerId: number) => {
    try {
      await runnersApi.changeState(runnerId, "start");
      queryClient.invalidateQueries({ queryKey: ["runners"] });
    } catch (error) {
      console.error("Error starting runner:", error);
    }
  };

  // Handle stop functionality
  const handleStop = async (runnerId: number) => {
    try {
      await runnersApi.changeState(runnerId, "stop");
      queryClient.invalidateQueries({ queryKey: ["runners"] });
    } catch (error) {
      console.error("Error stopping runner:", error);
    }
  };

  if (isLoading) {
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
      actions={actions}
      onDelete={handleDelete}
      onAddClick={() => router.push("/runners/add")}
      addButtonText="Add Runner"
      queryKeys={["runners"]}
      itemsPerPage={5}
    />
  );
};

export default RunnersTable;