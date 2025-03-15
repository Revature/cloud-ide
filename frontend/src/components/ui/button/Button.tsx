import React, { ReactNode, ButtonHTMLAttributes } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode; // Button text or content
  size?: "xs" | "sm" | "md" | "lg"; // Button size
  variant?: "primary" | "outline" | "destructive" | "success" | "secondary" | "ghost" | "link"; // Button variant
  startIcon?: ReactNode; // Icon before the text
  endIcon?: ReactNode; // Icon after the text
  fullWidth?: boolean; // Make button take full width
  isLoading?: boolean; // Loading state
  className?: string; // Additional classes
}

const Button: React.FC<ButtonProps> = ({
  children,
  size = "md",
  variant = "primary",
  startIcon,
  endIcon,
  onClick,
  className = "",
  disabled = false,
  fullWidth = false,
  isLoading = false,
  type = "button",
  ...props
}) => {
  // Size Classes
  const sizeClasses = {
    xs: "px-2.5 py-1.5 text-xs",
    sm: "px-4 py-2 text-sm",
    md: "px-5 py-2.5 text-sm",
    lg: "px-6 py-3 text-base",
  };

  // Variant Classes
  const variantClasses = {
    primary:
      "bg-brand-500 text-white shadow-theme-xs hover:bg-brand-600 disabled:bg-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-500/25 focus:ring-offset-0",
    secondary:
      "bg-gray-100 text-gray-800 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-500/20 focus:ring-offset-0",
    outline:
      "bg-white text-gray-700 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-400 dark:ring-gray-700 dark:hover:bg-white/[0.03] dark:hover:text-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-500/20 focus:ring-offset-0",
    destructive:
      "bg-red-500 text-white hover:bg-red-600 disabled:bg-red-300 dark:bg-red-600 dark:hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500/25 focus:ring-offset-0",
    success:
      "bg-green-500 text-white hover:bg-green-600 disabled:bg-green-300 dark:bg-green-600 dark:hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500/25 focus:ring-offset-0",
    ghost:
      "bg-transparent text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-500/20 focus:ring-offset-0",
    link:
      "bg-transparent text-brand-500 p-0 hover:underline hover:bg-transparent h-auto dark:text-brand-400 focus:outline-none",
  };

  // Loading indicator
  const LoadingSpinner = () => (
    <svg
      className="animate-spin -ml-1 mr-2 h-4 w-4"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      ></circle>
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      ></path>
    </svg>
  );

  return (
    <button
      type={type}
      className={`inline-flex items-center justify-center font-medium gap-2 rounded-lg transition ${
        fullWidth ? "w-full" : ""
      } ${className} ${sizeClasses[size]} ${variantClasses[variant]} ${
        disabled || isLoading ? "cursor-not-allowed opacity-50" : ""
      }`}
      onClick={onClick}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading && <LoadingSpinner />}
      {!isLoading && startIcon && <span className="flex items-center">{startIcon}</span>}
      {children}
      {!isLoading && endIcon && <span className="flex items-center">{endIcon}</span>}
    </button>
  );
};

export default Button;