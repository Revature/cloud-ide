// src/app/api/v1/images/[id]/route.ts
import { NextResponse } from 'next/server';
import { BackendImage, BackendMachine, BackendCloudConnector } from '@/types/api';
import { Image, Machine, CloudConnector } from '@/types';

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const apiUrl = process.env.BACKEND_API_URL || 'http://backend:8000';
    const id = params.id;
    
    // Fetch the image details
    const imageResponse = await fetch(`${apiUrl}/api/v1/images/${id}`, {
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!imageResponse.ok) {
      return NextResponse.json(
        { error: `Failed to fetch image with ID ${id}` },
        { status: imageResponse.status }
      );
    }

    const backendImage: BackendImage = await imageResponse.json();
    
    // Initialize related data
    let machine: Machine | undefined;
    let cloudConnector: CloudConnector | undefined;
    
    // Parallel fetch for related data
    const fetchPromises: Promise<void>[] = [];
    
    // Fetch machine if available
    if (backendImage.machine_id) {
      const machinePromise = fetch(`${apiUrl}/api/machines/${backendImage.machine_id}`, {
        headers: { 'Content-Type': 'application/json' },
      }).then(async (res) => {
        if (res.ok) {
          const backendMachine: BackendMachine = await res.json();
          machine = {
            id: backendMachine.id,
            name: backendMachine.name,
            identifier: backendMachine.identifier,
            cpu_count: backendMachine.cpu_count,
            memory_size: backendMachine.memory_size,
            storage_size: backendMachine.storage_size,
          };
        }
      }).catch(err => {
        console.error(`Error fetching machine data: ${err}`);
      });
      
      fetchPromises.push(machinePromise);
    }
    
    // Fetch cloud connector if available
    if (backendImage.cloud_connector_id) {
      const connectorPromise = fetch(`${apiUrl}/api/cloud-connectors/${backendImage.cloud_connector_id}`, {
        headers: { 'Content-Type': 'application/json' },
      }).then(async (res) => {
        if (res.ok) {
          const backendConnector: BackendCloudConnector = await res.json();
          cloudConnector = {
            id: backendConnector.id,
            name: backendConnector.name,
            type: backendConnector.provider_type,
            region: backendConnector.region,
            active: Boolean(backendConnector.active),
            image: `/images/providers/${backendConnector.provider_type.toLowerCase()}.svg`,
            createdOn: new Date(backendConnector.created_on).toLocaleDateString('en-US', {
              year: 'numeric', month: 'short', day: 'numeric'
            }),
            updatedOn: new Date(backendConnector.updated_on).toLocaleDateString('en-US', {
              year: 'numeric', month: 'short', day: 'numeric'
            }),
          };
        }
      }).catch(err => {
        console.error(`Error fetching cloud connector data: ${err}`);
      });
      
      fetchPromises.push(connectorPromise);
    }
    
    // Wait for all fetch operations to complete
    await Promise.all(fetchPromises);
    
    // Transform backend image to frontend format
    const transformedImage: Image = {
      id: backendImage.id,
      name: backendImage.name,
      description: backendImage.description || '',
      identifier: backendImage.identifier,
      active: Boolean(backendImage.active),
      machine,
      cloudConnector,
      createdOn: new Date(backendImage.created_on).toLocaleDateString('en-US', {
        year: 'numeric', month: 'short', day: 'numeric'
      }),
      updatedOn: new Date(backendImage.updated_on).toLocaleDateString('en-US', {
        year: 'numeric', month: 'short', day: 'numeric'
      }),
    };
    
    return NextResponse.json(transformedImage);
  } catch (error) {
    console.error('Image API route error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch image details' },
      { status: 500 }
    );
  }
}