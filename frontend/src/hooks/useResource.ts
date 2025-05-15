// src/hooks/useResource.ts
import { useQuery, useMutation, useQueryClient, UseQueryOptions, UseMutationOptions } from '@tanstack/react-query';

/**
 * Generic hook for fetching resources with React Query
 * @param resourceName The name of the resource for query key identification
 * @param fetchFn The function to fetch the resource
 * @param options Additional React Query options
 */
export function useResourceQuery<TData, TError = unknown>(
  resourceName: string,
  fetchFn: () => Promise<TData>,
  options?: Omit<UseQueryOptions<TData, TError, TData>, 'queryKey' | 'queryFn'>
) {
  return useQuery<TData, TError>({
    queryKey: [resourceName],
    queryFn: fetchFn,
    ...options,
  });
}

/**
 * Generic hook for fetching a single resource by ID
 * @param resourceName The name of the resource for query key identification
 * @param id The ID of the resource to fetch
 * @param fetchFn The function to fetch the resource by ID
 * @param options Additional React Query options
 */
export function useResourceByIdQuery<TData, TError = unknown>(
  resourceName: string,
  id: string | number | undefined,
  fetchFn: (id: string | number) => Promise<TData>,
  options?: Omit<UseQueryOptions<TData, TError, TData>, 'queryKey' | 'queryFn' | 'enabled'>
) {
  return useQuery<TData, TError>({
    queryKey: [resourceName, id],
    queryFn: () => id ? fetchFn(id) : Promise.reject('No ID provided'),
    enabled: !!id,
    ...options,
  });
}

/**
 * Generic hook for creating resources
 * @param resourceName The name of the resource for query key invalidation
 * @param createFn The function to create the resource
 * @param options Additional React Query mutation options
 */
export function useResourceCreate<TData, TVariables, TError = unknown>(
  resourceName: string,
  createFn: (data: TVariables) => Promise<TData>,
  options?: Omit<UseMutationOptions<TData, TError, TVariables>, 'mutationFn'>
) {
  const queryClient = useQueryClient();
  
  return useMutation<TData, TError, TVariables>({
    mutationFn: createFn,
    onSuccess: (data, variables, context) => {
      // Invalidate the resource list query
      queryClient.invalidateQueries({ queryKey: [resourceName] });
      
      // Call the original onSuccess if provided
      if (options?.onSuccess) {
        options.onSuccess(data, variables, context);
      }
    },
    ...options,
  });
}

/**
 * Generic hook for updating resources
 * @param resourceName The name of the resource for query key invalidation
 * @param updateFn The function to update the resource
 * @param options Additional React Query mutation options
 */
export function useResourceUpdate<TData, TVariables extends { id: string | number }, TError = unknown>(
  resourceName: string,
  updateFn: (data: TVariables) => Promise<TData>,
  options?: Omit<UseMutationOptions<TData, TError, TVariables>, 'mutationFn'>
) {
  const queryClient = useQueryClient();
  
  return useMutation<TData, TError, TVariables>({
    mutationFn: updateFn,
    onSuccess: (data, variables, context) => {
      // Invalidate both the list and the individual resource query
      queryClient.invalidateQueries({ queryKey: [resourceName] });
      queryClient.invalidateQueries({ queryKey: [resourceName, variables.id] });
      
      // Call the original onSuccess if provided
      if (options?.onSuccess) {
        options.onSuccess(data, variables, context);
      }
    },
    ...options,
  });
}

/**
 * Generic hook for deleting resources
 * @param resourceName The name of the resource for query key invalidation
 * @param deleteFn The function to delete the resource
 * @param options Additional React Query mutation options
 */
export function useResourceDelete<TData, TError = unknown>(
  resourceName: string,
  deleteFn: (id: string | number) => Promise<TData>,
  options?: Omit<UseMutationOptions<TData, TError, string | number>, 'mutationFn'>
) {
  const queryClient = useQueryClient();
  
  return useMutation<TData, TError, string | number>({
    mutationFn: deleteFn,
    onSuccess: (data, id, context) => {
      // Invalidate the resource list query
      queryClient.invalidateQueries({ queryKey: [resourceName] });
      
      // Call the original onSuccess if provided
      if (options?.onSuccess) {
        options.onSuccess(data, id, context);
      }
    },
    ...options,
  });
}

/**
 * Generic hook for toggling resource status
 * @param resourceName The name of the resource for query key invalidation
 * @param toggleFn The function to toggle the resource status
 * @param options Additional React Query mutation options
 */
export function useResourceToggle<TData, TError = unknown>(
  resourceName: string,
  toggleFn: (params: { id: string | number; active: boolean }) => Promise<TData>,
  options?: Omit<UseMutationOptions<TData, TError, { id: string | number; active: boolean }>, 'mutationFn'>
) {
  const queryClient = useQueryClient();
  
  return useMutation<TData, TError, { id: string | number; active: boolean }>({
    mutationFn: toggleFn,
    onSuccess: (data, variables, context) => {
      // Invalidate both the list and the individual resource query
      queryClient.invalidateQueries({ queryKey: [resourceName] });
      queryClient.invalidateQueries({ queryKey: [resourceName, variables.id] });
      
      // Call the original onSuccess if provided
      if (options?.onSuccess) {
        options.onSuccess(data, variables, context);
      }
    },
    ...options,
  });
}

/**
 * Generic hook for performing actions on resources
 * @param resourceName The name of the resource for query key invalidation
 * @param actionFn The function to perform the action on the resource
 * @param options Additional React Query mutation options
 */
export function useResourceAction<TData, TVariables extends { id?: string | number }, TError = unknown>(
  resourceName: string,
  actionFn: (variables: TVariables) => Promise<TData>,
  options?: Omit<UseMutationOptions<TData, TError, TVariables>, "mutationFn">
) {
  const queryClient = useQueryClient();

  return useMutation<TData, TError, TVariables>({
    mutationFn: actionFn,
    onSuccess: (data, variables, context) => {
      // Invalidate the resource list query
      queryClient.invalidateQueries({ queryKey: [resourceName] });

      // Optionally invalidate individual resource queries if applicable
      if (variables.id) {
        queryClient.invalidateQueries({ queryKey: [resourceName, variables.id] });
      }

      // Call the original onSuccess if provided
      if (options?.onSuccess) {
        options.onSuccess(data, variables, context);
      }
    },
    ...options,
  });
}

/**
 * Generic hook for fetching resources by a related resource's ID
 * @param resourceName The name of the resource for query key identification
 * @param relatedId The ID of the related resource
 * @param fetchFn The function to fetch the resources by the related ID
 * @param options Additional React Query options
 */
export function useResourceQueryByResourceId<TData, TError = unknown>(
  resourceName: string,
  relatedId: string | number | undefined,
  fetchFn: (relatedId: string | number) => Promise<TData>,
  options?: Omit<UseQueryOptions<TData, TError, TData>, "queryKey" | "queryFn" | "enabled">
) {
  return useQuery<TData, TError>({
    queryKey: [resourceName, "byResourceId", relatedId],
    queryFn: () => (relatedId ? fetchFn(relatedId) : Promise.reject("No related ID provided")),
    enabled: !!relatedId,
    ...options,
  });
}