"use client";
import { useState, useMemo, useRef } from "react";
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

/**
 * Represents a runner pool item.
 *
 * @property id - The unique identifier for the runner pool.
 * @property name - The name of the image.
 * @property cloudProvider - The associated cloud provider.
 * @property poolSize - The current size of the runner pool.
 */
interface RunnerPoolItem {
  id: number;
  name: string;
  cloudProvider: {
    name: string;
    image: string;
  };
  poolSize: number;
}

const updateRunnerPoolSize = async (imageId: number, poolSize: number): Promise<boolean> => {
  try {
    const response = await fetch(`http://localhost:8020/api/v1/images/${imageId}/runner_pool`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ runner_pool_size: poolSize }),
    });

    if (!response.ok) {
      console.error(`Failed to update runner pool size for image ID ${imageId}. HTTP status: ${response.status}`);
      return false;
    }

    const responseData = await response.json();
    console.log("Response data:", responseData);
    return true;
  } catch (error) {
    console.error("Error updating runner pool size:", error);
    return false;
  }
};

export default function RunnerPoolTable() {
  const { data: initialImages = [], isLoading, error } = useImageQuery();
  const { connectorsById } = useConnectorForItems(initialImages);

  const [images, setImages] = useState(initialImages); // Local state for images
  const [editingPoolId, setEditingPoolId] = useState<number | null>(null);
  const [newPoolSize, setNewPoolSize] = useState<number>(1);
  const [deleteModalOpen, setDeleteModalOpen] = useState<boolean>(false);
  const [deletePoolId, setDeletePoolId] = useState<number | null>(null);
  const [progress, setProgress] = useState<number>(0);
  const intervalId = useRef<NodeJS.Timeout | null>(null);

  // Transform the image data into runner pool items
  const runnerPools: RunnerPoolItem[] = useMemo(() => {
    return images.map((image) => ({
      id: image.id,
      name: image.name,
      cloudProvider: {
        name: connectorsById[image.cloudConnectorId]?.name || "Unknown",
        image: connectorsById[image.cloudConnectorId]?.image || "/images/brand/default-logo.svg",
      },
      poolSize: image.runnerPoolSize || 0,
    }));
  }, [images, connectorsById]);

  /**
   * Handles updating the pool size for a specific runner pool.
   *
   * @param id - The ID of the runner pool to update.
   */
  const handleUpdatePoolSize = async (id: number) => {
    if (editingPoolId === id) {
      const success = await updateRunnerPoolSize(id, newPoolSize);
      if (success) {
        console.log(`Runner pool size updated successfully for image ID ${id}.`);
        // Update the local state for the images array
        setImages((prevImages) =>
          prevImages.map((image) =>
            image.id === id ? { ...image, runnerPoolSize: newPoolSize } : image
          )
        );
      } else {
        console.log(`Failed to update runner pool size for image ID ${id}.`);
      }
      setEditingPoolId(null);
    } else {
      setEditingPoolId(id);
      setNewPoolSize(runnerPools.find((pool) => pool.id === id)?.poolSize || 1);
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
        // Update the local state for the images array
        setImages((prevImages) =>
          prevImages.map((image) =>
            image.id === deletePoolId ? { ...image, runnerPoolSize: 0 } : image
          )
        );
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
              {runnerPools.map((pool) => (
                <TableRow key={pool.id}>
                  <TableCell className="px-4 py-4">
                    <span className="block font-medium text-gray-700 text-theme-sm dark:text-gray-400">
                      {pool.name}
                    </span>
                  </TableCell>
                  <TableCell className="px-4 py-4">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 relative flex-shrink-0">
                        <ProxyImage
                          src={pool.cloudProvider.image}
                          alt={pool.cloudProvider.name}
                          width={32}
                          height={32}
                          className="w-full h-full object-contain"
                        />
                      </div>
                      <span className="text-gray-700 text-theme-sm dark:text-gray-400">
                        {pool.cloudProvider.name}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="px-4 py-4">
                    {editingPoolId === pool.id ? (
                      <input
                        type="number"
                        min={1}
                        max={10}
                        value={newPoolSize}
                        onChange={(e) => setNewPoolSize(Number(e.target.value))}
                        className="w-16 border border-gray-300 rounded-md text-center dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                      />
                    ) : (
                      <span className="text-gray-700 text-theme-sm dark:text-gray-400">
                        {pool.poolSize}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="px-4 py-4 flex gap-2">
                    <Button
                      size="sm"
                      variant="primary"
                      onClick={() => handleUpdatePoolSize(pool.id)}
                    >
                      {editingPoolId === pool.id ? "Confirm" : "Update"}
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => handleOpenDeleteModal(pool.id)}
                    >
                      Delete
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
