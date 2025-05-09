// src/hooks/api/machines/useImageQuery.ts

import { machinesApi } from "@/services/cloud-resources/machines";
import { Machine } from "@/types";
import { QueryKey, useQuery, UseQueryResult } from "@tanstack/react-query";


function useMachineQuery(id:number): UseQueryResult<Machine,Error>;
function useMachineQuery(): UseQueryResult<Machine[], Error>;


function useMachineQuery(id?:number):UseQueryResult<Machine | Machine[], Error>{

    const queryKey: QueryKey = id ? ['machines', id.toString()] : ['machines']

    const queryFn = async (): Promise<Machine | Machine[]> => id ? machinesApi.getById(id) : machinesApi.getAll();

    const queryResult = useQuery({
        queryKey: queryKey,
        queryFn: queryFn,
        enabled: id ? !!id : true,
    })

    return queryResult;

}

export { useMachineQuery };