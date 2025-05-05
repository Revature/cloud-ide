"use client";

import React, { useState, useMemo, useRef, useEffect } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "../../ui/table";
import Button from "../../ui/button/Button";
import RefreshButton from "@/components/ui/button/RefreshButton";
import { useScriptsQuery } from "@/hooks/api/scripts/useScriptsQuery";
import { useRouter } from "next/navigation";
import { CustomPagination } from "@/components/ui/pagination/CustomPagination";
import { useImageForItems } from "@/hooks/api/images/useImageForItems";
import Link from "next/link";
import { scriptsApi } from "@/services/cloud-resources/scripts";
import { useQueryClient } from "@tanstack/react-query";

// Function to get event color
const getEventColor = (event: string) => {
  switch (event) {
    case "on_create":
      return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400";
    case "on_awaiting_client":
      return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400";
    case "on_connect":
      return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400";
    case "on_disconnect":
      return "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400";
    case "on_terminate":
      return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400";
    default:
      return "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300";
  }
};

// Function to get event label
const getEventLabel = (event: string) => {
  switch (event) {
    case "on_create":
      return "On Create";
    case "on_awaiting_client":
      return "Awaiting Client";
    case "on_connect":
      return "On Connect";
    case "on_disconnect":
      return "On Disconnect";
    case "on_terminate":
      return "On Terminate";
    default:
      return event;
  }
};

