"use client";
import React, { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/button/Button";
import { Runner, RunnerState } from "@/types/runner";
import { useQueryClient } from "@tanstack/react-query";
import { useRunnerQuery } from "@/hooks/api/runners/useRunnersData";
import { useMachineForItems } from "@/hooks/api/machines/useMachineForItems";
import { useImageForItems } from "@/hooks/api/images/useImageForItems";

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

const RunnersTable: React.FC = () => {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const itemsPerPage = 5;
  const queryClient = useQueryClient();
  
  // React Query for data fetching
  const { 
    data: runners = [],
    isLoading: runnersLoading,
    error: runnersError 
  } = useRunnerQuery()

  
    const {
      machinesById, 
      isLoading: machineLoading, 
      isError: machineError, 
    } = useMachineForItems(runners)
  
    const {
      imagesById,
      isLoading: imageLoading, 
      isError: imageError, 
    } = useImageForItems(runners)
  
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
      }
  }).reverse(),
    [runners, machinesById, imagesById]
  );

  // Loading state for all data
  const isLoading = runnersLoading || 
    imageLoading || machineLoading;
  
  // Error state for any query
  const error = runnersError || imageError || 
    machineError;

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
    setPage(1);
  }, [searchTerm]);


  const totalPages = Math.max(1, Math.ceil(filteredRunners.length / itemsPerPage));
  const startIndex = (page - 1) * itemsPerPage;
  const visibleRunners = filteredRunners.slice(startIndex, startIndex + itemsPerPage);

  const handleViewRunner = (index: number) => {
    router.push(`/runners/view/${index}`);
  };

  const handleTerminate = (id: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent the row click from triggering
    terminateRunner(id);
  };

  const handleConnect = (runner: Runner, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent the row click from triggering
    if (runner.url) {
      // In a real app, this would redirect to the runner URL or open a connection
      window.open(runner.url, '_blank');
    }
  };

  const canConnect = (runner: Runner) => {
    return runner.state === 'active' || runner.state === 'awaiting_client';
  };

  const canTerminate = (runner: Runner) => {
    return runner.state !== 'terminated';
  };

  // Handle search input change
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
  };

  // Handlers for page navigation
  const goToPage = (pageNumber: number) => {
    if (pageNumber >= 1 && pageNumber <= totalPages) {
      setPage(pageNumber);
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
                <th className="px-4 py-3 font-normal text-gray-500 text-start text-theme-sm dark:text-gray-400">
                  Session
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
                    <td className="px-4 py-4 text-sm text-gray-700 text-theme-sm dark:text-gray-400">
                      {runner.sessionStart ? (
                        <div>
                          <p>Start: {runner.sessionStart}</p>
                          <p>End: {runner.sessionEnd}</p>
                        </div>
                      ) : (
                        "Not started"
                      )}
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-700 text-theme-sm dark:text-gray-400 text-right">
                      <div className="flex justify-end space-x-2">
                        <Button
                          onClick={(e) => handleConnect(runner, e)}
                          size="sm"
                          variant="secondary"
                          className={canConnect(runner) ? "text-blue-600 bg-blue-50 hover:bg-blue-100 dark:text-blue-400 dark:bg-blue-900/20 dark:hover:bg-blue-900/30" : ""}
                          disabled={!canConnect(runner)}
                        >
                          Connect
                        </Button>
                        <Button
                          onClick={(e) => handleTerminate(runner.id.toString(), e)}
                          size="sm"
                          variant="destructive"
                          disabled={!canTerminate(runner)}
                        >
                          Terminate
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

      {/* Pagination Controls - Always show them */}
      <div className="px-6 py-4 border-t border-gray-200 dark:border-white/[0.05]">
        <div className="flex items-center justify-between">
          {/* Previous Button */}
          <Button
            size="sm"
            variant="outline"
            onClick={() => goToPage(page - 1)}
            disabled={page === 1}
          >
            <svg
              className="fill-current"
              width="20"
              height="20"
              viewBox="0 0 20 20"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M2.58301 9.99868C2.58272 10.1909 2.65588 10.3833 2.80249 10.53L7.79915 15.5301C8.09194 15.8231 8.56682 15.8233 8.85981 15.5305C9.15281 15.2377 9.15297 14.7629 8.86018 14.4699L5.14009 10.7472L16.6675 10.7472C17.0817 10.7472 17.4175 10.4114 17.4175 9.99715C17.4175 9.58294 17.0817 9.24715 16.6675 9.24715L5.14554 9.24715L8.86017 5.53016C9.15297 5.23717 9.15282 4.7623 8.85983 4.4695C8.56684 4.1767 8.09197 4.17685 7.79917 4.46984L2.84167 9.43049C2.68321 9.568 2.58301 9.77087 2.58301 9.99715C2.58301 9.99766 2.58301 9.99817 2.58301 9.99868Z"
                fill=""
              />
            </svg>
            <span className="hidden sm:inline">Previous</span>
          </Button>
          {/* Page Info */}
          <span className="block text-sm font-medium text-gray-700 dark:text-gray-400 sm:hidden">
            Page {page} of {totalPages}
          </span>
          {/* Page Numbers */}
          <ul className="hidden items-center gap-0.5 sm:flex">
            {Array.from({ length: totalPages }).map((_, idx) => (
              <li key={idx}>
                <button
                  onClick={() => goToPage(idx + 1)}
                  className={`flex h-10 w-10 items-center justify-center rounded-lg text-theme-sm font-medium ${
                    page === idx + 1
                      ? "bg-brand-500 text-white"
                      : "text-gray-700 hover:bg-brand-500/[0.08] dark:hover:bg-brand-500 dark:hover:text-white hover:text-brand-500 dark:text-gray-400 "
                  }`}
                >
                  {idx + 1}
                </button>
              </li>
            ))}
          </ul>
          {/* Next Button */}
          <Button
            onClick={() => goToPage(page + 1)}
            size="sm"
            variant="outline"
            disabled={page === totalPages}
          >
            <span className="hidden sm:inline">Next</span>
            <svg
              className="fill-current"
              width="20"
              height="20"
              viewBox="0 0 20 20"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M17.4175 9.9986C17.4178 10.1909 17.3446 10.3832 17.198 10.53L12.2013 15.5301C11.9085 15.8231 11.4337 15.8233 11.1407 15.5305C10.8477 15.2377 10.8475 14.7629 11.1403 14.4699L14.8604 10.7472L3.33301 10.7472C2.91879 10.7472 2.58301 10.4114 2.58301 9.99715C2.58301 9.58294 2.91879 9.24715 3.33301 9.24715L14.8549 9.24715L11.1403 5.53016C10.8475 5.23717 10.8477 4.7623 11.1407 4.4695C11.4336 4.1767 11.9085 4.17685 12.2013 4.46984L17.1588 9.43049C17.3173 9.568 17.4175 9.77087 17.4175 9.99715C17.4175 9.99763 17.4175 9.99812 17.4175 9.9986Z"
                fill=""
              />
            </svg>
          </Button>
        </div>
      </div>
    </div>
  );
};

export default RunnersTable;

function terminateRunner(id: string) {
    throw new Error("Function not implemented." + id);
}
