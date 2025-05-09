import React, { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import Toggle from "@/components/form/input/Toggle";

interface StatusToggleProps {
  isActive: boolean; // Current status
  onToggle: (isActive: boolean) => Promise<void>; // Function to handle the toggle action
  queryKey: string[]; // Query key to invalidate after toggling
}

const StatusToggle: React.FC<StatusToggleProps> = ({ isActive, onToggle, queryKey }) => {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState(isActive);
  const queryClient = useQueryClient();

  const handleToggle = async () => {
    setLoading(true);
    try {
      const newStatus = !status;
      await onToggle(newStatus); // Trigger the API call
      setStatus(newStatus); // Update the local state
      queryClient.invalidateQueries({queryKey}); // Invalidate the query to refresh the data
    } catch (error) {
      console.error("Failed to toggle status:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center">
      <Toggle
        enabled={status}
        setEnabled={handleToggle}
        disabled={loading} // Disable toggle while loading
      />
      {loading && (
        <span className="ml-2 text-sm text-gray-500 dark:text-gray-400">
          Updating...
        </span>
      )}
    </div>
  );
};

export default StatusToggle;