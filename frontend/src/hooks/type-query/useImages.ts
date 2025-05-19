import { useResourceQuery, useResourceByIdQuery, useResourceUpdate, useResourceDelete, useResourceToggle, useResourceCreate } from "@/hooks/useResource";
import { ItemWithResourceID, useResourceForItems } from "@/hooks/useResourceForItems";
import { imagesApi } from "@/services/cloud-resources/images";
import { Image, ImageRequest, ImageUpdateRequest } from "@/types/images";

export function useImages() {
  // Fetch all images
  return useResourceQuery<Image[]>("images", imagesApi.getAll);
}

export function useImageById(id: number | undefined) {
  // Fetch a single image by ID
  return useResourceByIdQuery<Image>("images", id, (id) => imagesApi.getById(Number(id)));
}

export function useDeleteImage() {
  // Delete an image
  return useResourceDelete<void>("images", (id) => imagesApi.delete(Number(id)));
}

export function useCreateImage() {
  // Create a new image
  return useResourceCreate<Image, ImageRequest>(
    "images",
    (data) => imagesApi.create(data)
  );
}

export function useUpdateImage() {
  // Update an image
  return useResourceUpdate<Image, { id: number; data: ImageUpdateRequest }>(
    "images",
    ({ id, data }: { id: number; data: ImageUpdateRequest }) => imagesApi.update(id, data)
  );
}

export function usePatchRunnerPool() {
    // Patch the runner pool size for an image
    return useResourceUpdate(
        "images",
        ({ id, data }: { id: number; data: number }) => imagesApi.patchRunnerPoolSize(id, data)
      );
      
  }

export function useToggleImageStatus() {
  // Toggle an image's status
  return useResourceToggle<Image>(
    "images",
    ({ id, active }) => imagesApi.toggle(Number(id), active)
  );
}

export function useImagesForItems<TItem extends ItemWithResourceID<number> & { imageId: number }>(
  items: TItem[]
) {
  // Fetch associated images for a list of items
  return useResourceForItems<TItem, Image, number>(
    items,
    "images",
    (id) => imagesApi.getById(id),
    "imageId" as Extract<keyof TItem, string>
  );
}