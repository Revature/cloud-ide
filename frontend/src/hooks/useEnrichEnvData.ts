import { useState, useCallback } from "react";

interface EnvData {
  script_vars: string; // JSON string
  env_vars: string; // JSON string
}

export function useEnrichEnvData() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const enrichEnvDataWithUserIp = useCallback(async (envData: EnvData): Promise<EnvData> => {
    setIsLoading(true);
    setError(null);

    try {
      // Fetch the user's IP address
      const ipResponse = await fetch('https://api.ipify.org?format=json');
      const ipData = await ipResponse.json();
      const userIp = ipData.ip;

      // Parse the script_vars and env_vars JSON strings into objects
      const scriptVars = JSON.parse(envData.script_vars || '{}');
      const envVars = JSON.parse(envData.env_vars || '{}');

      // Add the user_ip to the script_vars
      scriptVars.user_ip = userIp;

      // Convert the updated objects back to JSON strings
      return {
        script_vars: JSON.stringify(scriptVars),
        env_vars: JSON.stringify(envVars),
      };
    } catch (error) {
      console.error('Failed to enrich env_data with user IP:', error);
      setError('Failed to enrich env_data with user IP');
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { enrichEnvDataWithUserIp, isLoading, error };
}