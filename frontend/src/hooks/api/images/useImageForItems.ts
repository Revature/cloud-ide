import { imagesApi } from "@/services/cloud-resources/images";
import { VMImage } from "@/types";
import { useQueries, UseQueryResult } from "@tanstack/react-query";


type ItemWithImageID = {imageId?: number};

interface UseImagesForItemsResult {
    imagesById: Record<number, VMImage>;
    isLoading: boolean;
    isError: boolean;
    isPending: boolean;
    results: UseQueryResult<VMImage, Error>[];
}

export function useImageForItems<TItem extends ItemWithImageID>(items: TItem[]): UseImagesForItemsResult{
    const queries = (items ?? [])
            .map(item => item.imageId)
            .filter((id): id is number => !!id)
            .map(imageId => ({
                queryKey: ['image', imageId],
                queryFn: async (): Promise<VMImage> => imagesApi.getById(imageId),
                enabled: true,
            }));
    
    const uniqueQueries = Array.from(new Map(queries.map(q => [q.queryKey[1], q])).values());

    const results = useQueries({queries: uniqueQueries});

    const imagesById: Record<number, VMImage> = {};
    let isLoading = false, isError = false, isPending = false;
    results.forEach(result => {
        if(result.status === 'success' && result.data){
            imagesById[result.data.id] = result.data;
        }
        if (result.isLoading) isLoading = true;
        if (result.isError) isError = true;
        if (result.isPending) isPending = true;
    });

    return {imagesById, isLoading, isError, isPending, results };
}