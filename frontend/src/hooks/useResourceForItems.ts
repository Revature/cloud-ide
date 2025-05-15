import { useQueries, UseQueryResult } from "@tanstack/react-query";

// Ensure TResource has an `id` property of type ResourceIDType
export type ItemWithResourceID<ResourceIDType> = { resourceId?: ResourceIDType };
type ResourceWithID<ResourceIDType> = { id: ResourceIDType };

interface UseResourceForItemsResult<TResource, ResourceIDType extends string | number | symbol> {
  resourcesById: Record<ResourceIDType, TResource>;
  isLoading: boolean;
  isError: boolean;
  isPending: boolean;
  results: UseQueryResult<TResource, Error>[];
}

export function useResourceForItems<
  TItem extends ItemWithResourceID<ResourceIDType>,
  TResource extends ResourceWithID<ResourceIDType>,
  ResourceIDType extends string | number | symbol = number
>(
  items: TItem[],
  resourceName: string,
  fetchFn: (id: ResourceIDType) => Promise<TResource>,
  resourceIdKey: Extract<keyof TItem, string> // Ensure resourceIdKey is a valid key of TItem
): UseResourceForItemsResult<TResource, ResourceIDType> {
  // Prepare queries
  const queries = (items ?? [])
    .map((item) => item[resourceIdKey] as ResourceIDType)
    .filter((id): id is ResourceIDType => !!id)
    .map((resourceId) => ({
      queryKey: [resourceName, resourceId],
      queryFn: async (): Promise<TResource> => fetchFn(resourceId),
      enabled: true,
    }));

  // Deduplicate queries by resource ID
  const uniqueQueries = Array.from(
    new Map(queries.map((q) => [q.queryKey[1] as ResourceIDType, q])).values()
  );

  // Always call useQueries, even if there are no queries
  const results = useQueries({ queries: uniqueQueries.length > 0 ? uniqueQueries : [] });

  // Aggregate results
  const resourcesById = {} as Record<ResourceIDType, TResource>;
  const isLoading = results.some((result) => result.isLoading);
  const isError = results.some((result) => result.isError);
  const isPending = results.some((result) => result.isFetching);

  results.forEach((result) => {
    if (result.status === "success" && result.data) {
      resourcesById[result.data.id] = result.data; // TypeScript now knows `id` exists
    }
  });

  return { resourcesById, isLoading, isError, isPending, results };
}