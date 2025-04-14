// import { cloudConnectorsApi } from "@/services";
// import { imagesApi } from "@/services/cloud-resources/images";
// import { machinesApi } from "@/services/cloud-resources/machines";
// import { CloudConnector, Machine, VMImage } from "@/types";
// import { useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
// import { useMemo } from "react";

// export const useImageData = () => {

//     const queryClient = useQueryClient();

//     // Fetch images using React Query
//     const useGetAllImages = () => { 

//         const imagesInCache = queryClient.getQueryData(['images'])

//         return useQuery<VMImage[]>({
//             queryKey: ['images'],
//             queryFn: imagesApi.getAll,
//             enabled: !imagesInCache
//         })
//     };

//     const images:VMImage[] = queryClient.getQueryData<VMImage[]>(['images']) || [];

//       // Extract unique IDs for related resources
//       const uniqueConnectorIds = useMemo(() => 
//         [...new Set(images
//           .map(img => img.cloudConnectorId)
//           .filter((id): id is number => id !== undefined && id !== null)
//         )],
//         [images]
//       );

//       // TODO: Check for why this infomration seems to be missing
//       const uniqueMachineIds = useMemo(() => 
//         [...new Set(images
//           .map(img => img.machineId)
//           .filter((id): id is number => id !== undefined && id !== null)
//         )],
//         [images]
//       );

//       // Fetch all cloud connectors in parallel
//       const connectorQueries = useQueries({
//         queries: uniqueConnectorIds.map(id => ({
//           queryKey: ['cloudConnector', id],
//           queryFn: () => cloudConnectorsApi.getById(id),
//           enabled: id !== undefined && id !== null
//         }))
//       });

//       // Fetch all machines in parallel
//       const machineQueries = useQueries({
//         queries: uniqueMachineIds.map(id => ({
//           queryKey: ['machine', id],
//           queryFn: () => machinesApi.getById(id),
//           enabled: id !== undefined && id !== null
//         }))
//       });

//       // Create lookup maps for faster access
//       const connectorsMap = useMemo(() => {
//         const map: Record<number, CloudConnector> = {};
//         connectorQueries
//           .filter(q => q.data)
//           .forEach(q => { 
//             if (q.data && q.data.id) map[q.data.id] = q.data as CloudConnector; 
//           });
//         return map;
//       }, [connectorQueries]);

//       const machinesMap = useMemo(() => {
//         const map: Record<number, Machine> = {};
//         machineQueries
//           .filter(q => q.data)
//           .forEach(q => { 
//             if (q.data && q.data.id) map[q.data.id] = q.data as Machine; 
//           });
//         return map;
//       }, [machineQueries]);

//       // Join the data
//       const enrichedImages = useMemo(() => 
//         images.map(image => ({
//           ...image,
//           cloudConnector: image.cloudConnectorId && connectorsMap[image.cloudConnectorId] 
//             ? connectorsMap[image.cloudConnectorId] 
//             : undefined,
//           machine: image.machineId && machinesMap[image.machineId] 
//             ? machinesMap[image.machineId] 
//             : undefined
//         })),
//         [images, connectorsMap, machinesMap]
//       );


// }