import { useResourceQuery, useResourceByIdQuery } from "@/hooks/useResource";
import { ItemWithResourceID, useResourceForItems } from "@/hooks/useResourceForItems";
import { machinesApi } from "@/services/cloud-resources/machines";
import { Machine } from "@/types/machines";

export function useMachines() {
  // Fetch all machines
  return useResourceQuery<Machine[]>("machines", machinesApi.getAll);
}

export function useMachineById(id: number | undefined) {
  // Fetch a single machine by ID
  return useResourceByIdQuery<Machine>("machines", id, (id) => machinesApi.getById(Number(id)));
}

export function useMachinesForItems<TItem extends ItemWithResourceID<number> & { machineId: number }>(
  items: TItem[]
) {
  // Fetch associated machines for a list of items
  return useResourceForItems<TItem, Machine, number>(
    items,
    "machines",
    (id) => machinesApi.getById(id),
    "machineId" as Extract<keyof TItem, string>
  );
}