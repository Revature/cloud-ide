import axios from "axios";

export async function getLatencyToRegion(region: string): Promise<number> {
  const regionalEndpoint = `https://ws-broker-service.${region}.amazonaws.com/ping`;

  const startTime = performance.now();

  try {
    await axios.get(regionalEndpoint);
    const endTime = performance.now();
    return Math.round(endTime - startTime); // Return latency in milliseconds
  } catch (error) {
    console.error("Error fetching latency:", error);
    const endTime = performance.now();
    return Math.round(endTime - startTime); // Return latency even if the request fails
  }
}