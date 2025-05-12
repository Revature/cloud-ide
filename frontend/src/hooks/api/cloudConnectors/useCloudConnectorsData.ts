// src/hooks/api/cloudConnectors/useCloudConnectorQuery.ts

import { cloudConnectorsApi } from "@/services";
import { CloudConnector } from "@/types";
import { QueryKey, useQuery, UseQueryResult } from "@tanstack/react-query";


function useCloudConnectorQuery(id:number): UseQueryResult<CloudConnector,Error>;
function useCloudConnectorQuery(): UseQueryResult<CloudConnector[], Error>;


function useCloudConnectorQuery(id?:number):UseQueryResult<CloudConnector | CloudConnector[], Error>{

    const queryKey: QueryKey = id ? ['cloud-connectors', id.toString()] : ['cloud-connectors']

    const queryFn = async (): Promise<CloudConnector | CloudConnector[]> => id ? cloudConnectorsApi.getById(id) : cloudConnectorsApi.getAll();

    const queryResult = useQuery({
        queryKey: queryKey,
        queryFn: queryFn,
        enabled: id ? !!id : true,
    })

    return queryResult;

}

export { useCloudConnectorQuery };