import { useResourceQuery, useResourceByIdQuery, useResourceDelete, useResourceAction } from "@/hooks/useResource";
import { ItemWithResourceID, useResourceForItems } from "@/hooks/useResourceForItems";
import { runnersApi } from "@/services/cloud-resources/runners";
import { Runner } from "@/types/runner";

export function useRunners() {
  // Fetch all runners
  return useResourceQuery<Runner[]>("runners", runnersApi.getAll, {refetchInterval: 20000});
}

export function useRunnerById(id: number | undefined) {
  // Fetch a single runner by ID
  return useResourceByIdQuery<Runner>("runners", id, (id) => runnersApi.getById(Number(id)));
}

export function useTerminateRunner() {
  // Delete a runner
  return useResourceDelete<void>("runners", (id) => runnersApi.terminate(Number(id)));
}

export function useStartRunner() {
    // Start a runner
    return useResourceAction("runners", ({ id }: { id: number}) => runnersApi.changeState(Number(id), "start"));
  }
  
  export function useStopRunner() {
    // Stop a runner
    return useResourceAction("runners", ({ id }: { id: number}) => runnersApi.changeState(Number(id), "stop"));
  }

export function useRunnersForItems<TItem extends ItemWithResourceID<number> & { runnerId: number }>(
  items: TItem[]
) {
  // Fetch associated runners for a list of items
  return useResourceForItems<TItem, Runner, number>(
    items,
    "runners",
    (id) => runnersApi.getById(id),
    "runnerId" as Extract<keyof TItem, string>
  );
}