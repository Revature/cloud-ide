import React from "react";

interface StatusBadgeProps {
  status: string; // The status or event value
  className?: string; // Optional additional classes for customization
}

const StatusBadge: React.FC<StatusBadgeProps> = ({ status, className = "" }) => {
  // Define styles and labels for each status
  const statusStyles: Record<string, string> = {
    active: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
    on_create: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
    inactive: "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300",
    ready: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
    closed_pool: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
    starting: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
    creating: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
    on_disconnect: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
    terminated: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
    on_terminate: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
    awaiting_client: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
    on_awaiting_client: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
    error: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
    success: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
    failed: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
    deleted: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
    
  };

  // Capitalize the first letter of the status
  const formattedStatus = status
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusStyles[status] || "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300"} ${className}`}
    >
      {formattedStatus}
    </span>
  );
};

export default StatusBadge;