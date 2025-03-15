import React from "react";

interface ToggleProps {
  enabled: boolean;
  setEnabled: (enabled: boolean) => void;
  label?: string;
  className?: string;
  disabled?: boolean;
  id?: string;
}

const Toggle: React.FC<ToggleProps> = ({
  enabled,
  setEnabled,
  label,
  className = "",
  disabled = false,
  id,
}) => {
  return (
    <div className={`flex items-center ${className}`}>
      <button
        id={id}
        type="button"
        onClick={() => !disabled && setEnabled(!enabled)}
        className={`
          relative inline-flex h-6 w-11 items-center rounded-full
          ${enabled ? 'bg-brand-500' : 'bg-gray-300 dark:bg-gray-700'}
          transition-colors ease-in-out duration-200
          ${disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}
        `}
        role="switch"
        aria-checked={enabled ? "true" : "false"}
        disabled={disabled}
      >
        <span
          className={`
            inline-block h-4 w-4 transform rounded-full bg-white shadow-sm
            transition-transform duration-200 ease-in-out
            ${enabled ? 'translate-x-6' : 'translate-x-1'}
          `}
        />
      </button>
      {label && (
        <span className="ml-3 text-sm font-medium text-gray-800 dark:text-gray-200">
          {label}
        </span>
      )}
    </div>
  );
};

export default Toggle;