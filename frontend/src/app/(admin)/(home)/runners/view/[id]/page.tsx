"use client";
import { useParams } from "next/navigation";
import RunnerView from "@/components/runner/RunnerView";
import Breadcrumb from "@/components/ui/breadcrumb/Breadcrumb";
import { useRunnerQuery } from "@/hooks/api/runners/useRunnersData";

export default function ViewRunnerPage() {
  const params = useParams();
  const runnerId = parseInt(params.id as string, 10); // Parse runnerId directly from the URL

  // Fetch the runner data using the runnerId
  const { data: runner, isLoading, error } = useRunnerQuery(runnerId);

  // Define breadcrumb items
  const breadcrumbItems = [
    { label: "Home", href: "/" },
    { label: "Runners", href: "/runners" },
    { label: isNaN(runnerId) ? "Runner Details" : `Runner ${runnerId}` },
  ];

  return (
    <div className="space-y-6">
      <div>
        <Breadcrumb items={breadcrumbItems} variant="withIcon" />
      </div>

      <div className="grid grid-cols-12 gap-4 md:gap-6">
        <div className="col-span-12">
          {isLoading ? (
            <div className="text-center text-gray-500">Loading runner details...</div>
          ) : error ? (
            <div className="text-center text-red-500">Failed to load runner details.</div>
          ) : runner ? (
            <RunnerView />
          ) : (
            <div className="text-center text-gray-500">Runner not found.</div>
          )}
        </div>
      </div>
    </div>
  );
}