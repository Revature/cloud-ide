import { machinesApi } from "@/services/cloud-resources/machines";
import { Machine } from "@/types";
import { useQueries, UseQueryResult } from "@tanstack/react-query";


type ItemWithMachineID = {machineId?: number};

interface UseMachinesForItemsResult {
    machinesById: Record<number, Machine>;
    isLoading: boolean;
    isError: boolean;
    isPending: boolean;
    results: UseQueryResult<Machine, Error>[];
}

export function useMachineForItems<TItem extends ItemWithMachineID>(items: TItem[]): UseMachinesForItemsResult{
    const queries = (items ?? [])
            .map(item => item.machineId)
            .filter((id): id is number => !!id)
            .map(machineId => ({
                queryKey: ['machine', machineId],
                queryFn: async (): Promise<Machine> => machinesApi.getById(machineId),
                enabled: true,
            }));
    
    const uniqueQueries = Array.from(new Map(queries.map(q => [q.queryKey[1], q])).values());

    const results = useQueries({queries: uniqueQueries});

    const machinesById: Record<number, Machine> = {};
    let isLoading = false, isError = false, isPending = false;
    results.forEach(result => {
        if(result.status === 'success' && result.data){
            machinesById[result.data.id] = result.data;
        }
        if (result.isLoading) isLoading = true;
        if (result.isError) isError = true;
        if (result.isPending) isPending = true;
    });

    return {machinesById, isLoading, isError, isPending, results };
}