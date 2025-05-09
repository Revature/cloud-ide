"use client";

import React, { useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Button from "../../components/ui/button/Button";
import ProxyImage from "@/components/ui/images/ProxyImage";
import { useImageQuery } from "@/hooks/api/images/useImageQuery";
import { useMachineQuery } from "@/hooks/api/machines/useMachinesData";
import { useCloudConnectorQuery } from "@/hooks/api/cloudConnectors/useCloudConnectorsData";
import ScriptDetails from "@/components/script/ScriptDetails";
import ScriptForm from "@/components/script/ScriptForm";
import { useScriptsByImageIdQuery } from "@/hooks/api/scripts/useScriptsQuery";
import StatusBadge from "../ui/badge/StatusBadge";

const ViewImage: React.FC = () => {
  const router = useRouter();
  const params = useParams();
  const imageId = parseInt(params.id as string, 10);

  // State for active tab
  const [activeTab, setActiveTab] = useState<"information" | "scripts">("information");

  // State to toggle the "Add Script" form
  const [isAddingScript, setIsAddingScript] = useState(false);

  // Use React Query to fetch the image data
  const { data: image, isLoading: imageLoading, error: imageError } = useImageQuery(imageId);

  // Fetch machine data if image is loaded and has machine_id
  const { data: machine, isLoading: machineLoading, error: machineError } = useMachineQuery(image?.machineId || 0);

  // Fetch cloud connector data if image is loaded and has cloudConnector_id
  const { data: cloudConnector, isLoading: connectorLoading, error: connectorError } = useCloudConnectorQuery(image?.cloudConnectorId || 0);

  // Fetch associated scripts
  const { data: scripts } = useScriptsByImageIdQuery(imageId);

  // Extract existing events
  const existingEvents = scripts?.map((script) => script.event) || [];

  const goBack = () => {
    router.push("/images");
  };

  const navigateToEdit = () => {
    router.push(`/images/edit/${imageId}`);
  };

  // Overall loading state
  const isLoading = imageLoading || (!!image?.machineId && machineLoading) || (!!image?.cloudConnectorId && connectorLoading);

  // Overall error state
  const error = imageError || (!!image?.machineId && machineError) || (!!image?.cloudConnectorId && connectorError);

  if (isLoading) {
    return (
      <div className="flex justify-center">
        <div className="animate-pulse">Loading...</div>
      </div>
    );
  }

  if (error || !image) {
    return (
      <div className="flex flex-col items-center">
        <p className="text-red-500 dark:text-red-400 mb-4">
          {error ? `Error loading data: ${error instanceof Error ? error.message : "Unknown error"}` : "Image not found"}
        </p>
        <Button onClick={goBack}>Back to Images</Button>
      </div>
    );
  }

  return (
    <>
      {/* Tabs */}
      <div className="mb-6 border-b border-gray-200 dark:border-gray-700">
        <nav className="flex space-x-4">
          <button
            className={`px-4 py-2 text-sm font-medium ${
              activeTab === "information"
                ? "text-brand-500 border-b-2 border-brand-500"
                : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
            }`}
            onClick={() => setActiveTab("information")}
          >
            Information
          </button>
          <button
            className={`px-4 py-2 text-sm font-medium ${
              activeTab === "scripts"
                ? "text-brand-500 border-b-2 border-brand-500"
                : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
            }`}
            onClick={() => setActiveTab("scripts")}
          >
            Scripts
          </button>
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === "information" && (
        <div>
          {/* Information content */}
          <div className="bg-white dark:bg-white/[0.03] rounded-2xl border border-gray-200 dark:border-white/[0.05] p-6">
            <div className="flex justify-between items-start mb-6">
              <div className="flex items-center gap-4">
                <div>
                  <h3 className="text-xl font-semibold text-gray-800 dark:text-white/90">{image.name}</h3>
                  <p className="text-gray-600 dark:text-gray-300">{image.description}</p>
                </div>
              </div>
              <div className="flex gap-3">
                <StatusBadge status={image.status} />
                <Button size="sm" variant="outline" onClick={navigateToEdit}>
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    className="stroke-current mr-2"
                  >
                    <path
                      d="M11 4H4C3.46957 4 2.96086 4.21071 2.58579 4.58579C2.21071 4.96086 2 5.46957 2 6V20C2 20.5304 2.21071 21.0391 2.58579 21.4142C2.96086 21.7893 3.46957 22 4 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V13"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M18.5 2.50001C18.8978 2.10219 19.4374 1.87869 20 1.87869C20.5626 1.87869 21.1022 2.10219 21.5 2.50001C21.8978 2.89784 22.1213 3.4374 22.1213 4.00001C22.1213 4.56262 21.8978 5.10219 21.5 5.50001L12 15L8 16L9 12L18.5 2.50001Z"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  Edit
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
              <div>
                <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Basic Information</h4>
                <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4 space-y-4">
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-300">Identifier</span>
                    <span className="text-gray-800 dark:text-white">{image.identifier}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-300">Created On</span>
                    <span className="text-gray-800 dark:text-white">{image.createdOn}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-300">Last Updated</span>
                    <span className="text-gray-800 dark:text-white">{image.updatedOn}</span>
                  </div>
                  {image.createdBy && (
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-300">Created By</span>
                      <span className="text-gray-800 dark:text-white">{image.createdBy}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex flex-col h-full">
                <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Usage Statistics</h4>
                <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4 flex-grow">
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center">
                      <svg 
                        className="w-12 h-12 mx-auto text-gray-400" 
                        fill="none" 
                        viewBox="0 0 24 24" 
                        stroke="currentColor"
                      >
                        <path 
                          strokeLinecap="round" 
                          strokeLinejoin="round" 
                          strokeWidth="2" 
                          d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" 
                        />
                      </svg>
                      <h3 className="mt-4 text-sm font-medium text-gray-900 dark:text-white">
                        Usage statistics coming soon
                      </h3>
                      <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                        Runner usage statistics will be available in a future update.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Machine Details in its own box with loading state */}
            <div className="mb-8">
              <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Machine Configuration</h4>
              <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4">
                {image.machineId ? (
                  machineLoading ? (
                    <div className="flex justify-center p-8">
                      <div className="animate-pulse">Loading machine data...</div>
                    </div>
                  ) : machineError ? (
                    <div className="text-center p-8">
                      <svg 
                        className="w-12 h-12 mx-auto text-red-400" 
                        fill="none" 
                        viewBox="0 0 24 24" 
                        stroke="currentColor"
                      >
                        <path 
                          strokeLinecap="round" 
                          strokeLinejoin="round" 
                          strokeWidth="2" 
                          d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" 
                        />
                      </svg>
                      <h3 className="mt-4 text-sm font-medium text-red-600 dark:text-red-400">
                        Error loading machine data
                      </h3>
                    </div>
                  ) : machine ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <div className="mb-4">
                          <p className="text-lg font-medium text-gray-800 dark:text-white">{machine.name}</p>
                          <p className="text-sm text-gray-500 dark:text-gray-400">ID: {machine.identifier}</p>
                        </div>
                        <div className="space-y-2">
                          <div className="flex items-center">
                            <svg className="w-5 h-5 mr-2 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2z" />
                            </svg>
                            <span className="text-gray-700 dark:text-gray-300">CPU: {machine.cpuCount} {machine.cpuCount === 1 ? 'Core' : 'Cores'}</span>
                          </div>
                          <div className="flex items-center">
                            <svg className="w-5 h-5 mr-2 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <span className="text-gray-700 dark:text-gray-300">Memory: {machine.memorySize} GB</span>
                          </div>
                          <div className="flex items-center">
                            <svg className="w-5 h-5 mr-2 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                            </svg>
                            <span className="text-gray-700 dark:text-gray-300">Storage: {machine.storageSize} GB</span>
                          </div>
                        </div>
                      </div>
                      <div className="border-t md:border-l md:border-t-0 border-gray-200 dark:border-gray-700 md:pl-4 pt-4 md:pt-0">
                        <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Machine Details</h4>
                        <div className="space-y-2">
                          {machine.createdOn && (
                            <div className="flex justify-between">
                              <span className="text-gray-600 dark:text-gray-300">Created</span>
                              <span className="text-gray-800 dark:text-white">{machine.createdOn}</span>
                            </div>
                          )}
                          {machine.updatedOn && (
                            <div className="flex justify-between">
                              <span className="text-gray-600 dark:text-gray-300">Last Updated</span>
                              <span className="text-gray-800 dark:text-white">{machine.updatedOn}</span>
                            </div>
                          )}
                          {machine.createdBy && (
                            <div className="flex justify-between">
                              <span className="text-gray-600 dark:text-gray-300">Created By</span>
                              <span className="text-gray-800 dark:text-white">{machine.createdBy}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center p-8">
                      <p className="text-gray-500 dark:text-gray-400">No machine data available</p>
                    </div>
                  )
                ) : (
                  <div className="text-center p-8">
                    <p className="text-gray-500 dark:text-gray-400">No machine associated with this image</p>
                  </div>
                )}
              </div>
            </div>

            {/* Cloud Connector Details in its own box with loading state */}
            <div>
              <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Cloud Provider</h4>
              <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4">
                {image.cloudConnectorId ? (
                  connectorLoading ? (
                    <div className="flex justify-center p-8">
                      <div className="animate-pulse">Loading cloud provider data...</div>
                    </div>
                  ) : connectorError ? (
                    <div className="text-center p-8">
                      <svg 
                        className="w-12 h-12 mx-auto text-red-400" 
                        fill="none" 
                        viewBox="0 0 24 24" 
                        stroke="currentColor"
                      >
                        <path 
                          strokeLinecap="round" 
                          strokeLinejoin="round" 
                          strokeWidth="2" 
                          d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" 
                        />
                      </svg>
                      <h3 className="mt-4 text-sm font-medium text-red-600 dark:text-red-400">
                        Error loading cloud provider data
                      </h3>
                    </div>
                  ) : cloudConnector ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <div className="flex items-center mb-4">
                          <div className="w-12 h-12 flex-shrink-0 mr-4">
                            <ProxyImage
                              src={cloudConnector.image || "/images/brand/default-logo.svg"}
                              alt={cloudConnector.name || "Cloud Provider"}
                              width={48}
                              height={48}
                              className="w-full h-full object-contain"
                            />
                          </div>
                          <div>
                            <p className="text-lg font-medium text-gray-800 dark:text-white">{cloudConnector.name}</p>
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              cloudConnector.status 
                                ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' 
                                : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                            }`}>
                              {cloudConnector.status ? 'Active' : 'Inactive'}
                            </span>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <div className="flex items-center">
                            <svg className="w-5 h-5 mr-2 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <span className="text-gray-700 dark:text-gray-300">Region: {cloudConnector.region}</span>
                          </div>
                          <div className="flex items-center">
                            <svg className="w-5 h-5 mr-2 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                            </svg>
                            <span className="text-gray-700 dark:text-gray-300">Type: {cloudConnector.type}</span>
                          </div>
                        </div>
                      </div>
                      <div className="border-t md:border-l md:border-t-0 border-gray-200 dark:border-gray-700 md:pl-4 pt-4 md:pt-0">
                        <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Connector Details</h4>
                        <div className="space-y-2">
                          {cloudConnector.createdOn && (
                            <div className="flex justify-between">
                              <span className="text-gray-600 dark:text-gray-300">Created</span>
                              <span className="text-gray-800 dark:text-white">{cloudConnector.createdOn}</span>
                            </div>
                          )}
                          {cloudConnector.createdBy && (
                            <div className="flex justify-between">
                              <span className="text-gray-600 dark:text-gray-300">Created By</span>
                              <span className="text-gray-800 dark:text-white">{cloudConnector.createdBy}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center p-8">
                      <p className="text-gray-500 dark:text-gray-400">No cloud provider data available</p>
                    </div>
                  )
                ) : (
                  <div className="text-center p-8">
                    <p className="text-gray-500 dark:text-gray-400">No cloud provider associated with this image</p>
                  </div>
                )}
              </div>
            </div>
            </div>
          </div>
      )}

      {activeTab === "scripts" && (
        <div> 
          {isAddingScript ? (
            <div className="bg-white dark:bg-white/[0.03] rounded-2xl border border-gray-200 dark:border-white/[0.05] p-6">
            <ScriptForm
              imageId={imageId}
              existingEvents={existingEvents}
              onCancel={() => setIsAddingScript(false)} // Pass the callback to close the form
            />
          </div>
          ) : (
              <div className="bg-white dark:bg-white/[0.03] rounded-2xl border border-gray-200 dark:border-white/[0.05] p-6">
                <ScriptDetails imageId={imageId} setPhase={setIsAddingScript}/>
              </div>
          )}
        </div>
      )}
    </>
  );
};

export default ViewImage;