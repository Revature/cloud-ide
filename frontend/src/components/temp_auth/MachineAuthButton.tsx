"use client";
import React, { useState } from "react";
import { fetchAuthToken } from "@/services/fetchAuthToken";
import Button from "@/components/ui/button/Button";

export const MachineAuthButton: React.FC = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleAuth = async () => {
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const response = await fetchAuthToken(username, password); // Pass username and password
      if (response.status === 200) {
        setSuccessMessage("Token successfully set!");
        setIsModalOpen(false);
      } else {
        setErrorMessage("Failed to fetch token. Please check your credentials.");
      }
    } catch {
      setErrorMessage("An error occurred while fetching the token.");
    }
  };

  return (
    <>
      {/* Icon positioned below the tables */}
      <div
        className="fixed bottom-4 right-4 flex items-center justify-center w-10 h-10 text-gray-600 hover:text-green-600 dark:text-gray-300 dark:hover:text-green-400 cursor-pointer"
        onClick={() => setIsModalOpen(true)}
        title="Machine Authentication"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth="1.5"
          stroke="currentColor"
          className="w-6 h-6"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15M12 9l-3 3m0 0 3 3m-3-3h12.75"
          />
        </svg>
      </div>

      {/* Modal for username and password input */}
      {isModalOpen && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
          <div className="bg-white dark:bg-gray-900 rounded-lg p-6 w-96">
            <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">
              Machine Authentication
            </h3>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Username
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-brand-500 focus:ring-brand-500 dark:bg-gray-800 dark:border-gray-700 dark:text-white"
              />
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-brand-500 focus:ring-brand-500 dark:bg-gray-800 dark:border-gray-700 dark:text-white"
              />
            </div>
            {errorMessage && (
              <p className="text-sm text-red-500 mb-4">{errorMessage}</p>
            )}
            {successMessage && (
              <p className="text-sm text-green-500 mb-4">{successMessage}</p>
            )}
            <div className="flex justify-end gap-3">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setIsModalOpen(false)}
              >
                Cancel
              </Button>
              <Button size="sm" variant="primary" onClick={handleAuth}>
                Authenticate
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default MachineAuthButton;