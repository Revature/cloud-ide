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
import { useRouter } from "next/navigation";
import ProxyImage from "@/components/ui/images/ProxyImage";
import { CloudConnector } from "@/types";
import { useCloudConnectorQuery } from "@/hooks/api/cloudConnectors/useCloudConnectorsData";
import { CustomPagination } from "@/components/ui/pagination/CustomPagination";
import RefreshButton from "@/components/ui/button/RefreshButton";

export default function CloudConnectorsTable() {
  const { data: connectorsData = [], isLoading, error } = useCloudConnectorQuery();
  const router = useRouter();

  const [currentPage, setCurrentPage] = useState<number>(1);
  const itemsPerPage = 5;
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [filteredConnectors, setFilteredConnectors] = useState<CloudConnector[]>([]);
  const [dataInitialized, setDataInitialized] = useState(false);

  useEffect(() => {
    if (connectorsData.length > 0 && !dataInitialized) {
      setFilteredConnectors(connectorsData);
      setDataInitialized(true);
    }
  }, [connectorsData, dataInitialized]);

  useEffect(() => {
    if (connectorsData.length === 0 || !dataInitialized) return;

    if (searchTerm.trim() === "") {
      setFilteredConnectors(connectorsData);
    } else {
      const lowercasedSearch = searchTerm.toLowerCase();
      const results = connectorsData.filter((connector) =>
        connector.name?.toLowerCase().includes(lowercasedSearch) ||
        connector.region?.toLowerCase().includes(lowercasedSearch) ||
        connector.type?.toLowerCase().includes(lowercasedSearch)
      );
      setFilteredConnectors(results);
    }
  }, [searchTerm, connectorsData, dataInitialized]);

  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = filteredConnectors.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.max(1, Math.ceil(filteredConnectors.length / itemsPerPage));

  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  // Navigate to view connector page
  const navigateToViewConnector = (id: number) => {
    router.push(`/cloud-connectors/view/${id}`);
  };
  
  const navigateToEditConnector = (id: number) => {
    router.push(`/cloud-connectors/edit/${id}`);
  };

  const handleDeleteConnector = (id: number) => {
    // Add your delete logic here
    console.log(`Delete connector with ID: ${id}`);
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
  };

  if (isLoading) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center dark:border-white/[0.05] dark:bg-white/[0.03]">
        <div className="animate-pulse">Loading cloud connectors...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center dark:border-white/[0.05] dark:bg-white/[0.03]">
        <div className="text-red-500">
          Error loading cloud connectors: {error.message}
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
          <RefreshButton queryKeys={["cloud-connectors"]} />
          <form onSubmit={(e) => e.preventDefault()} className="flex-grow">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth="1.5"
                  stroke="currentColor"
                  className="w-5 h-5 text-gray-400 dark:text-gray-500"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M21 21l-4.35-4.35m0 0a7.5 7.5 0 1 0-10.6 0 7.5 7.5 0 0 0 10.6 0z"
                  />
                </svg>
              </div>
              <input
                type="text"
                placeholder="Search connectors..."
                className="dark:bg-dark-900 h-[42px] w-full rounded-lg border border-gray-300 bg-transparent py-2.5 pl-[42px] pr-4 text-sm text-gray-800 shadow-theme-xs placeholder:text-gray-400 focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:placeholder:text-white/30 dark:focus:border-brand-800 xl:w-[300px]"
                value={searchTerm}
                onChange={handleSearchChange}
              />
            </div>
          </form>
          <Button size="sm" variant="primary" onClick={() => router.push("/cloud-connectors/add")}>Add Connector</Button>
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
                    <TableCell className="px-4 py-4 text-gray-700 text-theme-sm dark:text-gray-400">
                      {item.createdOn}
                    </TableCell>
                    <TableCell className="px-4 py-4 text-gray-700 text-theme-sm dark:text-gray-400">
                      {item.region}
                    </TableCell>
                    <TableCell className="px-4 py-4 text-gray-700 text-theme-sm dark:text-gray-400 w-[80px]">
                      <div className="flex items-center gap-2">
                        {/* Edit Button */}
                        <button
                          onClick={() => navigateToEditConnector(item.id)}
                          className="p-2 text-gray-500 hover:text-blue-500 transition-colors"
                          title="Edit Connector"
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

                        {/* Delete Button */}
                        <button
                          onClick={() => handleDeleteConnector(item.id)}
                          className="p-2 text-gray-500 hover:text-red-500 transition-colors"
                          title="Delete Connector"
                        >
                        <svg
                            width="20"
                            height="20"
                            viewBox="0 0 20 20"
                            fill="none"
                            xmlns="http://www.w3.org/2000/svg"
                          >
                            <path
                              fillRule="evenodd"
                              clipRule="evenodd"
                              d="M6.54142 3.7915C6.54142 2.54886 7.54878 1.5415 8.79142 1.5415H11.2081C12.4507 1.5415 13.4581 2.54886 13.4581 3.7915V4.0415H15.6252H16.666C17.0802 4.0415 17.416 4.37729 17.416 4.7915C17.416 5.20572 17.0802 5.5415 16.666 5.5415H16.3752V8.24638V13.2464V16.2082C16.3752 17.4508 15.3678 18.4582 14.1252 18.4582H5.87516C4.63252 18.4582 3.62516 17.4508 3.62516 16.2082V13.2464V8.24638V5.5415H3.3335C2.91928 5.5415 2.5835 5.20572 2.5835 4.7915C2.5835 4.37729 2.91928 4.0415 3.3335 4.0415H4.37516H6.54142V3.7915ZM14.8752 13.2464V8.24638V5.5415H13.4581H12.7081H7.29142H6.54142H5.12516V8.24638V13.2464V16.2082C5.12516 16.6224 5.46095 16.9582 5.87516 16.9582H14.1252C14.5394 16.9582 14.8752 16.6224 14.8752 16.2082V13.2464ZM8.04142 4.0415H11.9581V3.7915C11.9581 3.37729 11.6223 3.0415 11.2081 3.0415H8.79142C8.37721 3.0415 8.04142 3.37729 8.04142 3.7915V4.0415ZM8.3335 7.99984C8.74771 7.99984 9.0835 8.33562 9.0835 8.74984V13.7498C9.0835 14.1641 8.74771 14.4998 8.3335 14.4998C7.91928 14.4998 7.5835 14.1641 7.5835 13.7498V8.74984C7.5835 8.33562 7.91928 7.99984 8.3335 7.99984ZM12.4168 8.74984C12.4168 8.33562 12.081 7.99984 11.6668 7.99984C11.2526 7.99984 10.9168 8.33562 10.9168 8.74984V13.7498C10.9168 14.1641 11.2526 14.4998 11.6668 14.4998C12.081 14.4998 12.4168 14.1641 12.4168 13.7498V8.74984Z"
                              fill="currentColor"
                            />
                          </svg>
                        </button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {filteredConnectors.length > 0 && (
        <div className="mt-4">
          <CustomPagination
            totalItems={filteredConnectors.length}
            itemsPerPage={itemsPerPage}
            currentPage={currentPage}
            onPageChange={handlePageChange}
          />
        </div>
      )}
    </div>
  );
}