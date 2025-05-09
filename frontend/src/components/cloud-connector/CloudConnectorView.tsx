"use client";
import React, { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Button from "../../components/ui/button/Button";
import ProxyImage from "@/components/ui/images/ProxyImage";
import { EyeOpenIcon, EyeClosedIcon } from "@/icons";
import { CloudConnector } from '@/types/cloudConnectors';
import { cloudConnectorsApi } from '@/services/cloud-resources/cloudConnectors';
import Toggle from '../form/input/Toggle';
import StatusBadge from '../ui/badge/StatusBadge';

const ViewConnector: React.FC = () => {
  const router = useRouter();
  const params = useParams();
  const id = parseInt(params.id as string, 10);
  
  const [connector, setConnector] = useState<CloudConnector | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAccessKey, setShowAccessKey] = useState(false);
  const [showSecretKey, setShowSecretKey] = useState(false);

  useEffect(() => {
    const fetchConnector = async () => {
      try {
        setLoading(true);
        
        // Use the cloudConnectorsApi service instead of direct fetch
        const data = await cloudConnectorsApi.getById(id);
        setConnector(data);
        setError(null);
      } catch (err) {
        console.error('Error fetching cloud connector:', err);
        setError('Failed to load cloud connector details.');
      } finally {
        setLoading(false);
      }
    };

    if (!isNaN(id)) {
      fetchConnector();
    } else {
      setError('Invalid connector ID');
      setLoading(false);
    }
  }, [id]);

  const goBack = () => {
    router.push('/cloud-connectors');
  };

  const navigateToEdit = () => {
    router.push(`/cloud-connectors/edit/${id}`);
  };

  if (loading) {
    return (
      <div className="flex justify-center">
        <div className="animate-pulse">Loading...</div>
      </div>
    );
  }

  if (error || !connector) {
    return (
      <div className="flex flex-col items-center">
        <p className="text-red-500 mb-4">{error || 'Cloud connector not found'}</p>
        <Button variant="outline" onClick={goBack}>Return to List</Button>
      </div>
    );
  }

  function handleToggleChange(enabled: boolean): void {
    console.log('Toggle changed:', enabled);
  }

  return (
    <>
      <div className="bg-white dark:bg-white/[0.03] rounded-2xl border border-gray-200 dark:border-white/[0.05] p-6">
        <div className="flex justify-between items-start mb-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 flex items-center justify-center bg-gray-100 dark:bg-gray-800 rounded-lg">
              <ProxyImage
                width={48}
                height={48}
                src={connector.image || "/images/brand/default-logo.svg"}
                alt={connector.name || "Cloud Provider"}
              />
            </div>
            <div>
              <h3 className="text-xl font-semibold text-gray-800 dark:text-white/90">{connector.name}</h3>
            </div>
          </div>
          <div className="flex gap-3">
          <Toggle enabled={connector.status === 'active'} setEnabled={handleToggleChange} />
          <StatusBadge status={connector.status} />
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
                  <span className="text-gray-600 dark:text-gray-300">Created On</span>
                  <span className="text-gray-800 dark:text-white">{connector.createdOn}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-300">Region</span>
                  <span className="text-gray-800 dark:text-white">{connector.region}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-300">Service Type</span>
                  <span className="text-gray-800 dark:text-white">{connector.type}</span>
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
                        ? connector.accessKey 
                        : `••••••••••••${connector.accessKey ? connector.accessKey.slice(-4) : ''}`
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
                        ? connector.secretKey 
                        : `••••••••••••${connector.secretKey ? connector.secretKey.slice(-4) : ''}`
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
        </div>
      </div>
    </>
  );
};

export default ViewConnector;