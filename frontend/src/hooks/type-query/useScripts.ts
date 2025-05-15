import { useResourceByIdQuery, useResourceUpdate, useResourceDelete, useResourceCreate, useResourceQueryByResourceId } from "@/hooks/useResource";
import { ItemWithResourceID, useResourceForItems } from "@/hooks/useResourceForItems";
import { scriptsApi } from "@/services/cloud-resources/scripts";
import { Script, ScriptRequest } from "@/types/scripts";
import { useQueryClient } from "@tanstack/react-query";


export function useScriptsByImageId(imageId: number) {
        // Fetch scripts associated with a specific image ID
        return useResourceQueryByResourceId<Script[]>(
          "scripts",
          imageId,
          () => scriptsApi.getAllByImageId(Number(imageId)),
        );
      }

export function useScriptById(id: number) {
  // Fetch a single script by ID
  return useResourceByIdQuery<Script>("scripts", id, (id) => scriptsApi.getById(Number(id)));
}

export function useCreateScript(imageId: number) {
    const queryClient = useQueryClient();
  // Create a new script
  return useResourceCreate<Script, ScriptRequest>(
    "scripts",
    (data) => scriptsApi.create(data),
    {
        onSuccess: () => {
          // Invalidate the scripts query to refresh the list after deletion
          queryClient.invalidateQueries({ queryKey: ["scripts", "byResourceId", imageId] });
        },
      }
  );
}

export function useUpdateScript(imageId: number) {
    const queryClient = useQueryClient();
  // Update a script
  return useResourceUpdate<Script, { id: number; data: Partial<ScriptRequest> }>(
    "scripts",
    ({ id, data }) => scriptsApi.update(id, data),
    {
        onSuccess: (_, variables) => {
          // Invalidate the scripts query to refresh the list after deletion
          queryClient.invalidateQueries({ queryKey: ["scripts",  variables.id] });
          queryClient.invalidateQueries({ queryKey: ["scripts", "byResourceId", imageId] });
        },
      }
  );
}

export function useDeleteScript(imageId: number) {
    const queryClient = useQueryClient();
  // Delete a script
  return useResourceDelete<void>("scripts", (id) => scriptsApi.delete(Number(id)),{
    onSuccess: () => {
      // Invalidate the scripts query to refresh the list after deletion
      queryClient.invalidateQueries({ queryKey: ["scripts", "byResourceId", imageId] });
    },
  });
}

export function useScriptsForItems<TItem extends ItemWithResourceID<number> & { scriptId?: number }>(
  items: TItem[]
) {
  // Fetch associated scripts for a list of items
  return useResourceForItems<TItem, Script, number>(
    items,
    "scripts",
    (id) => scriptsApi.getById(id),
    "scriptId" as Extract<keyof TItem, string>
  );
}