"use client";
import React, { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useCloudConnectors, CloudConnector } from '@/context/CloudConnectorsContext';
import Button from "../../components/ui/button/Button";
import ProxyImage from "@/components/ui/images/ProxyImage";
import { EyeOpenIcon, EyeClosedIcon } from "@/icons";

const ViewConnector: React.FC = () => {
  const router = useRouter();
  const params = useParams();
  const { connectors } = useCloudConnectors();
  const connectorIndex = parseInt(params.id as string, 10);
  
  const [connector, setConnector] = useState<CloudConnector | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAccessKey, setShowAccessKey] = useState(false);
  const [showSecretKey, setShowSecretKey] = useState(false);

  useEffect(() => {
    if (!isNaN(connectorIndex) && connectors[connectorIndex]) {
      setConnector(connectors[connectorIndex]);
      setLoading(false);
    } else {
      // Handle invalid index
      router.push('/cloud-connectors');
    }
  }, [connectorIndex, connectors, router]);

  const goBack = () => {
    router.push('/cloud-connectors');
  };

  const navigateToEdit = () => {
    router.push(`/cloud-connectors/edit/${connectorIndex}`);
  };

  if (loading || !connector) {
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
        <h2 className="text-2xl font-bold text-gray-800 dark:text-white/90">Cloud Connector Details</h2>
      </div>

      <div className="bg-white dark:bg-white/[0.03] rounded-2xl border border-gray-200 dark:border-white/[0.05] p-6">
        <div className="flex justify-between items-start mb-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 flex items-center justify-center bg-gray-100 dark:bg-gray-800 rounded-lg">
              <ProxyImage
                width={48}
                height={48}
                src={connector?.image || "/images/brand/default-logo.svg"}
                alt={connector?.name || "Cloud Provider"}
              />
            </div>
            <div>
              <h3 className="text-xl font-semibold text-gray-800 dark:text-white/90">{connector?.name}</h3>
              <p className="text-gray-500 dark:text-gray-400">Added on {connector?.added}</p>
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

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 h-full">
          <div className="space-y-6">
            <div>
              <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Configuration</h4>
              <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4 space-y-4">
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-300">Status</span>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    connector?.active 
                      ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' 
                      : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                  }`}>
                    {connector?.active ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-300">Region</span>
                  <span className="text-gray-800 dark:text-white">{connector?.region}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-300">Service Type</span>
                  <span className="text-gray-800 dark:text-white">{connector?.type}</span>
                </div>
              </div>
            </div>

            <div>
              <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Credentials</h4>
              <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4 space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-gray-600 dark:text-gray-300">Access Key</span>
                  <div className="flex items-center">
                    <span className="text-gray-800 dark:text-white mr-2">
                      {showAccessKey 
                        ? connector?.accessKey 
                        : `••••••••••••${connector?.accessKey ? connector.accessKey.slice(-4) : ''}`
                      }
                    </span>
                    <button
                      onClick={() => setShowAccessKey(!showAccessKey)}
                      className="text-gray-500 hover:text-brand-500 dark:text-gray-400 dark:hover:text-brand-400 transition-colors"
                    >
                      {showAccessKey ? <EyeClosedIcon /> : <EyeOpenIcon />}
                    </button>
                  </div>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600 dark:text-gray-300">Secret Key</span>
                  <div className="flex items-center">
                    <span className="text-gray-800 dark:text-white mr-2">
                      {showSecretKey 
                        ? connector?.secretKey 
                        : `••••••••••••${connector?.secretKey ? connector.secretKey.slice(-4) : ''}`
                      }
                    </span>
                    <button
                      onClick={() => setShowSecretKey(!showSecretKey)}
                      className="text-gray-500 hover:text-brand-500 dark:text-gray-400 dark:hover:text-brand-400 transition-colors"
                    >
                      {showSecretKey ? <EyeClosedIcon /> : <EyeOpenIcon />}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col h-full">
            <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Usage Statistics</h4>
            <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4 flex-grow flex items-center justify-center">
              <div className="text-center">
                <svg
                  className="mx-auto h-12 w-12 text-gray-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                  />
                </svg>
                <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">No usage data available</h3>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  Usage statistics will appear here once the connector becomes active.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default ViewConnector;