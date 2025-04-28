"use client";

import React, { useMemo, useState, useRef, useEffect } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "../../ui/table";
import Button from "../../ui/button/Button";
import { useRouter } from "next/navigation";
import { Runner, RunnerState } from "@/types/runner";
import { runnersApi } from "@/services/cloud-resources/runners";
import { useMachineForItems } from "@/hooks/api/machines/useMachineForItems";
import { useImageForItems } from "@/hooks/api/images/useImageForItems";
import { CustomPagination } from "@/components/ui/pagination/CustomPagination";
import { useQueryClient } from "@tanstack/react-query";
import { useRunnerQuery } from "@/hooks/api/runners/useRunnersData";
import RefreshButton from "@/components/ui/button/RefreshButton";

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
    case "closed":
      return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
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
    case "closed":
      return 'Closed';
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


const canStart = (runner: Runner) => runner.state === "closed";
const canStop = (runner: Runner) => runner.state === "ready" ||  runner.state === "active" || runner.state === "awaiting_client" ;

const RunnersTable: React.FC = () => {
  const router = useRouter();
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;
  const queryClient = useQueryClient();
  const [activeDropdown, setActiveDropdown] = useState<number | null>(null); // Track which dropdown is active
  const dropdownTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleDropdownToggle = (runnerId: number) => {
    if (activeDropdown === runnerId) {
      setActiveDropdown(null); // Close the dropdown if it's already open
    } else {
      setActiveDropdown(runnerId); // Open the dropdown for the clicked runner
    }
  };

  const handleMouseLeave = () => {
    // Set a timeout to close the dropdown after 5 seconds
    dropdownTimeoutRef.current = setTimeout(() => {
      setActiveDropdown(null);
    }, 5000);
  };

  const handleMouseEnter = () => {
    // Clear the timeout if the mouse re-enters the dropdown
    if (dropdownTimeoutRef.current) {
      clearTimeout(dropdownTimeoutRef.current);
      dropdownTimeoutRef.current = null;
    }
  };

  useEffect(() => {
    // Cleanup timeout on component unmount
    return () => {
      if (dropdownTimeoutRef.current) {
        clearTimeout(dropdownTimeoutRef.current);
      }
    };
  }, []);

  // React Query for data fetching
  const { data: runners = [], isLoading, error } = useRunnerQuery();
  const { machinesById } = useMachineForItems(runners);
  const { imagesById } = useImageForItems(runners);

  // Search functionality
  const [searchTerm, setSearchTerm] = useState<string>("");

  // Join the data
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

  // Filter runners based on search term
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

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filteredRunners.length / itemsPerPage));
  const startIndex = (currentPage - 1) * itemsPerPage;
  const visibleRunners = filteredRunners.slice(startIndex, startIndex + itemsPerPage);

  const handlePageChange = (pageNumber: number) => {
    if (pageNumber >= 1 && pageNumber <= totalPages) {
      setCurrentPage(pageNumber);
    }
  };

  const handleViewRunner = (runnerId: number) => {
    router.push(`/runners/view/${runnerId}`);
  };

  const handleTerminate = async (runnerId: number, e: React.MouseEvent) => {
    e.stopPropagation();

    try {
      await runnersApi.terminate(runnerId);
      console.log(`Runner with ID ${runnerId} terminated successfully.`);
      queryClient.invalidateQueries({ queryKey: ["runners"] });
    } catch (error) {
      console.error("Error terminating runner:", error);
    } 
  };

  const handleStart = async (runnerId: number) => {
    try {
      await runnersApi.start(runnerId);
      console.log(`Runner with ID ${runnerId} started successfully.`);
      queryClient.invalidateQueries({ queryKey: ["runners"] });
    } catch (error) {
      console.error("Error starting runner:", error);
    }
  };

  const handleStop = async (runnerId: number) => {
    try {
      await runnersApi.stop(runnerId);
      console.log(`Runner with ID ${runnerId} stopped successfully.`);
      queryClient.invalidateQueries({ queryKey: ["runners"] });
    } catch (error) {
      console.error("Error stopping runner:", error);
    }
  };

  const canTerminate = (runner: Runner) => runner.state !== "terminated";

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
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
        <p className="text-red-700 dark:text-red-400">
          Error loading data: {(error as Error).message}
        </p>
        <Button
          variant="primary"
          size="sm"
          className="mt-4"
          onClick={() => queryClient.invalidateQueries({ queryKey: ["runners"] })}
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
          <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90">Runners</h3>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          {/* Refresh Button */}
          <RefreshButton queryKeys={["runners"]} />

          {/* Search Bar */}
