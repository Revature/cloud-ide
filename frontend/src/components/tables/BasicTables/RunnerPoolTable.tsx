"use client";
import { useState, useRef } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "../../ui/table";
import Button from "../../ui/button/Button";
import ProxyImage from "@/components/ui/images/ProxyImage";
import { useImageQuery } from "@/hooks/api/images/useImageQuery";

import { useConnectorForItems } from "@/hooks/api/cloudConnectors/useConnectorForItem";
import { Modal } from "@/components/ui/modal";
import ProgressBar from "@/components/ui/progress/ProgressBar";
import { imagesApi } from "@/services/cloud-resources/images";

const updateRunnerPoolSize = async (imageId: number, poolSize: number): Promise<boolean> => {
  try {
    await imagesApi.patchRunnerPoolSize(imageId, poolSize);
    console.log(`Runner pool size updated successfully for image ID ${imageId}.`);
    return true;
  } catch (error) {
    console.error(`Error updating runner pool size for image ID ${imageId}:`, error);
    return false;
  }
};

export default function RunnerPoolTable() {
  const { data: images = [], isLoading, error, refetch } = useImageQuery(); // Add `refetch` to manually refresh data
  const { connectorsById } = useConnectorForItems(images);

  const [editingPoolId, setEditingPoolId] = useState<number | null>(null);
  const [newPoolSize, setNewPoolSize] = useState<number | null>(null); // Allow null to indicate uninitialized
  const [deleteModalOpen, setDeleteModalOpen] = useState<boolean>(false);
  const [deletePoolId, setDeletePoolId] = useState<number | null>(null);
  const [progress, setProgress] = useState<number>(0);
  const intervalId = useRef<NodeJS.Timeout | null>(null);

  /**
   * Handles updating the pool size for a specific runner pool.
   *
   * @param id - The ID of the runner pool to update.
   */
  const handleUpdatePoolSize = async (id: number) => {
    if (editingPoolId === id) {
      if (newPoolSize !== null) {
        const success = await updateRunnerPoolSize(id, newPoolSize);
        if (success) {
          console.log(`Runner pool size updated successfully for image ID ${id}.`);
          await refetch(); // Refresh the data after a successful update
        } else {
          console.log(`Failed to update runner pool size for image ID ${id}.`);
        }
      }
      setEditingPoolId(null);
      setNewPoolSize(null); // Reset the pool size
    } else {
      setEditingPoolId(id);
      const currentPoolSize = images.find((image) => image.id === id)!.runnerPoolSize;
      console.log(`Current pool size for ${id}: ${currentPoolSize}`);
      setNewPoolSize(currentPoolSize); 
    }
  };

  /**
   * Opens the delete confirmation modal for a specific runner pool.
   *
   * @param id - The ID of the runner pool to delete.
   */
  const handleOpenDeleteModal = (id: number) => {
    setDeletePoolId(id);
    setDeleteModalOpen(true);
  };

  /**
   * Handles confirming the deletion of a runner pool.
   */
  const handleConfirmDelete = async () => {
    if (deletePoolId !== null) {
      const success = await updateRunnerPoolSize(deletePoolId, 0);
      if (success) {
        console.log(`Runner pool deleted successfully for image ID ${deletePoolId}.`);
        await refetch(); // Refresh the data after a successful deletion
      } else {
        console.log(`Failed to delete runner pool for image ID ${deletePoolId}.`);
      }
      setDeleteModalOpen(false);
      setDeletePoolId(null);
      setProgress(0);
    }
  };

  /**
   * Handles canceling the deletion of a runner pool.
   */
  const handleCancelDelete = () => {
    setDeleteModalOpen(false);
    setDeletePoolId(null);
    setProgress(0);
  };

  if (isLoading) {
    return <div>Loading runner pools...</div>;
  }

  if (error) {
    return <div>Error loading runner pools: {error instanceof Error ? error.message : "Unknown error"}</div>;
  }

  return (
    <div className="rounded-2xl border border-gray-200 bg-white pt-4 dark:border-white/[0.05] dark:bg-white/[0.03]">
      <div className="flex flex-col gap-2 px-5 mb-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90">
            Runner Pools
          </h3>
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
                  Image Name
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
                  Runner Pool Size
                </TableCell>
                <TableCell
                  isHeader
                  className="px-4 py-3 font-normal text-gray-500 text-start text-theme-sm dark:text-gray-400 w-[150px]"
                >
                  Actions
                </TableCell>
              </TableRow>
            </TableHeader>
            <TableBody className="divide-y divide-gray-100 dark:divide-white/[0.05]">
              {images.map((image) => (
                <TableRow key={image.id}>
                  <TableCell className="px-4 py-4">
                    <span className="block font-medium text-gray-700 text-theme-sm dark:text-gray-400">
                      {image.name}
                    </span>
                  </TableCell>
                  <TableCell className="px-4 py-4">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 relative flex-shrink-0">
                        <ProxyImage
                          src={connectorsById[image.cloudConnectorId]?.image || "/images/brand/default-logo.svg"}
                          alt={connectorsById[image.cloudConnectorId]?.name || "Unknown"}
                          width={32}
                          height={32}
                          className="w-full h-full object-contain"
                        />
                      </div>
                      <span className="text-gray-700 text-theme-sm dark:text-gray-400">
                        {connectorsById[image.cloudConnectorId]?.name || "Unknown"}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="px-4 py-4">
                    {editingPoolId === image.id ? (
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
                        {image.runnerPoolSize}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="px-4 py-4 flex gap-2">
                    {editingPoolId === image.id ? (
                      <Button
                        size="sm"
                        variant="primary"
                        onClick={() => handleUpdatePoolSize(image.id)}
                        className="flex items-center justify-center text-blue-600 bg-blue-50 hover:bg-blue-100 dark:text-blue-400 dark:bg-blue-900/20 dark:hover:bg-blue-900/30"
                        title="Confirm Update"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          fill="none"
                          viewBox="0 0 24 24"
                          strokeWidth="1.5"
                          stroke="currentColor"
                          className="w-5 h-5"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10"
                          />
                        </svg>
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="primary"
                        onClick={() => handleUpdatePoolSize(image.id)}
                        className="flex items-center justify-center text-blue-600 bg-blue-50 hover:bg-blue-100 dark:text-blue-400 dark:bg-blue-900/20 dark:hover:bg-blue-900/30"
                        title="Update Runner Pool Size"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          fill="none"
                          viewBox="0 0 24 24"
                          strokeWidth="1.5"
                          stroke="currentColor"
                          className="w-5 h-5"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10"
                          />
                        </svg>
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => handleOpenDeleteModal(image.id)}
                      className="flex items-center justify-center text-red-600 bg-red-50 hover:bg-red-100 dark:text-red-400 dark:bg-red-900/20 dark:hover:bg-red-900/30"
                      title="Delete Runner Pool"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth="1.5"
                        stroke="currentColor"
                        className="w-5 h-5"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M6.541 3.792C6.541 2.549 7.549 1.542 8.791 1.542h2.417c1.242 0 2.25 1.007 2.25 2.25v.25h2.167h1.041c.414 0 .75.336.75.75s-.336.75-.75.75h-.291v2.705v5v2.962c0 1.242-1.007 2.25-2.25 2.25H5.875c-1.242 0-2.25-1.007-2.25-2.25v-2.962v-5V5.542h-.291c-.414 0-.75-.336-.75-.75s.336-.75.75-.75h1.042h2.166v-.25Zm8.334 9.455v-5V5.542h-1.417h-.75H7.291h-.75H5.125v2.705v5v2.962c0 .414.336.75.75.75h8.25c.414 0 .75-.336.75-.75v-2.962ZM8.041 4.042h3.917v-.25c0-.414-.336-.75-.75-.75H8.791c-.414 0-.75.336-.75.75v.25Zm.292 3.958c.414 0 .75.336.75.75v5c0 .414-.336.75-.75.75s-.75-.336-.75-.75v-5c0-.414.336-.75.75-.75Zm4.084.75c0-.414-.336-.75-.75-.75s-.75.336-.75.75v5c0 .414.336.75.75.75s.75-.336.75-.75v-5Z"
                        />
                      </svg>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

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
            Are you sure you want to delete the available runner pool?
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
