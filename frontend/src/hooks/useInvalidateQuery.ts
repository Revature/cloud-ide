import { useQueryClient } from '@tanstack/react-query';

/**
 * Custom hook to invalidate multiple React Query keys.
 * @param queryKeys - Array of query keys to invalidate.
 * @returns A function to invalidate the specified queries.
 */
export const useInvalidateQuery = (queryKeys: string[]) => {
  const queryClient = useQueryClient();

  return () => {
    queryKeys.forEach((key) => {
      queryClient.invalidateQueries({ queryKey: [key] });
    });
  };
};