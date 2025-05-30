import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

interface PrometheusMetric {
  metric: { [key: string]: string };
  values?: [number, string][];
  value?: [number, string];
}

interface PrometheusResponse {
  status: string;
  data: {
    resultType: string;
    result: PrometheusMetric[];
  };
}

interface UseRunnerMetricsOptions {
  jobId: string; // runner.url
  step?: number; // seconds
}

// Helper to build Prometheus query endpoint
function buildPrometheusEndpoint(
  metric: string,
  jobId: string,
  step: number
): string {
  const now = new Date();
  const end = now.toISOString();
  const start = new Date(now.getTime() - 30 * 1000).toISOString();
  const endpoint = `http://34.223.156.189:9090/api/v1/query_range?query=${metric}{job="${jobId}"}&end=${end}&start=${start}&step=${step}`;
  console.log("[Prometheus] Endpoint:", endpoint);
  return endpoint;
}

// Helper to fetch and parse a single value from Prometheus
async function fetchPrometheusValue(
  metric: string,
  jobId: string,
  step: number
): Promise<number> {
  const endpoint = buildPrometheusEndpoint(metric, jobId, step);
  console.log(`[Prometheus] Fetching value for ${metric} from:`, endpoint);
  const res = await fetch(endpoint);
  if (!res.ok) throw new Error(`Failed to fetch ${metric}`);
  const data: PrometheusResponse = await res.json();
  console.log(`[Prometheus] Response for ${metric}:`, data);
  // Get the latest value from the first result (if present)
  const value = data.data.result[0]?.values?.[0]?.[1]
    ? Number(data.data.result[0].values[0][1])
    : 0;
  console.log(`[Prometheus] Parsed value for ${metric}:`, value);
  return value;
}

async function fetchCpuPercentage(jobId: string, step: number): Promise<number> {
  const endpoint = buildPrometheusEndpoint("node_cpu_seconds_total", jobId, step);
  console.log("[CPU] Fetching CPU data from:", endpoint);
  const res = await fetch(`http://34.223.156.189:9090/api/v1/query?query=100 * (1 - (sum by (job) (rate(node_cpu_seconds_total{mode="idle",job="${jobId}"}[5m]))) / sum by (job) (rate(node_cpu_seconds_total{job="${jobId}"}[5m])))
 `);
  if (!res.ok) throw new Error("Failed to fetch CPU data");
  const data: PrometheusResponse = await res.json();
  console.log("[CPU] Raw response:", data);


  const percent = Number(data.data.result[0]?.value?.[1]) ?? 0;

  console.log(`[CPU] Calculated CPU percent:`, percent);
  return percent;
}

async function fetchMemoryPercentage(jobId: string, step: number): Promise<number> {
  console.log(`[Memory] Fetching memory data for jobId: ${jobId}, step: ${step}`);
  const [availableBytes, totalBytes] = await Promise.all([
    fetchPrometheusValue("node_memory_MemAvailable_bytes", jobId, step),
    fetchPrometheusValue("node_memory_MemTotal_bytes", jobId, step),
  ]);
  console.log(`[Memory] availableBytes: ${availableBytes}, totalBytes: ${totalBytes}`);
  if (totalBytes === 0) return 0;
  const percent = 100 * (1 - Number((availableBytes / totalBytes).toFixed(5)));
  console.log(`[Memory] Calculated memory percent:`, percent);
  return percent;
}

export function useRunnerMetrics({
  jobId,
  step = 30,
}: UseRunnerMetricsOptions) {
  const queryKey = useMemo(() => ["runnerMetrics", jobId, step], [jobId, step]);

  const {
    data,
    isLoading: loading,
    error,
  } = useQuery({
    queryKey,
    queryFn: async () => {
      console.log(`[useRunnerMetrics] Fetching metrics for jobId: ${jobId}, step: ${step}`);
      const [cpuPercent, memoryPercent] = await Promise.all([
        fetchCpuPercentage(jobId, step),
        fetchMemoryPercentage(jobId, step),
      ]);
      console.log(`[useRunnerMetrics] Results:`, { cpuPercent, memoryPercent });
      return { cpuPercent, memoryPercent };
    },
    refetchInterval: step * 1000,
    refetchOnWindowFocus: true,
    enabled: !!jobId,
  });

  return {
    cpuPercent: data?.cpuPercent,
    memoryPercent: data?.memoryPercent,
    loading,
    error: error instanceof Error ? error.message : undefined,
  };
}