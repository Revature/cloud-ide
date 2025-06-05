import { useQuery } from "@tanstack/react-query";

export function useLatencyForRegions() {
  const regions = [
    "us-east-1",
    "us-east-2",
    "us-west-1",
    "us-west-2",
    "ap-south-1",
    "ap-southeast-1",
    "ap-southeast-2",
    "ap-northeast-1",
    "ap-northeast-2",
    "ap-northeast-3",
    "ca-central-1",
    "eu-central-1",
    "eu-west-1",
    "eu-west-2",
    "eu-west-3",
    "eu-north-1",
    "sa-east-1",
    "ap-south-2",
  ];

  return useQuery({
    queryKey: ["latency", regions],
    queryFn: async () => {
      // Use Promise.all to fetch latency for all regions concurrently
      const results = await Promise.all(
        regions.map(async (region) => {
          try {
            const latency = await getLatencyToRegion(region);
            return { region, latency };
          } catch (error) {
            console.error(`Error fetching latency for region ${region}:`, error);
            return { region, latency: Infinity }; // Default to Infinity on error
          }
        })
      );

      // Convert the results into a dictionary for easy access
      return results.reduce((acc, { region, latency }) => {
        acc[region] = latency;
        return acc;
      }, {} as Record<string, number>);
    },
    refetchInterval:  5  * 60000, // Refresh every 60 seconds
    staleTime: 5 * 60000, // Cache data for 60 seconds
  });
}

async function getLatencyToRegion(region: string): Promise<number> {
  const regionalEndpoint = `https://ws-broker-service.${region}.amazonaws.com/ping`;

  try {
    await fetch(regionalEndpoint, { method: "GET", cache: "no-store" });
    const startTime = performance.now();

    const response = await fetch(regionalEndpoint, { method: "GET", cache: "no-store" });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const endTime = performance.now();
    return Math.round(endTime - startTime); // Return latency in milliseconds
  } catch (error) {
    console.error(`Failed to fetch latency for region ${region}:`, error);
    return Infinity; // Default to Infinity on error
  }
}