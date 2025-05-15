import { useResourceQuery, useResourceByIdQuery, useResourceDelete, useResourceToggle, useResourceCreate } from "@/hooks/useResource";
import { ItemWithResourceID, useResourceForItems } from "@/hooks/useResourceForItems";
import { cloudConnectorsApi } from "@/services/cloud-resources/cloudConnectors";
import { CloudConnector, CloudConnectorRequest } from "@/types/cloudConnectors";

export function useCloudConnectors() {
  // Fetch all cloud connectors
  return useResourceQuery<CloudConnector[]>("cloud-connectors", cloudConnectorsApi.getAll);
}

export function useCloudConnectorById(id: number | undefined) {
  // Fetch a single cloud connector by ID
  return useResourceByIdQuery<CloudConnector>("cloud-connectors", id, (id) => cloudConnectorsApi.getById(Number(id)));
}

export function useCreateCloudConnector() {
    // Create a new cloud connector
    return useResourceCreate<CloudConnector, CloudConnectorRequest>(
        "cloud-connectors",
        (data) => cloudConnectorsApi.create(data)
    );
    }


export function useDeleteCloudConnector() {
  // Delete a cloud connector
  return useResourceDelete<void>("cloud-connectors", (id) => cloudConnectorsApi.delete(Number(id)));
}

export function useToggleCloudConnectorStatus() {
  // Toggle a cloud connector's status
  return useResourceToggle<CloudConnector>(
    "cloud-connectors",
    ({ id, active }) => cloudConnectorsApi.toggle(Number(id), { is_active: active })
  );
}

export function useCloudConnectorsForItems<TItem extends ItemWithResourceID<number> & { cloudConnectorId: number }>(
  items: TItem[]
) {
  // Fetch associated cloud connectors for a list of items
  return useResourceForItems<TItem, CloudConnector, number>(
    items,
    "cloud-connectors",
    (id) => cloudConnectorsApi.getById(id),
    "cloudConnectorId" as Extract<keyof TItem, string>
  );
}