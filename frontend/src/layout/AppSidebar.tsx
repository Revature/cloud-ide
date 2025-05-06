"use client";
import React from "react";
import Link from "next/link";
import ProxyImage from "@/components/ui/images/ProxyImage";
import { usePathname } from "next/navigation";
import { useSidebar } from "../context/SidebarContext";
import {
  RunnerIcon,
  CloudIcon,
  ImageIcon,
} from "../icons/index";
import { RunnerPoolIcon } from "@/components/ui/icons/CustomIcons";

type NavItem = {
  name: string;
  icon: React.ReactNode;
  path: string;
};

const navItems: NavItem[] = [
  {
    icon: <CloudIcon />,
    name: "Cloud Connectors",
    path: "/cloud-connectors",
  },
  {
    icon: <ImageIcon />,
    name: "Images",
    path: "/images",
  },
  {
    icon: <RunnerIcon />,
    name: "Runners",
    path: "/runners",
  },
  {
    icon: <RunnerPoolIcon />,
    name: "Runner Pools",
    path: "/runner-pools",
  },
];

const AppSidebar: React.FC = () => {
  const { isExpanded, isMobileOpen, isHovered, setIsHovered } = useSidebar();
  const pathname = usePathname();

  const isActive = (path: string) => path === pathname;

  return (
    <aside
      className={`fixed mt-16 flex flex-col lg:mt-0 top-0 px-5 left-0 bg-white dark:bg-gray-900 dark:border-gray-800 text-gray-900 h-full transition-all duration-300 ease-in-out z-50 border-r border-gray-200 
        ${
          isExpanded || isMobileOpen
            ? "w-[290px]"
            : isHovered
            ? "w-[290px]"
            : "w-[90px]"
        }
        ${isMobileOpen ? "translate-x-0" : "-translate-x-full"}
        lg:translate-x-0`}
      onMouseEnter={() => !isExpanded && setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div
        className={`py-8 flex  ${
          !isExpanded && !isHovered ? "lg:justify-center" : "justify-start"
        }`}
      >
        <Link href="/">
          {isExpanded || isHovered || isMobileOpen ? (
            <>
              <ProxyImage
                className="dark:hidden"
                src="images/brand/revature-logo.svg"
                alt="Logo"
                width={150}
                height={40}
              />
              <ProxyImage
                className="hidden dark:block"
                src="images/brand/revature-logo.svg"
                alt="Logo"
                width={150}
                height={40}
              />
            </>
          ) : (
            <ProxyImage
              src="images/brand/revature-logo.svg"
              alt="Logo"
              width={32}
              height={32}
            />
          )}
        </Link>
      </div>
      <div className="flex flex-col overflow-y-auto duration-300 ease-linear no-scrollbar">
        <nav className="mb-6">
          <div className="flex flex-col gap-4">
            <div>
              <h2
                className={`mb-4 text-xs uppercase flex leading-[20px] text-gray-400 ${
                  !isExpanded && !isHovered ? "lg:justify-center" : "justify-start"
                }`}
              >
                Menu
              </h2>
              <ul className="flex flex-col gap-4">
                {navItems.map((nav) => (
                  <li key={nav.name}>
                    <Link
                      href={nav.path}
                      className={`menu-item group ${
                        isActive(nav.path) ? "menu-item-active" : "menu-item-inactive"
                      }`}
                    >
                      <span
                        className={`${
                          isActive(nav.path)
                            ? "menu-item-icon-active"
                            : "menu-item-icon-inactive"
                        }`}
                      >
                        {nav.icon}
                      </span>
                      {(isExpanded || isHovered || isMobileOpen) && (
                        <span className={`menu-item-text`}>{nav.name}</span>
                      )}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </nav>
      </div>
    </aside>
  );
};

export default AppSidebar;