"use client";
import { useParams } from "next/navigation";
import RunnerView from "@/components/runner/RunnerView";
import Breadcrumb from "@/components/ui/breadcrumb/Breadcrumb";
import { useRunners } from "@/context/RunnersContext";

export default function ViewRunnerPage() {
  const { runners } = useRunners();
  const params = useParams();
  const runnerIndex = parseInt(params.id as string, 10) - 1;
  
  // Get runner ID for the breadcrumb if available
  const runnerId = !isNaN(runnerIndex) && runners[runnerIndex] 
    ? runners[runnerIndex].id 
    : "Runner Details";
    
  const breadcrumbItems = [
    { label: "Home", href: "/" },
    { label: "Runners", href: "/runners" },
    { label: runnerId }
  ];
  
  return (
    <div className="space-y-6">
      <div>
        <Breadcrumb items={breadcrumbItems} variant="withIcon" />
      </div>
      
      <div className="grid grid-cols-12 gap-4 md:gap-6">
        <div className="col-span-12">
          <RunnerView />
        </div>
      </div>
    </div>
  );
}