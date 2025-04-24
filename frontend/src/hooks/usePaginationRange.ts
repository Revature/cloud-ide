// hooks/usePaginationRange.ts
import { useMemo } from 'react';

export const DOTS = '...'; // Ellipsis marker

/**
 * Props for the `usePaginationRange` hook.
 *
 * @property totalItems - The total number of items to paginate.
 * @property itemsPerPage - The number of items to display per page.
 * @property siblingCount - The number of sibling pages to show on each side of the current page (default: 1).
 * @property currentPage - The current active page (1-based index).
 */
interface UsePaginationRangeProps {
  totalItems: number;
  itemsPerPage: number;
  siblingCount?: number;
  currentPage: number;
}

/**
 * Generates a range of numbers between the specified start and end values.
 *
 * @param start - The starting number of the range.
 * @param end - The ending number of the range.
 * @returns An array of numbers from `start` to `end` (inclusive).
 */
const range = (start: number, end: number): number[] => {
  const length = end - start + 1;
  return Array.from({ length }, (_, idx) => idx + start);
};

/**
 * A custom React hook for generating a pagination range based on the total number of items,
 * items per page, sibling count, and the current page. The hook calculates the range of page
 * numbers to display, including ellipsis markers (`DOTS`) where necessary.
 *
 * @param props - The properties required to calculate the pagination range.
 * @returns An array representing the pagination range, which may include numbers and `DOTS`.
 */
export const usePaginationRange = ({
  totalItems,
  itemsPerPage,
  siblingCount = 1,
  currentPage,
}: UsePaginationRangeProps): (number | string)[] => {
  const paginationRange = useMemo(() => {
    const totalPageCount = Math.ceil(totalItems / itemsPerPage);

    /**
     * The total number of page numbers to display, including siblings, the first and last pages,
     * the current page, and up to two ellipsis markers.
     */
    const totalPageNumbersToShow = siblingCount + 5;

    if (totalPageCount <= totalPageNumbersToShow) {
      return range(1, totalPageCount);
    }

    const leftSiblingIndex = Math.max(currentPage - siblingCount, 1);
    const rightSiblingIndex = Math.min(currentPage + siblingCount, totalPageCount);

    const shouldShowLeftDots = leftSiblingIndex > 2;
    const shouldShowRightDots = rightSiblingIndex < totalPageCount - 1;

    const firstPageIndex = 1;
    const lastPageIndex = totalPageCount;

    if (!shouldShowLeftDots && shouldShowRightDots) {
      let leftItemCount = Math.max(3 + 2 * siblingCount, currentPage + siblingCount + 1);
      leftItemCount = Math.min(leftItemCount, totalPageCount - 1);

      const leftRange = range(1, leftItemCount);
      return [...leftRange, DOTS, lastPageIndex];
    }

    if (shouldShowLeftDots && !shouldShowRightDots) {
      let rightItemCount = Math.max(3 + 2 * siblingCount, totalPageCount - currentPage + siblingCount + 1);
      rightItemCount = Math.min(rightItemCount, totalPageCount - 1);

      const rightRange = range(totalPageCount - rightItemCount + 1, totalPageCount);
      return [firstPageIndex, DOTS, ...rightRange];
    }

    if (shouldShowLeftDots && shouldShowRightDots) {
      const middleRange = range(leftSiblingIndex, rightSiblingIndex);
      return [firstPageIndex, DOTS, ...middleRange, DOTS, lastPageIndex];
    }

    return range(1, totalPageCount);
  }, [totalItems, itemsPerPage, siblingCount, currentPage]);

  return paginationRange;
};