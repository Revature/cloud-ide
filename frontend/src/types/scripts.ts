import { ItemWithResourceID } from "@/hooks/useResourceForItems";

export interface Script extends ItemWithResourceID<number>{
    id: number;
    name: string;
    description: string;
    script: string; 
    event: string;
    imageId: number;
    createdAt: string;
    updatedAt: string;
    modifiedBy: string;
    createdBy: string;
  }

  export interface ScriptRequest {
    name: string;
    description: string;
    script: string; 
    event: string;
    image_id: number;
  }
  
  export interface ScriptResponse{
    id: number;
    name: string;
    description: string;
    script: string; 
    event: string;
    image_id: number;
    created_at: string;
    updated_at: string;
    modified_by: string;
    created_by: string;
  }

  export function convertScriptResponse(scriptResponse: ScriptResponse): Script {
    if (!scriptResponse || typeof scriptResponse !== 'object') {
      throw new Error('Invalid script data provided to converter');
    }

    return {
      id: scriptResponse.id,
      name: scriptResponse.name,
      imageId: scriptResponse.image_id,
      description: scriptResponse.description,
      script: scriptResponse.script,
      event: scriptResponse.event,
      createdAt: new Date(scriptResponse.created_at).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      }),
      updatedAt: new Date(scriptResponse.updated_at).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      }),
      createdBy: scriptResponse.created_by,
      modifiedBy: scriptResponse.modified_by,
    };

  }

