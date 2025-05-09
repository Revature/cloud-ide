"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';

export default function HomeHeader() {
  const [isScrolled, setIsScrolled] = useState(false);

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
            <Link href={`/cloud-connectors/`} className="flex items-center">
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
            {/* Dashboard Link */}
            <Link 
              href="/cloud-connectors/" 
              className="inline-flex items-center justify-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-base font-medium text-white shadow-sm hover:bg-indigo-700"
            >
              Dashboard
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
}