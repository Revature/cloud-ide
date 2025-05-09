"use client";

import React from "react";
import HomeHeader from "@/components/home/HomeHeader";
import HomeFooter from "@/components/home/HomeFooter";

export default function HomeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col">
      <HomeHeader />
      <main className="flex-grow">
        {children}
      </main>
      <HomeFooter />
    </div>
  );
}