"use client";
import React from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import api from '@/app/frontend-api/api';
import Button from "../../components/ui/button/Button";
import ProxyImage from "@/components/ui/images/ProxyImage";

const ViewImage: React.FC = () => {
  const router = useRouter();
  const params = useParams();
  const imageId = parseInt(params.id as string, 10);
  
  // Use React Query to fetch the image data
  const { 
    data: image, 
    isLoading, 
    error 
  } = useQuery({
    queryKey: ['image', imageId],
    queryFn: () => api.images.getById(imageId),
    enabled: !isNaN(imageId),
    staleTime: 1000 * 60 * 5, // Consider data fresh for 5 minutes
  });

  const goBack = () => {
    router.push('/images');
  };

  const navigateToEdit = () => {
    router.push(`/images/edit/${imageId}`);
  };

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
          {error ? `Error loading image: ${error instanceof Error ? error.message : 'Unknown error'}` : 'Image not found'}
        </p>
        <Button onClick={goBack}>Back to Images</Button>
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
        <h2 className="text-2xl font-bold text-gray-800 dark:text-white/90">Image Details</h2>
      </div>

      <div className="bg-white dark:bg-white/[0.03] rounded-2xl border border-gray-200 dark:border-white/[0.05] p-6">
        <div className="flex justify-between items-start mb-6">
          <div className="flex items-center gap-4">
            <div>
              <h3 className="text-xl font-semibold text-gray-800 dark:text-white/90">{image.name}</h3>
              <p className="text-gray-500 dark:text-gray-400">Created on {image.createdOn}</p>
            </div>
          </div>
          <div className="flex gap-3">
            <Button 
              size="sm" 
              variant="outline"
              onClick={navigateToEdit}
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
        
        <div className="mb-6">
          <p className="text-gray-600 dark:text-gray-300">
            {image.description}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 h-full">
          <div className="space-y-6">
            <div>
              <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Basic Information</h4>
              <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4 space-y-4">
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-300">Status</span>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    image.active 
                      ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' 
                      : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                  }`}>
                    {image.active ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-300">Identifier</span>
                  <span className="text-gray-800 dark:text-white">{image.identifier}</span>
                </div>
                {image.machine && (
                  <>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-300">Machine Type</span>
                      <span className="text-gray-800 dark:text-white">{image.machine.name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-300">Instance Type</span>
                      <span className="text-gray-800 dark:text-white">{image.machine.identifier}</span>
                    </div>
                  </>
                )}
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-300">Last Updated</span>
                  <span className="text-gray-800 dark:text-white">{image.updatedOn}</span>
                </div>
              </div>
            </div>

            {/* Cloud Provider Information */}
            {image.cloudConnector && (
              <div>
                <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Cloud Provider</h4>
                <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4 space-y-4">
                  <div className="flex items-center">
                  <div className="w-8 h-8 mr-3">
                      {image.cloudConnector.image ? (
                        <ProxyImage
                          src={image.cloudConnector.image}
                          alt={image.cloudConnector.name}
                          width={32}
                          height={32}
                          className="w-full h-full object-contain"
                        />
                      ) : (
                        <div className="w-8 h-8 bg-gray-200 dark:bg-gray-700 rounded-full flex items-center justify-center">
                          <span className="text-xs text-gray-500 dark:text-gray-400">?</span>
                        </div>
                      )}
                    </div>
                    <div>
                      <span className="block text-gray-800 dark:text-white font-medium">
                        {image.cloudConnector.name}
                      </span>
                      <span className="block text-xs text-gray-600 dark:text-gray-400">
                        Added on {image.cloudConnector.createdOn}
                      </span>
                    </div>
                  </div>
                  <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-gray-600 dark:text-gray-300">Region</span>
                      <span className="text-gray-800 dark:text-white">
                        {image.cloudConnector.region}
                      </span>
                    </div>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-gray-600 dark:text-gray-300">Type</span>
                      <span className="text-gray-800 dark:text-white">
                        {image.cloudConnector.type}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600 dark:text-gray-300">Status</span>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        image.cloudConnector.active 
                          ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' 
                          : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                      }`}>
                        {image.cloudConnector.active ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {image.machine && (
              <div>
                <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Hardware Configuration</h4>
                <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4 space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600 dark:text-gray-300">CPU</span>
                    <div className="flex items-center">
                      <span className="text-gray-800 dark:text-white">
                        {image.machine.cpu_count} {image.machine.cpu_count === 1 ? 'Core' : 'Cores'}
                      </span>
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600 dark:text-gray-300">Memory</span>
                    <div className="flex items-center">
                      <span className="text-gray-800 dark:text-white">
                        {image.machine.memory_size} GB
                      </span>
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600 dark:text-gray-300">Storage</span>
                    <div className="flex items-center">
                      <span className="text-gray-800 dark:text-white">
                        {image.machine.storage_size} GB
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="flex flex-col h-full">
            <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Usage Statistics</h4>
            <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4 flex-grow">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white dark:bg-gray-700 rounded-lg p-4 flex flex-col items-center justify-center">
                  <span className="text-sm text-gray-500 dark:text-gray-300">Active Runners</span>
                  <span className="text-2xl font-bold text-gray-800 dark:text-white mt-2">
                    {Math.floor(Math.random() * 10)}
                  </span>
                </div>
                <div className="bg-white dark:bg-gray-700 rounded-lg p-4 flex flex-col items-center justify-center">
                  <span className="text-sm text-gray-500 dark:text-gray-300">Usage</span>
                  <span className="text-2xl font-bold text-gray-800 dark:text-white mt-2">
                    {Math.floor(Math.random() * 100)}%
                  </span>
                </div>
                <div className="bg-white dark:bg-gray-700 rounded-lg p-4 flex flex-col items-center justify-center">
                  <span className="text-sm text-gray-500 dark:text-gray-300">Average Runtime</span>
                  <span className="text-2xl font-bold text-gray-800 dark:text-white mt-2">
                    {Math.floor(Math.random() * 120) + 30} min
                  </span>
                </div>
                <div className="bg-white dark:bg-gray-700 rounded-lg p-4 flex flex-col items-center justify-center">
                  <span className="text-sm text-gray-500 dark:text-gray-300">Total Sessions</span>
                  <span className="text-2xl font-bold text-gray-800 dark:text-white mt-2">
                    {Math.floor(Math.random() * 1000)}
                  </span>
                </div>
              </div>
              <div className="mt-4">
                <h5 className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">Recent Activity</h5>
                <div className="space-y-2">
                  {image.active ? (
                    Array.from({ length: 3 }).map((_, i) => (
                      <div key={i} className="bg-white dark:bg-gray-700 rounded-lg p-2 flex justify-between">
                        <span className="text-xs text-gray-600 dark:text-gray-300">
                          Runner #{Math.floor(Math.random() * 1000)}
                        </span>
                        <span className="text-xs text-gray-800 dark:text-white">
                          {Math.floor(Math.random() * 60)} min ago
                        </span>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-6">
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        No recent activity - image is inactive
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default ViewImage;