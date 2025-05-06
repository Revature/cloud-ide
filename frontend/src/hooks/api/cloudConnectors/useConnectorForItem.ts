import { cloudConnectorsApi } from "@/services";
import { CloudConnector } from "@/types";
import { useQueries, UseQueryResult } from "@tanstack/react-query";


type ItemWithConnectorID = {cloudConnectorId?: number};

interface UseConnectorsForItemsResult {
    connectorsById: Record<number, CloudConnector>;
    isLoading: boolean;
    isError: boolean;
    isPending: boolean;
    results: UseQueryResult<CloudConnector, Error>[];
}

export function useConnectorForItems<TItem extends ItemWithConnectorID>(items: TItem[]): UseConnectorsForItemsResult{
    const queries = (items ?? [])
            .map(item => item.cloudConnectorId)
            .filter((id): id is number => !!id)
            .map(connectorId => ({
                queryKey: ['cloud-connector', connectorId],
                queryFn: async (): Promise<CloudConnector> => cloudConnectorsApi.getById(connectorId),
                enabled: true,
            }));
    
    const uniqueQueries = Array.from(new Map(queries.map(q => [q.queryKey[1], q])).values());

    const results = useQueries({queries: uniqueQueries});

    const connectorsById: Record<number, CloudConnector> = {};
    let isLoading = false, isError = false, isPending = false;
    results.forEach(result => {
        if(result.status === 'success' && result.data){
            connectorsById[result.data.id] = result.data;
        }
        if (result.isLoading) isLoading = true;
        if (result.isError) isError = true;
        if (result.isPending) isPending = true;
    });

    return {connectorsById, isLoading, isError, isPending, results };
}