const ScriptsTable: React.FC = () => {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [activeDropdown, setActiveDropdown] = useState<number | null>(null); // Track which dropdown is active
  const dropdownTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // State for search functionality
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  // Fetch scripts using the custom hook
  const { data: scripts = [], isLoading, error } = useScriptsQuery();
  // Attach image data to scripts
  const { imagesById, isLoading: isImagesLoading } = useImageForItems(scripts);


  // Filter scripts based on the search term
  const filteredScripts = useMemo(() => {
    if (searchTerm.trim() === "") {
      return scripts;
    }
    const lowercasedSearch = searchTerm.toLowerCase();
    return scripts.filter(
      (script) =>
        script.name.toLowerCase().includes(lowercasedSearch) ||
        script.description.toLowerCase().includes(lowercasedSearch)
    );
  }, [searchTerm, scripts]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filteredScripts.length / itemsPerPage));
  const startIndex = (currentPage - 1) * itemsPerPage;
  const visibleScripts = filteredScripts.slice(startIndex, startIndex + itemsPerPage);

  const handlePageChange = (pageNumber: number) => {
    if (pageNumber >= 1 && pageNumber <= totalPages) {
      setCurrentPage(pageNumber);
    }
  };

  // Handle search input changes
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
  };

  // Handle viewing a script
  const handleViewScript = (scriptId: number) => {
    router.push(`/scripts/view/${scriptId}`);
  };

  const handleDeleteScript = async (scriptId: number) => {
    try {
      await scriptsApi.delete(scriptId);
      queryClient.invalidateQueries({ queryKey: ["scripts"] }); // Refresh the scripts list
    } catch (error) {
      console.error("Failed to delete script:", error);
    }
  };
  
  // Handle editing a script
  const handleEditScript = (scriptId: number) => {
    router.push(`/scripts/edit/${scriptId}`);
  };

  // Handle dropdown toggle
  const handleDropdownToggle = (scriptId: number) => {
    if (activeDropdown === scriptId) {
      setActiveDropdown(null); // Close the dropdown if it's already open
    } else {
      setActiveDropdown(scriptId); // Open the dropdown for the clicked script
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

  if (isLoading || isImagesLoading) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white p-10 text-center dark:border-white/[0.05] dark:bg-white/[0.03]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-brand-500 mx-auto"></div>
        <p className="mt-4 text-gray-500 dark:text-gray-400">Loading scripts...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center dark:border-red-800/30 dark:bg-red-900/20">
        <p className="text-red-700 dark:text-red-400">
          Error loading scripts: {(error as Error).message}
        </p>
        <Button
          variant="primary"
          size="sm"
          className="mt-4"
          onClick={() => console.log("Retrying...")}
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
            Scripts
          </h3>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          {/* Refresh Button */}
          <RefreshButton queryKeys={["scripts"]} />

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
                    d="M9 3a6 6 0 100 12A6 6 0 009 3zM1 9a8 8 0 1114.32 4.906l4.387 4.387a1 1 0 01-1.414 1.414l-4.387-4.387A8 8 0 011 9z"
                  />
                </svg>
              </button>
              <input
                type="text"
                placeholder="Search scripts..."
                className="dark:bg-dark-900 h-[42px] w-full rounded-lg border border-gray-300 bg-transparent py-2.5 pl-[42px] pr-4 text-sm text-gray-800 shadow-theme-xs placeholder:text-gray-400 focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:placeholder:text-white/30 dark:focus:border-brand-800 xl:w-[300px]"
                value={searchTerm}
                onChange={handleSearchChange}
              />
            </div>
          </form>

          <Button size="sm" variant="primary" onClick={() => router.push("/scripts/add")}>
            Add Script
          </Button>
        </div>
      </div>

      <div className="overflow-hidden">
        <div className="max-w-full px-5 overflow-x-auto sm:px-6">
          <Table>
            <TableHeader className="border-gray-100 border-y dark:border-white/[0.05]">
              <TableRow>
                <TableCell isHeader className="px-4 py-3 font-normal text-gray-500 text-start text-theme-sm dark:text-gray-400">
                  Name
                </TableCell>
                <TableCell isHeader className="px-4 py-3 font-normal text-gray-500 text-start text-theme-sm dark:text-gray-400">
                  Event
                </TableCell>
                <TableCell isHeader className="px-4 py-3 font-normal text-gray-500 text-start text-theme-sm dark:text-gray-400">
                  Description
                </TableCell>
                <TableCell isHeader className="px-4 py-3 font-normal text-gray-500 text-start text-theme-sm dark:text-gray-400">
                  Image
                </TableCell>
                <TableCell isHeader className="px-4 py-3 font-normal text-gray-500 text-start text-theme-sm dark:text-gray-400 text-right">
                  Actions
                </TableCell>
              </TableRow>
            </TableHeader>
            <TableBody className="divide-y divide-gray-100 dark:divide-white/[0.05]">
              {visibleScripts.length === 0 ? (
                <TableRow>
                  <TableCell className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                    {searchTerm ? "No scripts found matching your search." : "No scripts found."}
                  </TableCell>
                </TableRow>
              ) : (
                visibleScripts.map((script) => (
                  <TableRow key={script.id} className="hover:bg-gray-50 dark:hover:bg-white/[0.03]">
                    <TableCell className="px-4 py-4 text-sm font-medium">
                    <Link
                        href={`view/${script.id}`}
                        className="text-brand-500 hover:text-brand-600 dark:text-brand-400 dark:hover:text-brand-500 cursor-pointer"
                      >
                      {script.name}
                      </Link>
                    </TableCell>
                    <TableCell className="px-4 py-4 text-sm">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getEventColor(
                          script.event
                        )}`}
                      >
                        {getEventLabel(script.event)}
                      </span>
                    </TableCell>
                    <TableCell className="px-4 py-4 text-sm text-gray-900 dark:text-white">
                      {script.description}
                    </TableCell>
                    <TableCell className="px-4 py-4 text-sm text-gray-900 dark:text-white">
                      {script.imageId && imagesById[script.imageId] ? (
                        <Link
                          href={`view/${script.imageId}`}
                          className="text-brand-500 hover:text-brand-600 dark:text-brand-400 dark:hover:text-brand-500 cursor-pointer"
                        >
                          {imagesById[script.imageId].name}
                        </Link>
                      ) : (
                        <span className="text-gray-500 dark:text-gray-400">No Image</span>
                      )}
                    </TableCell>
                    <TableCell className="px-4 py-4 text-sm text-gray-700 dark:text-gray-400 text-right">
                      <div className="flex justify-end space-x-2">
                      <div className="relative">
                        <button
                          onClick={() => handleDropdownToggle(script.id)}
                          className="p-2 text-gray-500 hover:text-blue-500 transition-colors"
                          title="Actions"
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
                        {activeDropdown === script.id && (
                          <div
                            className="absolute right-0 mt-2 w-48 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-10"
                            onMouseEnter={handleMouseEnter}
                            onMouseLeave={handleMouseLeave}
                          >
                            <button
                              onClick={() => handleViewScript(script.id)}
                              className="block w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
                            >
                              View Details
                            </button>
                            <button
                              onClick={() => handleEditScript(script.id)}
                              className="block w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
                            >
                              Edit Script
                            </button>
                          </div>
                        )}
                        </div>
                        {/* Delete Button */}
                        <button
                          onClick={() => handleDeleteScript(script.id)}
                          className="p-2 text-gray-500 hover:text-red-500 transition-colors"
                          title="Delete Script"
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
      {filteredScripts.length > 0 && (
              <div className="mt-4">
                <CustomPagination
                  totalItems={filteredScripts.length}
                  itemsPerPage={itemsPerPage}
                  currentPage={currentPage}
                  onPageChange={handlePageChange}
                />
              </div>
            )}
    </div>
  );
};

export default ScriptsTable;