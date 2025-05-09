import RefreshButton from "@/components/ui/button/RefreshButton";
import { CustomPagination } from "@/components/ui/pagination/CustomPagination";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/components/ui/table";
import ActionsButton from "@/components/ui/buttons/ActionsButton";
import DeleteButton from "@/components/ui/buttons/DeleteButton";
import React, { useMemo, useState } from "react";

interface ColumnDefinition<T> {
  header: string;
  accessor: (item: T) => React.ReactNode; // Function to render cell content
  searchAccessor?: (item: T) => string; // Function to return a searchable string
  className?: string; // Optional class for styling
}

interface BaseTableProps<T> {
  data: T[];
  queryKeys: string[]; // Optional query keys for invalidation
  columns: ColumnDefinition<T>[];
  title: string;
  searchPlaceholder?: string;
  onSearchChange?: (searchTerm: string) => void;
  actions?: (item: T) => Record<string, () => void>; // Record of action names and their functions
  onDelete?: (item: T) => void; // Function to handle delete
  onAddClick?: () => void; // Function to handle Add Button click
  addButtonText?: string; // Text for the Add Button
  itemsPerPage?: number;
}

export function BaseTable<T>({
  data,
  queryKeys,
  columns,
  title,
  searchPlaceholder = "Search...",
  onSearchChange,
  actions,
  onDelete,
  onAddClick,
  addButtonText = "Add",
  itemsPerPage = 5,
}: BaseTableProps<T>) {
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");

  // Handle search input
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchTerm(value);
    if (onSearchChange) {
      onSearchChange(value);
    }
  };

  // Filter data based on search term
  const filteredData = useMemo(() => {
  if (!searchTerm.trim()) return data;
  const lowercasedSearch = searchTerm.toLowerCase();
  return data.filter((item) =>
    columns.some((col) => {
      const searchValue = col.searchAccessor
        ? col.searchAccessor(item)
        : String(col.accessor(item));
      return searchValue.toLowerCase().includes(lowercasedSearch);
    })
  );
}, [data, searchTerm, columns]);

  // Paginate data
  const paginatedData = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredData.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredData, currentPage, itemsPerPage]);

  // Handle page change
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  return (
    <div className="rounded-2xl border border-gray-200 bg-white pt-4 dark:border-white/[0.05] dark:bg-white/[0.03]">
      {/* Header */}
      <div className="flex flex-col gap-2 px-5 mb-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90">
          {title}
        </h3>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <RefreshButton queryKeys={queryKeys} />
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
                placeholder={searchPlaceholder}
                className="dark:bg-dark-900 h-[42px] w-full rounded-lg border border-gray-300 bg-transparent py-2.5 pl-[42px] pr-4 text-sm text-gray-800 shadow-theme-xs placeholder:text-gray-400 focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:placeholder:text-white/30 dark:focus:border-brand-800 xl:w-[300px]"
                value={searchTerm}
                onChange={handleSearchChange}
              />
            </div>
          </form>
          {onAddClick && (
            <button
              onClick={onAddClick}
              className="px-4 py-2 text-sm font-medium text-white bg-brand-500 rounded-lg hover:bg-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900"
            >
              {addButtonText}
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden">
        <div className="max-w-full px-5 overflow-x-auto sm:px-6">
          <Table>
            <TableHeader className="border-gray-100 border-y dark:border-white/[0.05]">
              <TableRow>
                {columns.map((col, index) => (
                  <TableCell
                    key={index}
                    isHeader
                    className={`py-3 font-normal text-gray-500 text-start text-theme-sm dark:text-gray-400 ${
                      col.className || ""
                    }`}
                  >
                    {col.header}
                  </TableCell>
                ))}
                {(actions || onDelete) && (
                  <TableCell
                    isHeader
                    className="py-3 font-normal text-gray-500 text-start text-theme-sm dark:text-gray-400 w-[80px]"
                  >
                    Actions
                  </TableCell>
                )}
              </TableRow>
            </TableHeader>
            <TableBody className="divide-y divide-gray-100 dark:divide-white/[0.05]">
              {paginatedData.length === 0 ? (
                <TableRow>
                  <TableCell
                    className="px-4 py-8 text-center text-gray-500 dark:text-gray-400"
                  >
                    No data found.
                  </TableCell>
                </TableRow>
              ) : (
                paginatedData.map((item, rowIndex) => (
                  <TableRow key={rowIndex}>
                    {columns.map((col, colIndex) => (
                      <TableCell
                        key={colIndex}
                        className={`px-4 py-4 text-gray-700 text-theme-sm dark:text-gray-400 ${
                          col.className || ""
                        }`}
                      >
                        {col.accessor(item)}
                      </TableCell>
                    ))}
                    {(actions || onDelete) && (
                      <TableCell className="px-4 py-4 text-gray-700 text-theme-sm dark:text-gray-400 w-[80px]">
                        <div className="flex gap-2">
                          {actions && <ActionsButton actions={actions(item)} />}
                          {onDelete && (
                            <DeleteButton
                              onConfirm={() => onDelete(item)}
                              title="Delete"
                            />
                          )}
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Pagination */}
      {filteredData.length > itemsPerPage && (
        <div className="mt-4">
          <CustomPagination
            totalItems={filteredData.length}
            itemsPerPage={itemsPerPage}
            currentPage={currentPage}
            onPageChange={handlePageChange}
          />
        </div>
      )}
    </div>
  );
}