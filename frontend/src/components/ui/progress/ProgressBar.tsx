import React from "react";

interface ProgressBarProps {
  progress: number;
  className?: string; // Allow custom styles to be passed
}

const ProgressBar: React.FC<ProgressBarProps> = ({ progress, className }) => {
  return (
    <div className={`w-full bg-gray-200 rounded-full dark:bg-gray-700 ${className}`}>
      <div
        className="bg-blue-600 text-xs font-medium text-blue-100 text-center p-0.5 leading-none rounded-full"
        style={{ width: `${progress}%` }}
      >
      </div>
    </div>
  );
};

export default ProgressBar;