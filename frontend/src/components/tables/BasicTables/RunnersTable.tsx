"use client";
import React, { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/button/Button";
import { Runner, RunnerState } from "@/types/runner";
import { useQueryClient } from "@tanstack/react-query";
import { useRunnerQuery } from "@/hooks/api/runners/useRunnersData";
import { useMachineForItems } from "@/hooks/api/machines/useMachineForItems";
import { useImageForItems } from "@/hooks/api/images/useImageForItems";
import { CustomPagination } from "@/components/ui/pagination/CustomPagination";

const getStateColor = (state: RunnerState) => {
  switch (state) {
    case "active":
      return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
    case "ready":
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400';
    case "awaiting_client":
      return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400';
    case "starting":
      return 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400';
    case "terminated":
    default:
      return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
  }
};

const getStateLabel = (state: RunnerState) => {
  switch (state) {
    case "active":
      return 'Active';
    case "ready":
      return 'Ready';
    case "awaiting_client":
      return 'Awaiting Client';
    case "starting":
      return 'Starting';
    case "terminated":
      return 'Terminated';
    default:
      return state;
  }
};

export const terminateRunner = async (runnerId: number): Promise<void> => {
  const response = await fetch(`http://localhost:8020/api/v1/runners/${runnerId}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    throw new Error(`Failed to terminate runner with ID ${runnerId}. HTTP status: ${response.status}`);
  }
};

const RunnersTable: React.FC = () => {
  const router = useRouter();
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;
  const queryClient = useQueryClient();
  const [loadingRunnerId, setLoadingRunnerId] = useState<number | null>(null); // Track the runner being terminated

  // React Query for data fetching
  const { 
    data: runners = [],
    isLoading: runnersLoading,
    error: runnersError 
  } = useRunnerQuery();

  const {
    machinesById, 
    isLoading: machineLoading, 
    isError: machineError, 
  } = useMachineForItems(runners);

  const {
    imagesById,
    isLoading: imageLoading, 
    isError: imageError, 
  } = useImageForItems(runners);

  // Search functionality
  const [searchTerm, setSearchTerm] = useState<string>("");

  // Join the data
  const enrichedRunners = useMemo(() => 
    runners.map(runner => {
      const matchingMachine = runner.machineId ? machinesById[runner.machineId] : null;
      const matchingImage = runner.imageId ? imagesById[runner.imageId] : null;

      return {
        ...runner,
        image: matchingImage || undefined,
        machine: matchingMachine || undefined
      };
    }).reverse(),
    [runners, machinesById, imagesById]
  );

  // Loading state for all data
  const isLoading = runnersLoading || imageLoading || machineLoading;

  // Error state for any query
  const error = runnersError || imageError || machineError;

  // Use useMemo to filter runners based on search term
  const filteredRunners = useMemo(() => {
    if (searchTerm.trim() === "") {
      return enrichedRunners;
    } else {
      const lowercasedSearch = searchTerm.toLowerCase();
      return enrichedRunners.filter(
        (runner) =>
          runner.identifier.toLowerCase().includes(lowercasedSearch) ||
          (runner.machine?.name && runner.machine.name.toLowerCase().includes(lowercasedSearch)) ||
          (runner.machine?.identifier && runner.machine.identifier.toLowerCase().includes(lowercasedSearch)) ||
          runner.state.toLowerCase().includes(lowercasedSearch) ||
          (runner.image?.name && runner.image.name.toLowerCase().includes(lowercasedSearch))
      );
    }
  }, [searchTerm, enrichedRunners]);

  // Reset to first page when search results change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  const totalPages = Math.max(1, Math.ceil(filteredRunners.length / itemsPerPage));
  const startIndex = (currentPage - 1) * itemsPerPage;
  const visibleRunners = filteredRunners.slice(startIndex, startIndex + itemsPerPage);

  const handleViewRunner = (index: number) => {
    router.push(`/runners/view/${index}`);
  };

  const handleTerminate = async (runnerId: number, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent the row click from triggering
    setLoadingRunnerId(runnerId); // Set the loading state for the runner being terminated

    try {
      await terminateRunner(runnerId);
      console.log(`Runner with ID ${runnerId} terminated successfully.`);
      queryClient.invalidateQueries({ queryKey: ["runners"] }); // Refresh the runners list
    } catch (error) {
      console.error("Error terminating runner:", error);
    } finally {
      setLoadingRunnerId(null); // Reset the loading state
    }
  };

  const handleConnect = (runner: Runner, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent the row click from triggering
    router.push(`/runners/view/${runner.id}?autoConnect=true`);
  };

  const canConnect = (runner: Runner) => {
    return runner.state === 'active' || runner.state === 'ready' || runner.state === 'awaiting_client';
  };

  const canTerminate = (runner: Runner) => {
    return runner.state !== 'terminated';
  };

  // Handle search input change
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
  };

  // Handlers for page navigation
  const handlePageChange = (pageNumber: number) => {
    if (pageNumber >= 1 && pageNumber <= totalPages) {
      setCurrentPage(pageNumber);
    }
  };

  // Find the original index in the runners array
  const getOriginalIndex = (index: number) => {
    const runner = visibleRunners[index];
    return runners.findIndex(r => r.id === runner.id);
  };

  // Show loading state
  if (isLoading) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white p-10 text-center dark:border-white/[0.05] dark:bg-white/[0.03]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-brand-500 mx-auto"></div>
        <p className="mt-4 text-gray-500 dark:text-gray-400">Loading runners and related data...</p>
      </div>
    );
  }
  
  // Show error state
  if (error) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center dark:border-red-800/30 dark:bg-red-900/20">
        <p className="text-red-700 dark:text-red-400">
          Error loading data: {(error as Error).message}
        </p>
        <Button
          variant="primary"
          size="sm"
          className="mt-4"
          onClick={() => {
            queryClient.invalidateQueries({ queryKey: ['runners'] });
            // uniqueImageIds.forEach(id => {
            //   queryClient.invalidateQueries({ queryKey: ['images', id] });
            // });
            // uniqueMachineIds.forEach(id => {
            //   queryClient.invalidateQueries({ queryKey: ['machine', id] });
            // });
          }}
        >
          Try Again
        </Button>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-gray-200 bg-white pt-4 dark:border-white/[0.05] dark:bg-white/[0.03]">
      <div className="flex flex-col gap-2 px-5 mb-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90">
            Runners
          </h3>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <form onSubmit={(e) => e.preventDefault()}>
            <div className="relative">
              <button className="absolute -translate-y-1/2 left-4 top-1/2" type="button">
                <svg
                  className="fill-gray-500 dark:fill-gray-400"
                  width="20"
                  height="20"
                  viewBox="0 0 20 20"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    fillRule="evenodd"
                    clipRule="evenodd"
                    d="M3.04199 9.37381C3.04199 5.87712 5.87735 3.04218 9.37533 3.04218C12.8733 3.04218 15.7087 5.87712 15.7087 9.37381C15.7087 12.8705 12.8733 15.7055 9.37533 15.7055C5.87735 15.7055 3.04199 12.8705 3.04199 9.37381ZM9.37533 1.54218C5.04926 1.54218 1.54199 5.04835 1.54199 9.37381C1.54199 13.6993 5.04926 17.2055 9.37533 17.2055C11.2676 17.2055 13.0032 16.5346 14.3572 15.4178L17.1773 18.2381C17.4702 18.531 17.945 18.5311 18.2379 18.2382C18.5308 17.9453 18.5309 17.4704 18.238 17.1775L15.4182 14.3575C16.5367 13.0035 17.2087 11.2671 17.2087 9.37381C17.2087 5.04835 13.7014 1.54218 9.37533 1.54218Z"
                    fill=""
                  />
                </svg>
              </button>
              <input
                type="text"
                placeholder="Search runners..."
                className="dark:bg-dark-900 h-[42px] w-full rounded-lg border border-gray-300 bg-transparent py-2.5 pl-[42px] pr-4 text-sm text-gray-800 shadow-theme-xs placeholder:text-gray-400 focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:placeholder:text-white/30 dark:focus:border-brand-800 xl:w-[300px]"
                value={searchTerm}
                onChange={handleSearchChange}
              />
            </div>
          </form>
          <Button 
            size="sm" 
            variant="primary" 
            onClick={() => router.push('/runners/add')}
          >
            Add Runner
          </Button>
        </div>
      </div>

      <div className="overflow-hidden">
        <div className="max-w-full px-5 overflow-x-auto sm:px-6">
          <table className="w-full border-collapse text-left">
            <thead className="border-gray-100 border-y dark:border-white/[0.05]">
              <tr>
                <th className="px-4 py-3 font-normal text-gray-500 text-start text-theme-sm dark:text-gray-400">
                  ID
                </th>
                <th className="px-4 py-3 font-normal text-gray-500 text-start text-theme-sm dark:text-gray-400">
                  Image
                </th>
                <th className="px-4 py-3 font-normal text-gray-500 text-start text-theme-sm dark:text-gray-400">
                  User
                </th>
                <th className="px-4 py-3 font-normal text-gray-500 text-start text-theme-sm dark:text-gray-400">
                  State
                </th>
                <th className="px-4 py-3 font-normal text-gray-500 text-start text-theme-sm dark:text-gray-400 text-right">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-white/[0.05]">
              {visibleRunners.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                    {searchTerm 
                      ? "No runners found matching your search." 
                      : "No runners found."}
                  </td>
                </tr>
              ) : (
                visibleRunners.map((runner, index) => (
                  <tr
                    key={runner.id}
                    className="hover:bg-gray-50 dark:hover:bg-white/[0.03]"
                  >
                    <td className="px-4 py-4 text-sm font-medium">
                      <a 
                        onClick={() => handleViewRunner(getOriginalIndex(index))}
                        className="text-brand-500 hover:text-brand-600 dark:text-brand-400 dark:hover:text-brand-500 cursor-pointer"
                      >
                        {runner.id}
                      </a>
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-900 dark:text-white">
                      <div className="flex items-center">
                        <div>
                          <p className="font-medium text-gray-700 text-theme-sm dark:text-gray-400">{runner.image ? runner.image.name : "NO NAME"}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-500">
                            {runner.machine ? runner.machine.name : "N/A"} ({runner.machine ? runner.machine.cpuCount : 0} CPU, {runner.machine ? runner.machine.memorySize : 0} GB)
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-700 text-theme-sm dark:text-gray-400">
                      {runner.userId || "In pool (no user assigned)"}
                    </td>
                    <td className="px-4 py-4 text-sm">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStateColor(runner.state)}`}>
                        {getStateLabel(runner.state)}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-700 text-theme-sm dark:text-gray-400 text-right">
                      <div className="flex justify-end space-x-2">
                        <Button
                          onClick={(e) => handleConnect(runner, e)}
                          size="sm"
                          variant="secondary"
                          className={canConnect(runner) ? "text-blue-600 bg-blue-50 hover:bg-blue-100 dark:text-blue-400 dark:bg-blue-900/20 dark:hover:bg-blue-900/30" : ""}
                          disabled={!canConnect(runner) || loadingRunnerId === runner.id}
                        >
                          Connect
                        </Button>
                        <Button
                          onClick={(e) => handleTerminate(runner.id, e)}
                          size="sm"
                          variant="destructive"
                          disabled={!canTerminate(runner) || loadingRunnerId === runner.id}
                        >
                          {loadingRunnerId === runner.id ? (
                            <div className="flex items-center">
                              <svg
                                className="animate-spin h-4 w-4 mr-2"
                                xmlns="http://www.w3.org/2000/svg"
                                fill="none"
                                viewBox="0 0 24 24"
                              >
                                <circle
                                  className="opacity-25"
                                  cx="12"
                                  cy="12"
                                  r="10"
                                  stroke="currentColor"
                                  strokeWidth="4"
                                ></circle>
                                <path
                                  className="opacity-75"
                                  fill="currentColor"
                                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                                ></path>
                              </svg>
                              Terminating
                            </div>
                          ) : (
                            "Terminate"
                          )}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination Controls */}
            {filteredRunners.length > 0 && (
              <div>
                <div className="mt-4">
                  <CustomPagination
                    totalItems={filteredRunners.length}
                    itemsPerPage={itemsPerPage}
                    currentPage={currentPage}
                    onPageChange={handlePageChange}
                    // siblingCount={1} // Optional, defaults to 1
                    className="my-custom-pagination-styles" // Optional custom styling
                  />
                </div>
      
                {/* Optional: Display current range */}
                <div className="text-center text-sm text-gray-600 dark:text-gray-400 mt-2">
                  Showing {Math.min(filteredRunners.length > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0, filteredRunners.length)}
                  - {Math.min(currentPage * itemsPerPage, filteredRunners.length)} of {filteredRunners.length} items
                </div>
            </div>
            )}
            </div>
  );
};

export default RunnersTable;
