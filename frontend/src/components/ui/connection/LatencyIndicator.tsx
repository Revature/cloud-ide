import React from "react";
import { useResourceByIdQuery } from "@/hooks/useResource";
import { getLatencyToRegion } from "@/utils/latencyToRegion";

interface LatencyIndicatorProps {
  region: string; // The region to calculate latency for
}

const LatencyIndicator: React.FC<LatencyIndicatorProps> = ({ region }) => {
  // Use React Query to fetch and cache latency data for the region
  const { data: latency, isLoading, isError } = useResourceByIdQuery(
    "latency",
    region,
    (id) => getLatencyToRegion(String(id)),
    {
      refetchInterval: 60000, // Refresh every 60 seconds
      staleTime: 60000, // Cache data for 60 seconds
    }
  );

  // Determine the number of bars and color based on latency
  const bars = latency !== undefined ? (latency <= 75 ? 3 : latency <= 150 ? 2 : 1) : 0;
  const colorClass =
    latency !== undefined
      ? latency <= 75
        ? "text-green-500"
        : latency <= 150
        ? "text-orange-500"
        : "text-red-500"
      : "text-gray-400";

  return (
    <div className="relative">
      {isLoading ? (
        <div className="text-gray-400">Loading...</div>
      ) : isError ? (
        <div className="text-red-500">Error</div>
      ) : (
        <div>
            
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth="1.5"
              stroke="currentColor"
              className={`w-6 h-6 ${colorClass}`}
            >
              <span className="text-sm text-gray-500 dark:text-gray-400">{latency}ms</span>
              {/* Left Bar */}
              <rect
                x="3"
                y="12"
                width="4"
                height="9"
                rx="1"
                className={bars >= 1 ? "" : "opacity-20"}
              />
              {/* Middle Bar */}
              <rect
                x="10"
                y={bars >= 2 ? "6" : "20"} // Reduce height for medium/high latency
                width="4"
                height={bars >= 2 ? "15" : "1"} // Tiny rectangle for high latency
                rx="1"
                className={bars >= 2 ? "" : "opacity-20"}
              />
              {/* Right Bar */}
              <rect
                x="17"
                y={bars >= 3 ? "3" : "20"} // Reduce height for medium/high latency
                width="4"
                height={bars >= 3 ? "18" : "1"} // Tiny rectangle for medium/high latency
                rx="1"
                className={bars >= 3 ? "" : "opacity-20"}
              />
            </svg>
        </div>
      )}
    </div>
  );
};

export default LatencyIndicator;