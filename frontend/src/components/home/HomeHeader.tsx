"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useAuth } from "@workos-inc/authkit-nextjs/components";

export default function HomeHeader() {
  const [isScrolled, setIsScrolled] = useState(false);
  
  // Use AuthKit hook to get authentication state and auth functions
  const { user } = useAuth();

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };
    
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <header className={`fixed top-0 w-full z-30 transition-all duration-300 ${
      isScrolled ? 'bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm shadow-sm' : 'bg-transparent'
    }`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center py-4">
          <div className="flex items-center">
            <Link href={`/home`} className="flex items-center">
              <div className="h-10 w-10 relative overflow-hidden rounded-md">
                <Image 
                  src="https://raw.githubusercontent.com/AshokaShringla/res-images/refs/heads/main/revature-logo.jpeg" 
                  alt="Revature Logo" 
                  width={40} 
                  height={40}
                  className="object-cover"
                />
              </div>
              <span className="ml-3 text-xl font-bold text-gray-900 dark:text-white">Cloud IDE</span>
            </Link>
          </div>
          
          <div className="flex items-center space-x-4">
            {user ? (
              <>
                {/* Welcome message for authenticated users */}
                <div className="hidden md:block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Welcome {user?.email || 'User'}
                </div>
                
                {/* Dashboard Link for authenticated users */}
                <Link 
                  href={`/cloud-connectors`} 
                  className="inline-flex items-center justify-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-base font-medium text-white shadow-sm hover:bg-indigo-700"
                >
                  Cloud Connectors
                </Link>
              </>
            ) : (
                <Link 
                    href={`/cloud-connectors`} 
                    className="inline-flex items-center justify-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-base font-medium text-white shadow-sm hover:bg-indigo-700"
                  >
                    Sign In
                  </Link>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}