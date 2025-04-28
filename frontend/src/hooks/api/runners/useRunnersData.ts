// src/hooks/api/images/useImageQuery.ts

import { runnersApi } from "@/services/cloud-resources/runners";
import { Runner } from "@/types/runner";
import { QueryKey, useQuery, UseQueryResult } from "@tanstack/react-query";


function useRunnerQuery(id:number): UseQueryResult<Runner,Error>;
function useRunnerQuery(): UseQueryResult<Runner[], Error>;


function useRunnerQuery(id?:number):UseQueryResult<Runner | Runner[], Error>{

    const queryKey: QueryKey = id ? ['runner', id] : ['runners']

    const queryFn = async (): Promise<Runner | Runner[]> => id ? runnersApi.getById(id) : runnersApi.getAll();

    const queryResult = useQuery({
        queryKey: queryKey,
        queryFn: queryFn,
        enabled: id ? !!id : true,
        refetchInterval: 10000,
    })

    return queryResult;

}

export { useRunnerQuery };