<form onSubmit={(e) => e.preventDefault()} className="flex-grow">
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
          <Button size="sm" variant="primary" onClick={() => router.push("/runners/add")}>
            Add Runner
          </Button>
        </div>
      </div>

      <div className="overflow-hidden">
        <div className="max-w-full px-5 overflow-x-auto sm:px-6">
          <Table>
            <TableHeader className="border-gray-100 border-y dark:border-white/[0.05]">
              <TableRow>
                <TableCell isHeader className="px-4 py-3 font-normal text-gray-500 text-start text-theme-sm dark:text-gray-400">
                  ID
                </TableCell>
                <TableCell isHeader className="px-4 py-3 font-normal text-gray-500 text-start text-theme-sm dark:text-gray-400">
                  Image
                </TableCell>
                <TableCell isHeader className="px-4 py-3 font-normal text-gray-500 text-start text-theme-sm dark:text-gray-400">
                  User
                </TableCell>
                <TableCell isHeader className="px-4 py-3 font-normal text-gray-500 text-start text-theme-sm dark:text-gray-400">
                  State
                </TableCell>
                <TableCell isHeader className="px-4 py-3 font-normal text-gray-500 text-start text-theme-sm dark:text-gray-400 text-right">
                  Actions
                </TableCell>
              </TableRow>
            </TableHeader>
            <TableBody className="divide-y divide-gray-100 dark:divide-white/[0.05]">
              {visibleRunners.length === 0 ? (
                <TableRow>
                  <TableCell className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                    {searchTerm ? "No runners found matching your search." : "No runners found."}
                  </TableCell>
                </TableRow>
              ) : (
                visibleRunners.map((runner) => (
                  <TableRow key={runner.id} className="hover:bg-gray-50 dark:hover:bg-white/[0.03]">
                    <TableCell className="px-4 py-4 text-sm font-medium">
                      <a
                        onClick={() => handleViewRunner(runner.id)}
                        className="text-brand-500 hover:text-brand-600 dark:text-brand-400 dark:hover:text-brand-500 cursor-pointer"
                      >
                        {runner.id}
                      </a>
                    </TableCell>
                    <TableCell className="px-4 py-4 text-sm text-gray-900 dark:text-white">
                      <div className="flex items-center">
                        <div>
                          <p className="font-medium text-gray-700 text-theme-sm dark:text-gray-400">
                            {runner.image ? runner.image.name : "NO NAME"}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-500">
                            {runner.machine ? runner.machine.name : "N/A"} (CPU, GB)
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="px-4 py-4 text-sm text-gray-700 text-theme-sm dark:text-gray-400">
                      {runner.userId || "In pool (no user assigned)"}
                    </TableCell>
                    <TableCell className="px-4 py-4 text-sm">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStateColor(
                          runner.state
                        )}`}
                      >
                        {getStateLabel(runner.state)}
                      </span>
                    </TableCell>
                    <TableCell className="px-4 py-4 text-sm text-gray-700 text-theme-sm dark:text-gray-400 text-right">
                      <div className="flex justify-end space-x-2">
                        {/* Edit Dropdown */}
                        <div className="relative">
                          <button
                            onClick={() => handleDropdownToggle(runner.id)}
                            className="p-2 text-gray-500 hover:text-blue-500 transition-colors"
                            title="Edit Runner"
                          >
                          <svg 
                            width="20" 
                            height="20" 
                            viewBox="0 0 24 24" 
                            fill="none" 
                            xmlns="http://www.w3.org/2000/svg"
                            className="stroke-current"
                          >
                            <path 
                              d="M11 4H4C3.46957 4 2.96086 4.21071 2.58579 4.58579C2.21071 4.96086 2 5.46957 2 6V20C2 20.5304 2.21071 21.0391 2.58579 21.4142C2.96086 21.7893 3.46957 22 4 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V13" 
                              strokeWidth="2" 
                              strokeLinecap="round" 
                              strokeLinejoin="round"
                            />
                            <path 
                              d="M18.5 2.50001C18.8978 2.10219 19.4374 1.87869 20 1.87869C20.5626 1.87869 21.1022 2.10219 21.5 2.50001C21.8978 2.89784 22.1213 3.4374 22.1213 4.00001C22.1213 4.56262 21.8978 5.10219 21.5 5.50001L12 15L8 16L9 12L18.5 2.50001Z" 
                              strokeWidth="2" 
                              strokeLinecap="round" 
                              strokeLinejoin="round"
                            />
                          </svg>
                          </button>
                          {activeDropdown === runner.id && (
                            <div
                              className="absolute right-0 mt-2 w-48 bg-white border border-gray-200 rounded-lg shadow-lg dark:bg-gray-900 dark:border-gray-700"
                              onMouseEnter={handleMouseEnter}
                              onMouseLeave={handleMouseLeave}
                            >
                              <button
                                disabled={!canStart(runner)}
                                onClick={() => handleStart(runner.id)}
                                className="block w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
                              >
                                Start Runner
                              </button>
                              <button
                                disabled={!canStop(runner)}
                                onClick={() => handleStop(runner.id)}
                                className="block w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
                              >
                                Stop Runner
                              </button>
                              <button
                                onClick={() => handleViewRunner(runner.id)}
                                className="block w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
                              >
                                View Details
                              </button>
                            </div>
                          )}
                        </div>

                        {/* Delete Button */}
                          <button
                            disabled={!canTerminate(runner)}
                            onClick={(e) => handleTerminate(runner.id, e)}
                            className="p-2 text-gray-500 hover:text-red-500 transition-colors"
                            title="Delete Runner"
                          >
                          <svg
                            width="20"
                            height="20"
                            viewBox="0 0 20 20"
                            fill="none"
                            xmlns="http://www.w3.org/2000/svg"
                          >
                            <path
                              fillRule="evenodd"
                              clipRule="evenodd"
                              d="M6.54142 3.7915C6.54142 2.54886 7.54878 1.5415 8.79142 1.5415H11.2081C12.4507 1.5415 13.4581 2.54886 13.4581 3.7915V4.0415H15.6252H16.666C17.0802 4.0415 17.416 4.37729 17.416 4.7915C17.416 5.20572 17.0802 5.5415 16.666 5.5415H16.3752V8.24638V13.2464V16.2082C16.3752 17.4508 15.3678 18.4582 14.1252 18.4582H5.87516C4.63252 18.4582 3.62516 17.4508 3.62516 16.2082V13.2464V8.24638V5.5415H3.3335C2.91928 5.5415 2.5835 5.20572 2.5835 4.7915C2.5835 4.37729 2.91928 4.0415 3.3335 4.0415H4.37516H6.54142V3.7915ZM14.8752 13.2464V8.24638V5.5415H13.4581H12.7081H7.29142H6.54142H5.12516V8.24638V13.2464V16.2082C5.12516 16.6224 5.46095 16.9582 5.87516 16.9582H14.1252C14.5394 16.9582 14.8752 16.6224 14.8752 16.2082V13.2464ZM8.04142 4.0415H11.9581V3.7915C11.9581 3.37729 11.6223 3.0415 11.2081 3.0415H8.79142C8.37721 3.0415 8.04142 3.37729 8.04142 3.7915V4.0415ZM8.3335 7.99984C8.74771 7.99984 9.0835 8.33562 9.0835 8.74984V13.7498C9.0835 14.1641 8.74771 14.4998 8.3335 14.4998C7.91928 14.4998 7.5835 14.1641 7.5835 13.7498V8.74984C7.5835 8.33562 7.91928 7.99984 8.3335 7.99984ZM12.4168 8.74984C12.4168 8.33562 12.081 7.99984 11.6668 7.99984C11.2526 7.99984 10.9168 8.33562 10.9168 8.74984V13.7498C10.9168 14.1641 11.2526 14.4998 11.6668 14.4998C12.081 14.4998 12.4168 14.1641 12.4168 13.7498V8.74984Z"
                            fill="currentColor"
                          />
                          </svg>
                          </button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {filteredRunners.length > 0 && (
        <div className="mt-4">
          <CustomPagination
            totalItems={filteredRunners.length}
            itemsPerPage={itemsPerPage}
            currentPage={currentPage}
            onPageChange={handlePageChange}
          />
        </div>
      )}
    </div>
  );
};

export default RunnersTable;
