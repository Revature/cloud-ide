"use client";
import { useState, useEffect, useMemo, useRef } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "../../ui/table";
import Button from "../../ui/button/Button";
import { useRouter } from "next/navigation";
import ProxyImage from "@/components/ui/images/ProxyImage";
import { useImageQuery } from "@/hooks/api/images/useImageQuery";
import { useMachineForItems } from "@/hooks/api/machines/useMachineForItems";
import { useConnectorForItems } from "@/hooks/api/cloudConnectors/useConnectorForItem";
import { CustomPagination } from "@/components/ui/pagination/CustomPagination";
import { useQueryClient } from "@tanstack/react-query";
import { Modal } from "@/components/ui/modal";
import ProgressBar from "@/components/ui/progress/ProgressBar";
import RefreshButton from "@/components/ui/button/RefreshButton";

export default function ImagesTable() {
  const router = useRouter();
  const queryClient = useQueryClient();
  
  // State for current page and items per page
  const [currentPage, setCurrentPage] = useState<number>(1);
  const itemsPerPage = 5; // Set the number of items per page
  
  // Search state
  const [searchTerm, setSearchTerm] = useState<string>("");
  
  // Fetch images using React Query
  const { 
    data: images = [], 
    isLoading: imagesLoading, 
    error: imagesError 
  } = useImageQuery()

  const {
    machinesById, 
    isLoading: machineLoading, 
    isError: machineError, 
  } = useMachineForItems(images)

  const {
    connectorsById, 
    isLoading: connectorLoading, 
    isError: connectorError, 
  } = useConnectorForItems(images)

  // Join the data
  const enrichedImages = useMemo(() => 
    images.map(image => {
      
      const matchingMachine = image.machineId ? machinesById[image.machineId] : null;
      const matchingConnector = image.cloudConnectorId ? connectorsById[image.cloudConnectorId] : null;
    
      return {
      ...image,
      cloudConnector: matchingConnector || null,
      machine: matchingMachine || null
    }
    
  }),
    [images, machinesById, connectorsById]
  );
  
  
  // Loading state for any query
  const isLoading = imagesLoading || 
    machineLoading || 
    connectorLoading;
  
  // Error state for any query
  const error = imagesError || 
    connectorError || 
    machineError;

  // Use useMemo to filter images based on search term
  const filteredImages = useMemo(() => {
    if (searchTerm.trim() === "") {
      return enrichedImages;
    } else {
      const lowercasedSearch = searchTerm.toLowerCase();
      return enrichedImages.filter(
        (image) =>
          image.name.toLowerCase().includes(lowercasedSearch) ||
          (image.machine?.name && image.machine.name.toLowerCase().includes(lowercasedSearch)) ||
          (image.machine?.identifier && image.machine.identifier.toLowerCase().includes(lowercasedSearch)) ||
          image.description.toLowerCase().includes(lowercasedSearch) ||
          (image.cloudConnector?.name && image.cloudConnector.name.toLowerCase().includes(lowercasedSearch))
      );
    }
  }, [searchTerm, enrichedImages]);

  // Reset to first page when search results change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  // Calculate the indexes for the current page
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;

  // Slice the data for the current page
  const currentItems = filteredImages.slice(indexOfFirstItem, indexOfLastItem);

  // Calculate total pages
  const totalPages = Math.max(1, Math.ceil(filteredImages.length / itemsPerPage));

  // Handlers for page navigation
  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  // Navigate to the add image page
  const navigateToAddImage = () => {
    router.push("/images/add");
  };
  
  // Navigate to view image page
  const navigateToViewImage = (id: number) => {
    router.push(`/images/view/${id}`);
  };
  
  // Navigate to edit image page
  const navigateToEditImage = (id: number) => {
    router.push(`/images/edit/${id}`);
  };

  // Handle search input change
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
  };

  const [deleteModalOpen, setDeleteModalOpen] = useState<boolean>(false);
  const [deleteImageId, setDeleteImageId] = useState<number | null>(null);
  const [progress, setProgress] = useState<number>(0);
  const intervalId = useRef<NodeJS.Timeout | null>(null);

  const handleOpenDeleteModal = (id: number) => {
    setDeleteImageId(id);
    setDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (deleteImageId !== null) {
      try {
        console.log(`Sending DELETE request for image ID: ${deleteImageId}`);
        const response = await fetch(`http://localhost:8020/api/v1/images/${deleteImageId}`, {
          method: "DELETE",
        });
  
        if (!response.ok) {
          console.error(`Failed to delete image with ID ${deleteImageId}. HTTP status: ${response.status}`);
          return;
        }
  
        const responseData = await response.json();
        console.log("Response data:", responseData);
  
        console.log(`Image with ID ${deleteImageId} deleted successfully.`);
        setDeleteModalOpen(false);
        setDeleteImageId(null);
        setProgress(0);
  
        // Optionally, refresh the images list
        queryClient.invalidateQueries({ queryKey: ["images"] });
      } catch (error) {
        console.error("Error deleting image:", error);
      }
    }
  };

  const handleCancelDelete = () => {
    setDeleteModalOpen(false);
    setDeleteImageId(null);
    setProgress(0);
  };
  
  // Show loading state
  if (isLoading) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white p-10 text-center dark:border-white/[0.05] dark:bg-white/[0.03]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-brand-500 mx-auto"></div>
        <p className="mt-4 text-gray-500 dark:text-gray-400">Loading images and related data...</p>
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
            // queryClient.invalidateQueries({ queryKey: ['images'] });
            // uniqueConnectorIds.forEach(id => {
            //   queryClient.invalidateQueries({ queryKey: ['cloudConnector', id] });
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
            VM Images
          </h3>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          {/* Refresh Button */}
          <RefreshButton queryKeys={["images"]} />

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
                placeholder="Search images..."
                className="dark:bg-dark-900 h-[42px] w-full rounded-lg border border-gray-300 bg-transparent py-2.5 pl-[42px] pr-4 text-sm text-gray-800 shadow-theme-xs placeholder:text-gray-400 focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:placeholder:text-white/30 dark:focus:border-brand-800 xl:w-[300px]"
                value={searchTerm}
                onChange={handleSearchChange}
              />
            </div>
          </form>

          {/* Add Image Button */}
          <Button size="sm" variant="primary" onClick={navigateToAddImage}>
            Add Image
          </Button>
        </div>
      </div>

      <div className="overflow-hidden">
        <div className="max-w-full px-5 overflow-x-auto sm:px-6">
          <Table>
            <TableHeader className="border-gray-100 border-y dark:border-white/[0.05]">
              <TableRow>
                <TableCell
                  isHeader
                  className="py-3 font-normal text-gray-500 text-start text-theme-sm dark:text-gray-400"
                >
                  Image
                </TableCell>
                <TableCell
                  isHeader
                  className="px-4 py-3 font-normal text-gray-500 text-start text-theme-sm dark:text-gray-400"
                >
                  Cloud Provider
                </TableCell>
                <TableCell
                  isHeader
                  className="px-4 py-3 font-normal text-gray-500 text-start text-theme-sm dark:text-gray-400"
                >
                  Machine
                </TableCell>
                <TableCell
                  isHeader
                  className="px-4 py-3 font-normal text-gray-500 text-start text-theme-sm dark:text-gray-400"
                >
                  Resources
                </TableCell>
                <TableCell
                  isHeader
                  className="px-4 py-3 font-normal text-gray-500 text-start text-theme-sm dark:text-gray-400"
                >
                  Identifier
                </TableCell>
                <TableCell
                  isHeader
                  className="px-4 py-3 font-normal text-gray-500 text-start text-theme-sm dark:text-gray-400 min-w-[150px] w-[150px]"
                >
                  Status
                </TableCell>
                <TableCell
                  isHeader
                  className="px-4 py-3 font-normal text-gray-500 text-start text-theme-sm dark:text-gray-400 w-[80px]"
                >
                  Actions
                </TableCell>
              </TableRow>
            </TableHeader>
            <TableBody className="divide-y divide-gray-100 dark:divide-white/[0.05]">
              {currentItems.length === 0 ? (
                <TableRow>
                  <TableCell className="col-span-7 px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                    No images found matching your search.
                  </TableCell>
                </TableRow>
              ) : (
                currentItems.map((item) => (
                  <TableRow key={item.id || item.identifier}>
                    <TableCell className="px-4 py-4">
                      <div className="flex items-center gap-3">
                        <div>
                          <span 
                            className="block font-medium text-gray-700 text-theme-sm dark:text-gray-400 hover:text-brand-500 dark:hover:text-brand-400 cursor-pointer transition-colors"
                            onClick={() => navigateToViewImage(item.id)}
                          >
                            {item.name}
                          </span>
                          <span 
                            className="block text-xs text-gray-500 dark:text-gray-500 max-w-[200px] truncate cursor-help"
                            title={item.description}
                          >
                            {item.description}
                          </span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="px-4 py-4">
                      {item.cloudConnector ? (
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 relative flex-shrink-0">
                            <ProxyImage
                              src={item.cloudConnector.image || "/images/brand/default-logo.svg"}
                              alt={item.cloudConnector.name || 'Cloud provider'}
                              width={32}
                              height={32}
                              className="w-full h-full object-contain"
                            />
                          </div>
                          <span className="text-gray-700 text-theme-sm dark:text-gray-400">
                            {item.cloudConnector.name}
                          </span>
                        </div>
                      ) : (
                        <span className="text-gray-500 text-theme-sm dark:text-gray-500">
                          Not specified
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="px-4 py-4 text-gray-700 whitespace-nowrap text-theme-sm dark:text-gray-400">
                      {item.machine?.name || 'N/A'}
                    </TableCell>
                    <TableCell className="px-4 py-4 text-gray-700 text-theme-sm dark:text-gray-400">
                      <div className="flex flex-col">
                        <span>{item.machine?.cpuCount || 0} CPU{(item.machine?.cpuCount || 0) > 1 ? 's' : ''}</span>
                        <span>{item.machine?.memorySize || 0} GB RAM</span>
                        <span>{item.machine?.storageSize || 0} GB Storage</span>
                      </div>
                    </TableCell>
                    <TableCell className="px-4 py-4 text-gray-700 text-theme-sm dark:text-gray-400">
                      <span className="inline-block px-2 py-1 text-xs font-medium bg-gray-100 text-gray-800 rounded dark:bg-gray-700 dark:text-gray-300">
                        {item.identifier}
                      </span>
                    </TableCell>
                    <TableCell className="px-4 py-4 text-gray-700 text-theme-sm dark:text-gray-400 min-w-[150px] w-[150px]">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        item.active 
                          ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' 
                          : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                      }`}>
                        {item.active ? 'Active' : 'Inactive'}
                      </span>
                    </TableCell>
                    <TableCell className="px-4 py-4 text-gray-700 text-theme-sm dark:text-gray-400 w-[80px]">
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={() => navigateToEditImage(item.id)}
                          className="p-2 text-gray-500 hover:text-brand-500 transition-colors"
                          title="Edit Image"
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
                        <button
                          onClick={() => handleOpenDeleteModal(item.id)}
                          className="p-2 text-gray-500 hover:text-red-500 transition-colors"
                          title="Delete Image"
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

      {/* Pagination Controls */}
            {filteredImages.length > 0 && (
              <div>
                <div className="mt-4">
                  <CustomPagination
                    totalItems={filteredImages.length}
                    itemsPerPage={itemsPerPage}
                    currentPage={currentPage}
                    onPageChange={handlePageChange}
                    // siblingCount={1} // Optional, defaults to 1
                    className="my-custom-pagination-styles" // Optional custom styling
                  />
                </div>
            </div>
      )}

      {deleteModalOpen && (
        <Modal
          isOpen={deleteModalOpen}
          onClose={handleCancelDelete}
          className="max-w-md p-6"
        >
          <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90">
            Confirm Deletion
          </h3>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            Are you sure you want to delete this image? This action cannot be undone.
          </p>
          <div className="flex justify-end gap-4 mt-6">
            <Button size="md" variant="secondary" onClick={handleCancelDelete}>
              Cancel
            </Button>
            <Button
              size="md"
              variant="destructive"
              className="relative flex items-center justify-center w-full h-12 overflow-hidden"
              onMouseDown={() => {
                const interval = setInterval(() => {
                  setProgress((prev) => {
                    if (prev >= 100) {
                      clearInterval(interval);
                      handleConfirmDelete();
                      return 0;
                    }
                    return prev + 10;
                  });
                }, 300);

                intervalId.current = interval;
              }}
              onMouseUp={() => {
                if (intervalId.current) {
                  clearInterval(intervalId.current);
                  intervalId.current = null;
                }
                setProgress(0);
              }}
              onMouseLeave={() => {
                if (intervalId.current) {
                  clearInterval(intervalId.current);
                  intervalId.current = null;
                }
                setProgress(0);
              }}
            >
              <span className="z-10">Hold to Confirm</span>
              <div className="absolute bottom-0 left-0 w-full h-2">
                <ProgressBar progress={progress} className="h-full" />
              </div>
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}