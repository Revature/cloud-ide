import { RunnerIcon } from "@/icons";

export const SpinnerIcon: React.FC<{ className?: string }> = ({ className = "w-5 h-5 text-orange-500" }) => (
    <svg className={`animate-spin ${className}`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    </svg>
);

export const SuccessIcon: React.FC<{ className?: string }> = ({ className = "w-5 h-5 text-green-500" }) => (
    <svg className={className} fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"></path>
    </svg>
);

export const ErrorIcon: React.FC<{ className?: string }> = ({ className = "w-5 h-5 text-red-500" }) => (
    <svg className={className} fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd"></path>
    </svg>
);

/**
 * Custom icon for Runner Pools (three stacked Runner icons in a pyramid shape).
 */
export const RunnerPoolIcon: React.FC = () => (
  <div className="relative flex items-center justify-center w-6 h-6">
    <RunnerIcon className="absolute top-0 left-1/2 transform -translate-x-1/2 scale-75" />
    <RunnerIcon className="absolute top-2 left-1/4 transform -translate-x-1/2 scale-50" />
    <RunnerIcon className="absolute top-2 right-1/4 transform translate-x-1/2 scale-50" />
  </div>
);