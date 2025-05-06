// src/hooks/api/images/useImageQuery.ts

import { imagesApi } from "@/services/cloud-resources/images";
import { VMImage } from "@/types";
import { QueryKey, useQuery, UseQueryResult } from "@tanstack/react-query";


function useImageQuery(id:number): UseQueryResult<VMImage,Error>;
function useImageQuery(): UseQueryResult<VMImage[], Error>;


function useImageQuery(id?:number):UseQueryResult<VMImage | VMImage[], Error>{

    const queryKey: QueryKey = id ? ['image', id] : ['images']

    const queryFn = async (): Promise<VMImage | VMImage[]> => id ? imagesApi.getById(id) : imagesApi.getAll();

    const queryResult = useQuery({
        queryKey: queryKey,
        queryFn: queryFn,
        enabled: id ? !!id : true,
    })

    return queryResult;

}

export { useImageQuery };