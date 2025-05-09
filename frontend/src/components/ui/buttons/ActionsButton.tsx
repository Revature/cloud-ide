import React, { useState, useRef, useEffect } from "react";

interface ActionsButtonProps {
  actions: Record<string, () => void>; // Action names and their associated functions
  title?: string; // Tooltip or button title
}

const ActionsButton: React.FC<ActionsButtonProps> = ({ actions, title = "Actions" }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const toggleMenu = () => {
    setIsOpen((prev) => !prev);
  };

  const handleActionClick = (action: () => void) => {
    action(); // Execute the associated function
    setIsOpen(false); // Close the menu after an action is clicked
  };

  const handleMouseLeave = () => {
    // Set a timeout to close the dropdown after 3 seconds
    dropdownTimeoutRef.current = setTimeout(() => {
      setIsOpen(false);
    }, 3000);
  };

  const handleMouseEnter = () => {
    // Clear the timeout if the mouse re-enters the dropdown
    if (dropdownTimeoutRef.current) {
      clearTimeout(dropdownTimeoutRef.current);
      dropdownTimeoutRef.current = null;
    }
  };

  useEffect(() => {
    // Cleanup timeout on component unmount
    return () => {
      if (dropdownTimeoutRef.current) {
        clearTimeout(dropdownTimeoutRef.current);
      }
    };
  }, []);

  return (
    <div className="relative">
      {/* Button to toggle the dropdown */}
      <button
        onClick={toggleMenu}
        className="p-2 text-gray-500 hover:text-brand-500 transition-colors"
        title={title}
      >
        <svg 
          width="20" 
          height="20" 
          viewBox="0 0 24 24" 
          fill="none" 
          xmlns="http://www.w3.org/2000/svg"
          className="stroke-current"
        >
          <path 
            d="M11 4H4C3.46957 4 2.96086 4.21071 2.58579 4.58579C2.21071 4.96086 2 5.46957 2 6V20C2 20.5304 2.21071 21.0391 2.58579 21.4142C2.96086 21.7893 3.46957 22 4 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V13" 
            strokeWidth="2" 
            strokeLinecap="round" 
            strokeLinejoin="round"
          />
          <path 
            d="M18.5 2.50001C18.8978 2.10219 19.4374 1.87869 20 1.87869C20.5626 1.87869 21.1022 2.10219 21.5 2.50001C21.8978 2.89784 22.1213 3.4374 22.1213 4.00001C22.1213 4.56262 21.8978 5.10219 21.5 5.50001L12 15L8 16L9 12L18.5 2.50001Z" 
            strokeWidth="2" 
            strokeLinecap="round" 
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {/* Dropdown menu */}
      {isOpen && (
        <div
          className="absolute right-0 z-10 mt-2 w-40 bg-white border border-gray-200 rounded-lg shadow-lg dark:bg-gray-800 dark:border-gray-700"
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        >
          <ul className="py-1">
            {Object.entries(actions).map(([actionName, actionFn]) => (
              <li key={actionName}>
                <button
                  onClick={() => handleActionClick(actionFn)}
                  className="block w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
                >
                  {actionName}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default ActionsButton;