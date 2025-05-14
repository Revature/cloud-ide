import React, { ReactNode } from "react";

// Props interfaces for Card, CardTitle, and CardDescription
interface CardProps {
  children?: ReactNode; // Optional additional content
  className?: string; // Optional custom className
}

interface CardTitleProps {
  children: ReactNode;
  className?: string; // Optional custom className
}

interface CardDescriptionProps {
  children: ReactNode;
  className?: string; // Optional custom className
}

// Card Component
const Card: React.FC<CardProps> = ({ children, className }) => {
  return (
    <div
      className={`rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] sm:p-6 ${className}`}
    >
      {children}
    </div>
  );
};

// CardTitle Component
const CardTitle: React.FC<CardTitleProps> = ({ children, className }) => {
  return (
    <h4
      className={`mb-1 font-medium text-gray-800 text-theme-xl dark:text-white/90 ${className}`}
    >
      {children}
    </h4>
  );
};

// CardDescription Component
const CardDescription: React.FC<CardDescriptionProps> = ({ children, className }) => {
  return (
    <p className={`text-sm text-gray-500 dark:text-gray-400 ${className}`}>
      {children}
    </p>
  );
};

// Named exports for better flexibility
export { Card, CardTitle, CardDescription };