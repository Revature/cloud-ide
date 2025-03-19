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
import Toggle from "@/components/form/input/Toggle";
import { useCloudConnectors } from "@/context/CloudConnectorsContext";

export default function CloudConnectorsTable() {
  // Get connectors from context
  const { connectors, updateConnectorStatus } = useCloudConnectors();
  
  // State for current page and items per page
  const [currentPage, setCurrentPage] = useState<number>(1);
  const itemsPerPage = 5; // Set the number of items per page
  
  // Search state
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [filteredConnectors, setFilteredConnectors] = useState(connectors);

  // Router for navigation
  const router = useRouter();

  // Filter connectors when search term changes
  useEffect(() => {
    if (searchTerm.trim() === "") {
      setFilteredConnectors(connectors);
    } else {
      const lowercasedSearch = searchTerm.toLowerCase();
      const results = connectors.filter(
        (connector) =>
          connector.name.toLowerCase().includes(lowercasedSearch) ||
          connector.region.toLowerCase().includes(lowercasedSearch) ||
          connector.type.toLowerCase().includes(lowercasedSearch)
      );
      setFilteredConnectors(results);
    }
    // Reset to first page when search results change
    setCurrentPage(1);
  }, [searchTerm, connectors]);

  // Calculate the indexes for the current page
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;

  // Slice the data for the current page
  const currentItems = filteredConnectors.slice(indexOfFirstItem, indexOfLastItem);

  // Calculate total pages
  const totalPages = Math.max(1, Math.ceil(filteredConnectors.length / itemsPerPage));

  // Handlers for page navigation
  const goToPage = (page: number) => {
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
  
  // Handle toggle state change
  const handleToggleChange = (id: number, enabled: boolean) => {
    updateConnectorStatus(id, enabled);
  };

  // Handle search input change
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
  };
  
  // Find the original index in the connectors array
  const getOriginalIndex = (index: number) => {
    const item = currentItems[index];
    return connectors.findIndex(connector => 
      connector.name === item.name && 
      connector.region === item.region && 
      connector.type === item.type
    );
  };
  
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
                <svg
                  className="fill-gray-500 dark:fill-gray-400"
                  width="20"
                  height="20"
                  viewBox="0 0 20 20"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    fillRule="evenodd"
                    clipRule="evenodd"
                    d="M3.04199 9.37381C3.04199 5.87712 5.87735 3.04218 9.37533 3.04218C12.8733 3.04218 15.7087 5.87712 15.7087 9.37381C15.7087 12.8705 12.8733 15.7055 9.37533 15.7055C5.87735 15.7055 3.04199 12.8705 3.04199 9.37381ZM9.37533 1.54218C5.04926 1.54218 1.54199 5.04835 1.54199 9.37381C1.54199 13.6993 5.04926 17.2055 9.37533 17.2055C11.2676 17.2055 13.0032 16.5346 14.3572 15.4178L17.1773 18.2381C17.4702 18.531 17.945 18.5311 18.2379 18.2382C18.5308 17.9453 18.5309 17.4704 18.238 17.1775L15.4182 14.3575C16.5367 13.0035 17.2087 11.2671 17.2087 9.37381C17.2087 5.04835 13.7014 1.54218 9.37533 1.54218Z"
                    fill=""
                  />
                </svg>
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
                  className="px-4 py-3 font-normal text-gray-500 text-start text-theme-sm dark:text-gray-400 min-w-[150px] w-[150px]"
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
                currentItems.map((item, index) => {
                  const originalIndex = getOriginalIndex(index);
                  return (
                    <TableRow key={index}>
                      <TableCell className="px-4 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 flex items-center justify-center">
                            <ProxyImage
                              width={32}
                              height={32}
                              src={item.image}
                              alt={item.name}
                            />
                          </div>
                          <div>
                            <span 
                              className="block font-medium text-gray-700 text-theme-sm dark:text-gray-400 hover:text-brand-500 dark:hover:text-brand-400 cursor-pointer transition-colors"
                              onClick={() => navigateToViewConnector(originalIndex)}
                            >
                              {item.name}
                            </span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="px-4 py-4 text-gray-700 whitespace-nowrap text-theme-sm dark:text-gray-400">
                        {item.added}
                      </TableCell>
                      <TableCell className="px-4 py-4 text-gray-700 text-theme-sm dark:text-gray-400">
                        {item.region}
                      </TableCell>
                      <TableCell className="px-4 py-4 text-gray-700 text-theme-sm dark:text-gray-400">
                        {item.type}
                      </TableCell>
                      <TableCell className="px-4 py-4 text-gray-700 text-theme-sm dark:text-gray-400 min-w-[150px] w-[150px]">
                        <Toggle
                          enabled={item.active}
                          setEnabled={(enabled) => handleToggleChange(originalIndex, enabled)}
                          label={item.active ? "Active" : "Inactive"}
                        />
                      </TableCell>
                      <TableCell className="px-4 py-4 text-gray-700 text-theme-sm dark:text-gray-400 w-[80px]">
                        <button 
                          onClick={() => navigateToEditConnector(originalIndex)}
                          className="p-2 text-gray-500 hover:text-brand-500 transition-colors"
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
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Pagination Controls */}
      {filteredConnectors.length > 0 && (
        <div className="px-6 py-4 border-t border-gray-200 dark:border-white/[0.05]">
          <div className="flex items-center justify-between">
            {/* Previous Button */}
            <Button
              size="sm"
              variant="outline"
              onClick={() => goToPage(currentPage - 1)}
              disabled={currentPage === 1}
            >
              <svg
                className="fill-current"
                width="20"
                height="20"
                viewBox="0 0 20 20"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  fillRule="evenodd"
                  clipRule="evenodd"
                  d="M2.58301 9.99868C2.58272 10.1909 2.65588 10.3833 2.80249 10.53L7.79915 15.5301C8.09194 15.8231 8.56682 15.8233 8.85981 15.5305C9.15281 15.2377 9.15297 14.7629 8.86018 14.4699L5.14009 10.7472L16.6675 10.7472C17.0817 10.7472 17.4175 10.4114 17.4175 9.99715C17.4175 9.58294 17.0817 9.24715 16.6675 9.24715L5.14554 9.24715L8.86017 5.53016C9.15297 5.23717 9.15282 4.7623 8.85983 4.4695C8.56684 4.1767 8.09197 4.17685 7.79917 4.46984L2.84167 9.43049C2.68321 9.568 2.58301 9.77087 2.58301 9.99715C2.58301 9.99766 2.58301 9.99817 2.58301 9.99868Z"
                  fill=""
                />
              </svg>
              <span className="hidden sm:inline">Previous</span>
            </Button>
            {/* Page Info */}
            <span className="block text-sm font-medium text-gray-700 dark:text-gray-400 sm:hidden">
              Page {currentPage} of {totalPages}
            </span>
            {/* Page Numbers */}
            <ul className="hidden items-center gap-0.5 sm:flex">
              {Array.from({ length: totalPages }).map((_, idx) => (
                <li key={idx}>
                  <button
                    onClick={() => goToPage(idx + 1)}
                    className={`flex h-10 w-10 items-center justify-center rounded-lg text-theme-sm font-medium ${
                      currentPage === idx + 1
                        ? "bg-brand-500 text-white"
                        : "text-gray-700 hover:bg-brand-500/[0.08] dark:hover:bg-brand-500 dark:hover:text-white hover:text-brand-500 dark:text-gray-400 "
                    }`}
                  >
                    {idx + 1}
                  </button>
                </li>
              ))}
            </ul>
            {/* Next Button */}
            <Button
              onClick={() => goToPage(currentPage + 1)}
              size="sm"
              variant="outline"
              disabled={currentPage === totalPages}
            >
              <span className="hidden sm:inline">Next</span>
              <svg
                className="fill-current"
                width="20"
                height="20"
                viewBox="0 0 20 20"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  fillRule="evenodd"
                  clipRule="evenodd"
                  d="M17.4175 9.9986C17.4178 10.1909 17.3446 10.3832 17.198 10.53L12.2013 15.5301C11.9085 15.8231 11.4337 15.8233 11.1407 15.5305C10.8477 15.2377 10.8475 14.7629 11.1403 14.4699L14.8604 10.7472L3.33301 10.7472C2.91879 10.7472 2.58301 10.4114 2.58301 9.99715C2.58301 9.58294 2.91879 9.24715 3.33301 9.24715L14.8549 9.24715L11.1403 5.53016C10.8475 5.23717 10.8477 4.7623 11.1407 4.4695C11.4336 4.1767 11.9085 4.17685 12.2013 4.46984L17.1588 9.43049C17.3173 9.568 17.4175 9.77087 17.4175 9.99715C17.4175 9.99763 17.4175 9.99812 17.4175 9.9986Z"
                  fill=""
                />
              </svg>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}