import RefreshButton from "@/components/ui/button/RefreshButton";
import { CustomPagination } from "@/components/ui/pagination/CustomPagination";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/components/ui/table";
import ActionsButton from "@/components/ui/buttons/ActionsButton";
import DeleteButton from "@/components/ui/buttons/DeleteButton";
import React, { useMemo, useState, useRef, useEffect } from "react";
import { QueryKey } from "@tanstack/react-query";

interface ColumnDefinition<T> {
  header: string;
  accessor: (item: T) => React.ReactNode; // Function to render cell content
  searchAccessor?: (item: T) => string; // Function to return a searchable string
  className?: string; // Optional class for styling
  filterable?: boolean; // Enable filter dropdown
  filterOptions?: { label: string; value: string }[]; // Options for filter dropdown
  defaultFilterValues?: string[]; // Default enabled filter values
}

interface BaseTableProps<T> {
  data: T[];
  queryKey: QueryKey; // Optional query keys for invalidation
  columns: ColumnDefinition<T>[];
  title: string;
  searchPlaceholder?: string;
  actions?: (item: T) => Record<string, () => void>; // Record of action names and their functions
  onDelete?: (item?: T) => void; // Function to handle delete
  onAddClick?: () => void; // Function to handle Add Button click
  addButtonText?: string; // Text for the Add Button
  itemsPerPage?: number;
}

export function BaseTable<T>({
  data,
  queryKey,
  columns,
  title,
  searchPlaceholder = "Search...",
  actions,
  onDelete,
  onAddClick,
  addButtonText = "Add",
  itemsPerPage = 5,
}: BaseTableProps<T>) {
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");
  const [openDropdownIndex, setOpenDropdownIndex] = useState<number | null>(null);
  const [columnFilters, setColumnFilters] = useState<{ [colIdx: number]: string[] }>(() => {
    const initial: { [colIdx: number]: string[] } = {};
    columns.forEach((col, idx) => {
      if (col.filterable && col.defaultFilterValues) {
        initial[idx] = col.defaultFilterValues;
      }
    });
    return initial;
  });
  const dropdownRefs = useRef<Array<HTMLDivElement | null>>([]);

  // Close filter dropdown on outside click
  useEffect(() => {
    if (openDropdownIndex === null) return;
    function handleClick(event: MouseEvent) {
      const idx = openDropdownIndex;
      if (idx === null) return;
      const ref = dropdownRefs.current[idx];
      if (ref && !ref.contains(event.target as Node)) {
        setOpenDropdownIndex(null);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [openDropdownIndex]);

  // Handle search input
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchTerm(value);
  };

  // Handle filter change
  const handleFilterChange = (colIdx: number, value: string) => {
    setColumnFilters((prev) => {
      const prevValues = prev[colIdx] || [];
      let newValues: string[];
      if (prevValues.includes(value)) {
        newValues = prevValues.filter((v) => v !== value);
      } else {
        newValues = [...prevValues, value];
      }
      return { ...prev, [colIdx]: newValues };
    });
  };

  // Select all filter options for a column
  const handleSelectAll = (colIdx: number) => {
    const opts = columns[colIdx].filterOptions?.map((o) => o.value) || [];
    setColumnFilters((prev) => ({ ...prev, [colIdx]: opts }));
  };
  // Clear all filter options for a column
  const handleClearAll = (colIdx: number) => {
    setColumnFilters((prev) => ({ ...prev, [colIdx]: [] }));
  };

  // Filter data based on search term and column filters
  const filteredData = useMemo(() => {
    let filtered = data;
    // Search filter
    if (searchTerm.trim()) {
      const lowercasedSearch = searchTerm.toLowerCase();
      filtered = filtered.filter((item) =>
        columns.some((col) => {
          const searchValue = col.searchAccessor
            ? col.searchAccessor(item)
            : String(col.accessor(item));
          return searchValue.toLowerCase().includes(lowercasedSearch);
        })
      );
    }
    // Column filters
    columns.forEach((col, idx) => {
      if (col.filterable && columnFilters[idx] && columnFilters[idx].length > 0 && col.filterOptions) {
        filtered = filtered.filter((item) => {
          // Use searchAccessor or accessor for filter value
          const val = col.searchAccessor
            ? col.searchAccessor(item)
            : String(col.accessor(item));
          return columnFilters[idx].includes(val);
        });
      }
    });
    return filtered;
  }, [data, searchTerm, columns, columnFilters]);

  // Paginate data
  const paginatedData = useMemo(() => {
    if(!filteredData || filteredData.length === 0) {
      return filteredData;
    } else { 
      const startIndex = (currentPage - 1) * itemsPerPage;
      return filteredData.slice(startIndex, startIndex + itemsPerPage);
    }
  }, [filteredData, currentPage, itemsPerPage]);

  // Handle page change
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  return (
    <div className="rounded-2xl border border-gray-200 bg-white pt-4 dark:border-white/[0.05] dark:bg-white/[0.03] overflow-visible">
      {/* Header */}
      <div className="flex flex-col gap-2 px-5 mb-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90">
          {title}
        </h3>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <RefreshButton queryKey={queryKey} />
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
      <div className="overflow-visible">
        <div className="max-w-full px-5 overflow-visible sm:px-6 z-18">
          <Table>
            <TableHeader className="border-gray-100 border-y dark:border-white/[0.05]">
              <TableRow>
                {columns.map((col, index) => (
                  <TableCell
                    key={index}
                    isHeader
                    className={`py-3 font-normal text-gray-500 text-start text-theme-sm dark:text-gray-400 ${col.className || ""}`}
                  >
                    <div className="flex items-center gap-2">
                      {col.header}
                      {col.filterable && col.filterOptions && (
                        <div
                          className="relative"
                          ref={(el) => {
                            dropdownRefs.current[index] = el;
                          }}
                        >
                          <button
                            type="button"
                            className="ml-1 p-0.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700"
                            tabIndex={0}
                            aria-label="Filter column"
                            onClick={() => setOpenDropdownIndex(index === openDropdownIndex ? null : index)}
                          >
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              fill="none"
                              viewBox="0 0 24 24"
                              strokeWidth="1.5"
                              stroke="currentColor"
                              className="w-4 h-4 text-gray-500 dark:text-gray-300"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="m19.5 8.25-7.5 7.5-7.5-7.5"
                              />
                            </svg>
                          </button>
                          {openDropdownIndex === index && (
                            <div className="absolute left-0 z-20 mt-1 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded shadow-lg min-w-[180px] p-2">
                              <div className="flex justify-between mb-1">
                                <button type="button" className="text-xs text-blue-600 hover:underline" onClick={() => handleSelectAll(index)}>
                                  Select All
                                </button>
                                <button type="button" className="text-xs text-red-600 hover:underline" onClick={() => handleClearAll(index)}>
                                  Clear All
                                </button>
                              </div>
                              <div className="max-h-40 overflow-visible overflow-y-auto">
                                {col.filterOptions.map((opt) => (
                                  <label key={opt.value} className="flex items-center gap-2 text-sm py-1 cursor-pointer">
                                    <input
                                      type="checkbox"
                                      checked={columnFilters[index]?.includes(opt.value) || false}
                                      onChange={() => handleFilterChange(index, opt.value)}
                                      className="accent-brand-500"
                                    />
                                    {opt.label}
                                  </label>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
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
                    No {title} found based on the default filters. Try adjusting filters or adding a new {title.toLowerCase().slice(0,-1)} to get started.
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
                      <TableCell className="px-4 py-4 text-gray-700 text-theme-sm dark:text-gray-400 w-[80px] overflow-visible">
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