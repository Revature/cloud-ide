"use client";
import React, { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Button from "@/components/ui/button/Button";
import { Runner, RunnerState } from '@/types/runner';
import { useQuery } from '@tanstack/react-query';

const getStateColor = (state: RunnerState) => {
  switch (state) {
    case "active":
      return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
    case "ready":
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400';
    case "awaiting_client":
      return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400';
    case "starting":
      return 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400';
    case "terminated":
    default:
      return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
  }
};

const getStateLabel = (state: RunnerState) => {
  switch (state) {
    case "active":
      return 'Active';
    case "ready":
      return 'Ready';
    case "awaiting_client":
      return 'Awaiting Client';
    case "starting":
      return 'Starting';
    case "terminated":
      return 'Terminated';
    default:
      return state;
  }
};

const RunnerView: React.FC = () => {
  const router = useRouter();
  const params = useParams();
  const runnerIndex = parseInt(params.id as string, 10);
  
    // Obtain images from RunnersTable ReactQuery
    const { data:runners = [] } = useQuery<Runner[]>({
      queryKey: ['runners'],
    })

  const [runner, setRunner] = useState<Runner | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirmTerminate, setConfirmTerminate] = useState(false);

  useEffect(() => {
    if (!isNaN(runnerIndex) && runners[runnerIndex]) {
      setRunner(runners[runnerIndex]);
      setLoading(false);
    } else {
      // Handle invalid index
      router.push('/runners');
    }
  }, [runnerIndex, runners, router]);

  const goBack = () => {
    router.push('/runners');
  };

  const handleConnect = () => {
    // In a real app, this would redirect to the runner URL or open a connection
    alert(`Connecting to runner: ${runner?.url}`);
  };

  const handleTerminate = () => {
    if (confirmTerminate && runner) {
      // TODO: IMPLEMENT TERMINATE RUNNER
      setConfirmTerminate(false);
    } else {
      setConfirmTerminate(true);
    }
  };

  const canConnect = runner?.state === 'active' || runner?.state === 'awaiting_client';
  const canTerminate = runner?.state !== 'terminated';

  if (loading || !runner) {
    return (
      <div className="flex justify-center">
        <div className="animate-pulse">Loading...</div>
      </div>
    );
  }

  return (
    <>
      <div className="flex items-center mb-6">
        <Button 
          variant="outline" 
          size="sm"
          onClick={goBack}
          className="mr-4"
        >
          <svg
            className="w-4 h-4 mr-2"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M19 12H5M5 12L12 19M5 12L12 5"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          Back
        </Button>
        <h2 className="text-2xl font-bold text-gray-800 dark:text-white/90">Runner Details</h2>
        <div className="ml-auto flex space-x-3">
          {canConnect && (
            <Button 
              size="sm" 
              variant="secondary"
              onClick={handleConnect}
              className="text-blue-600 bg-blue-50 hover:bg-blue-100 dark:text-blue-400 dark:bg-blue-900/20 dark:hover:bg-blue-900/30"
            >
              <svg 
                width="20" 
                height="20" 
                viewBox="0 0 24 24" 
                fill="none" 
                xmlns="http://www.w3.org/2000/svg"
                className="stroke-current mr-2"
              >
                <path 
                  d="M5 12H19M19 12L12 5M19 12L12 19" 
                  strokeWidth="2" 
                  strokeLinecap="round" 
                  strokeLinejoin="round"
                />
              </svg>
              Connect
            </Button>
          )}
          {canTerminate && (
            <Button 
              size="sm" 
              variant="destructive"
              onClick={handleTerminate}
            >
              <svg 
                width="20" 
                height="20" 
                viewBox="0 0 24 24" 
                fill="none" 
                xmlns="http://www.w3.org/2000/svg"
                className="stroke-current mr-2"
              >
                <path 
                  d="M18 6L6 18M6 6L18 18" 
                  strokeWidth="2" 
                  strokeLinecap="round" 
                  strokeLinejoin="round"
                />
              </svg>
              {confirmTerminate ? "Confirm Termination" : "Terminate"}
            </Button>
          )}
        </div>
      </div>

      <div className="bg-white dark:bg-white/[0.03] rounded-2xl border border-gray-200 dark:border-white/[0.05] p-6">
        <div className="flex justify-between items-start mb-6">
          <div className="flex items-center gap-4">
            <div>
              <h3 className="text-xl font-semibold text-gray-800 dark:text-white/90">Runner {runner.id}</h3>
              <p className="text-gray-500 dark:text-gray-400">Created on {runner.createdOn}</p>
            </div>
          </div>
          <div className="flex gap-3">
            <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getStateColor(runner.state)}`}>
              {getStateLabel(runner.state)}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 h-full">
          <div className="space-y-6">
            <div>
              <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Basic Information</h4>
              <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4 space-y-4">
                {runner.userId ? (
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-300">User</span>
                    <span className="text-gray-800 dark:text-white">{runner.userId}</span>
                  </div>
                ) : (
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-300">User</span>
                    <span className="text-gray-800 dark:text-white">In pool (no user assigned)</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-300">Key Pair</span>
                  <span className="text-gray-800 dark:text-white">{runner.keyId}</span>
                </div>
                {runner.url && (
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-300">URL</span>
                    <span className="text-gray-800 dark:text-white">{runner.url}</span>
                  </div>
                )}
                {runner.sessionStart && (
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-300">Session Start</span>
                    <span className="text-gray-800 dark:text-white">{runner.sessionStart}</span>
                  </div>
                )}
                {runner.sessionEnd && (
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-300">Session End</span>
                    <span className="text-gray-800 dark:text-white">{runner.sessionEnd}</span>
                  </div>
                )}
              </div>
            </div>

            <div>
              <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Image Information</h4>
              <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4 space-y-4">
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-300">Image Name</span>
                  <span className="text-gray-800 dark:text-white">{runner.image!.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-300">Image ID</span>
                  <span className="text-gray-800 dark:text-white">{runner.image!.identifier}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-300">Machine Type</span>
                  <span className="text-gray-800 dark:text-white">{runner.image!.machine ? runner.image!.machine.name : "No Name"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-300">Instance Type</span>
                  <span className="text-gray-800 dark:text-white">{runner.image!.machine ? runner.image!.machine.identifier : "No AMI ID"}</span>
                </div>
              </div>
            </div>

            <div>
              <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Hardware Configuration</h4>
              <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4 space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-gray-600 dark:text-gray-300">CPU</span>
                  <div className="flex items-center">
                    <span className="text-gray-800 dark:text-white">
                      {runner.image!.machine ? runner.image!.machine.cpuCount : 0} {runner.image!.machine ? runner.image!.machine.cpuCount === 1 ? 'Core' : 'Cores' : 'Core'}
                    </span>
                  </div>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600 dark:text-gray-300">Memory</span>
                  <div className="flex items-center">
                    <span className="text-gray-800 dark:text-white">
                      {runner.image!.machine ? runner.image!.machine.memorySize : 0} GB
                    </span>
                  </div>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600 dark:text-gray-300">Storage</span>
                  <div className="flex items-center">
                    <span className="text-gray-800 dark:text-white">
                      {runner.image!.machine ? runner.image!.machine.storageSize : 0} GB
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col h-full">
            <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Runtime Metrics</h4>
            <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4 flex-grow">
              <div className="flex flex-col h-full">
                <div className="text-center mb-6">
                  <div className="text-4xl text-blue-500 mb-4">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" className="mx-auto h-12 w-12">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <p className="text-lg font-medium text-gray-800 dark:text-white">Runtime Metrics Coming Soon</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                    Detailed performance metrics will be available in a future update.
                  </p>
                </div>
                
                {runner.sessionStart && runner.sessionEnd && (
                  <div className="mt-auto">
                    <h5 className="text-sm font-medium text-gray-600 dark:text-gray-300 mb-3">Session Timeline</h5>
                    
                    <div className="relative mt-6 bg-white dark:bg-gray-700 p-4 rounded-lg">
                      <div className="w-full h-2 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
                        <div className="h-full bg-blue-500 rounded-full" style={{ width: '40%' }}></div>
                      </div>
                      
                      <div className="flex justify-between mt-4">
                        <div className="text-left">
                          <div className="text-xs text-gray-500 dark:text-gray-400">Start</div>
                          <div className="text-sm font-medium text-gray-800 dark:text-white">{runner.sessionStart}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-xs text-gray-500 dark:text-gray-400">End</div>
                          <div className="text-sm font-medium text-gray-800 dark:text-white">{runner.sessionEnd}</div>
                        </div>
                      </div>
                      
                      <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-600">
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-600 dark:text-gray-300">Session Status</span>
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStateColor(runner.state)}`}>
                            {getStateLabel(runner.state)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default RunnerView;