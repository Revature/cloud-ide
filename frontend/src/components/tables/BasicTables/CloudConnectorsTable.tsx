"use client";
import { useState, useEffect } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "../../ui/table";
import Button from "../../ui/button/Button";
import ProxyImage from "@/components/ui/images/ProxyImage";
import { useRouter } from "next/navigation";
import { CloudConnector } from "@/types";
import {  
  PencilIcon, 
  SearchIcon // You might need to add this to your icons
} from "@/icons";
import { useCloudConnectorQuery } from "@/hooks/api/cloudConnectors/useCloudConnectorsData";
import { CustomPagination } from "@/components/ui/pagination/CustomPagination";

export default function CloudConnectorsTable() {
  // React Query for data fetching
  const { 
    data: connectorsData = [], 
    isLoading, 
    error 
  } = useCloudConnectorQuery()
  
  // Router for navigation
  const router = useRouter();
    
  const [currentPage, setCurrentPage] = useState<number>(1);
  const itemsPerPage = 5;
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [filteredConnectors, setFilteredConnectors] = useState<CloudConnector[]>([]);
  
  // Track if filtered data needs to be updated
  const [dataInitialized, setDataInitialized] = useState(false);
  
  // Initialize filtered data when data loads
  useEffect(() => {
    if (connectorsData.length > 0 && !dataInitialized) {
      setFilteredConnectors(connectorsData);
      setDataInitialized(true);
    }
  }, [connectorsData, dataInitialized]);
  
  // Handle searching - only run when search term changes
  useEffect(() => {
    // Skip if no data or not initialized
    if (connectorsData.length === 0 || !dataInitialized) {
      return;
    }

    if (searchTerm.trim() === "") {
      setFilteredConnectors(connectorsData);
    } else {
      const lowercasedSearch = searchTerm.toLowerCase();
      const results = connectorsData.filter(
        (connector) => {
          if(connector.name){
            return connector.name.toLowerCase().includes(lowercasedSearch) ||
                  (connector.region?.toLowerCase() || '').includes(lowercasedSearch) ||
                  (connector.type?.toLowerCase() || '').includes(lowercasedSearch)
          }
    });
      setFilteredConnectors(results);
    }
  }, [searchTerm, connectorsData, dataInitialized]);

  // Calculate the indexes for the current page
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;

  // Slice the data for the current page
  const currentItems = filteredConnectors.slice(indexOfFirstItem, indexOfLastItem);

  // Calculate total pages
  const totalPages = Math.max(1, Math.ceil(filteredConnectors.length / itemsPerPage));

  // Handlers for page navigation
  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  // Navigate to the add connector page
  const navigateToAddConnector = () => {
    router.push("/cloud-connectors/add");
  };
  
  // Navigate to view connector page
  const navigateToViewConnector = (id: number) => {
    router.push(`/cloud-connectors/view/${id}`);
  };
  
  // Navigate to edit connector page
  const navigateToEditConnector = (id: number) => {
    router.push(`/cloud-connectors/edit/${id}`);
  };

  // Handle search input change
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
  };
  
  // Show loading state
  if (isLoading) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center dark:border-white/[0.05] dark:bg-white/[0.03]">
        <div className="animate-pulse">Loading cloud connectors...</div>
      </div>
    );
  }
  
  // Show error state
  if (error) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center dark:border-white/[0.05] dark:bg-white/[0.03]">
        <div className="text-red-500">
          Error loading cloud connectors: {error instanceof Error ? error.message : 'Unknown error'}
        </div>
      </div>
    );
  }
  
  return (
    <div className="rounded-2xl border border-gray-200 bg-white pt-4 dark:border-white/[0.05] dark:bg-white/[0.03]">
      <div className="flex flex-col gap-2 px-5 mb-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90">
            Cloud Connectors
          </h3>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <form onSubmit={(e) => e.preventDefault()}>
            <div className="relative">
              <button className="absolute -translate-y-1/2 left-4 top-1/2" type="button">
                {/* If you have a SearchIcon */}
                <SearchIcon className="fill-gray-500 dark:fill-gray-400" width={20} height={20} />
              </button>
              <input
                type="text"
                placeholder="Search connectors..."
                className="dark:bg-dark-900 h-[42px] w-full rounded-lg border border-gray-300 bg-transparent py-2.5 pl-[42px] pr-4 text-sm text-gray-800 shadow-theme-xs placeholder:text-gray-400 focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:placeholder:text-white/30 dark:focus:border-brand-800 xl:w-[300px]"
                value={searchTerm}
                onChange={handleSearchChange}
              />
            </div>
          </form>
          <Button size="sm" variant="primary" onClick={navigateToAddConnector}>Add Connector</Button>
        </div>
      </div>

      <div className="overflow-hidden">
        <div className="max-w-full px-5 overflow-x-auto sm:px-6">
          <Table>
            <TableHeader className="border-gray-100 border-y dark:border-white/[0.05]">
              <TableRow>
                <TableCell
                  isHeader
                  className="py-3 font-normal text-gray-500 text-start text-theme-sm dark:text-gray-400"
                >
                  Provider
                </TableCell>
                <TableCell
                  isHeader
                  className="px-4 py-3 font-normal text-gray-500 text-start text-theme-sm dark:text-gray-400"
                >
                  Added
                </TableCell>
                <TableCell
                  isHeader
                  className="px-4 py-3 font-normal text-gray-500 text-start text-theme-sm dark:text-gray-400"
                >
                  Region
                </TableCell>
                <TableCell
                  isHeader
                  className="px-4 py-3 font-normal text-gray-500 text-start text-theme-sm dark:text-gray-400"
                >
                  Type
                </TableCell>
                <TableCell
                  isHeader
                  className="px-4 py-3 font-normal text-gray-500 text-start text-theme-sm dark:text-gray-400"
                >
                  Status
                </TableCell>
                <TableCell
                  isHeader
                  className="px-4 py-3 font-normal text-gray-500 text-start text-theme-sm dark:text-gray-400 w-[80px]"
                >
                  Actions
                </TableCell>
              </TableRow>
            </TableHeader>
            <TableBody className="divide-y divide-gray-100 dark:divide-white/[0.05]">
              {currentItems.length === 0 ? (
                <TableRow>
                  <TableCell className="col-span-6 px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                    No connectors found matching your search.
                  </TableCell>
                </TableRow>
              ) : (
                currentItems.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="px-4 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 flex items-center justify-center">
                          {item.image ? (
                            <ProxyImage
                              width={32}
                              height={32}
                              src={item.image}
                              alt={item.name ? item.name : "default text"}
                            />
                          ) : (
                            <div className="w-8 h-8 bg-gray-200 dark:bg-gray-700 rounded-full flex items-center justify-center">
                              <span className="text-xs text-gray-500 dark:text-gray-400">?</span>
                            </div>
                          )}
                        </div>
                        <div>
                          <span 
                            className="block font-medium text-gray-700 text-theme-sm dark:text-gray-400 hover:text-brand-500 dark:hover:text-brand-400 cursor-pointer transition-colors"
                            onClick={() => item.id !== undefined && navigateToViewConnector(item.id)}
                          >
                            {item.name}
                          </span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="px-4 py-4 text-gray-700 whitespace-nowrap text-theme-sm dark:text-gray-400">
                      {item.createdOn}
                    </TableCell>
                    <TableCell className="px-4 py-4 text-gray-700 text-theme-sm dark:text-gray-400">
                      {item.region}
                    </TableCell>
                    <TableCell className="px-4 py-4 text-gray-700 text-theme-sm dark:text-gray-400">
                      {item.type}
                    </TableCell>
                    <TableCell className="px-4 py-4 text-gray-700 text-theme-sm dark:text-gray-400">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        item.active 
                          ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-500" 
                          : "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300"
                      }`}>
                        {item.active ? "Active" : "Inactive"}
                      </span>
                    </TableCell>
                    <TableCell className="px-4 py-4 text-gray-700 text-theme-sm dark:text-gray-400 w-[80px]">
                      <button 
                        onClick={() => item.id !== undefined && navigateToEditConnector(item.id)}
                        className="p-2 text-gray-500 hover:text-brand-500 transition-colors"
                        title="Edit Connector"
                      >
                        <PencilIcon className="stroke-current" width={20} height={20} />
                      </button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Pagination Controls */}
      {filteredConnectors.length > 0 && (
        <div>
          <div className="mt-4">
            <CustomPagination
              totalItems={filteredConnectors.length}
              itemsPerPage={itemsPerPage}
              currentPage={currentPage}
              onPageChange={handlePageChange}
              // siblingCount={1} // Optional, defaults to 1
              className="my-custom-pagination-styles" // Optional custom styling
            />
          </div>

          {/* Optional: Display current range */}
          <div className="text-center text-sm text-gray-600 dark:text-gray-400 mt-2">
            Showing {Math.min(filteredConnectors.length > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0, filteredConnectors.length)}
            - {Math.min(currentPage * itemsPerPage, filteredConnectors.length)} of {filteredConnectors.length} items
          </div>
      </div>
      )}
      </div>
  
  );
}