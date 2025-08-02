'use client';

import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChangeAction: (page: number) => void;
  className?: string;
  showPageNumbers?: boolean;
  maxVisiblePages?: number;
}

export function Pagination({
  currentPage,
  totalPages,
  onPageChangeAction,
  className = '',
  showPageNumbers = true,
  maxVisiblePages = 5,
}: PaginationProps) {
  const getVisiblePages = () => {
    if (totalPages <= maxVisiblePages) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }

    const half = Math.floor(maxVisiblePages / 2);
    let start = Math.max(currentPage - half, 1);
    const end = Math.min(start + maxVisiblePages - 1, totalPages);

    if (end - start + 1 < maxVisiblePages) {
      start = Math.max(end - maxVisiblePages + 1, 1);
    }

    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
  };

  const visiblePages = getVisiblePages();
  const canGoPrevious = currentPage > 1;
  const canGoNext = currentPage < totalPages;

  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages && page !== currentPage) {
      onPageChangeAction(page);
    }
  };

  if (totalPages <= 1) {
    return null;
  }

  return (
    <div className={`flex items-center justify-center space-x-2 ${className}`}>
      {/* Previous Button */}
      <button
        onClick={() => handlePageChange(currentPage - 1)}
        disabled={!canGoPrevious}
        className={`
          flex items-center justify-center w-8 h-8 rounded-md text-sm font-medium transition-all duration-200
          ${
            canGoPrevious
              ? 'text-neutral-400 hover:text-white hover:bg-neutral-700 active:scale-95'
              : 'text-neutral-600 cursor-not-allowed'
          }
        `}
        aria-label="Previous page"
      >
        <ChevronLeftIcon className="h-4 w-4" />
      </button>

      {/* Page Numbers */}
      {showPageNumbers && (
        <>
          {/* First page + ellipsis */}
          {visiblePages[0] > 1 && (
            <>
              <button
                onClick={() => handlePageChange(1)}
                className="flex items-center justify-center w-8 h-8 rounded-md text-sm font-medium text-neutral-400 hover:text-white hover:bg-neutral-700 transition-all duration-200 active:scale-95"
              >
                1
              </button>
              {visiblePages[0] > 2 && <span className="text-neutral-500 text-sm">...</span>}
            </>
          )}

          {/* Visible page numbers */}
          {visiblePages.map((page) => (
            <button
              key={page}
              onClick={() => handlePageChange(page)}
              className={`
                flex items-center justify-center w-8 h-8 rounded-md text-sm font-medium transition-all duration-200 active:scale-95
                ${
                  page === currentPage
                    ? 'bg-white text-black font-semibold shadow-sm'
                    : 'text-neutral-400 hover:text-white hover:bg-neutral-700'
                }
              `}
              aria-label={`Page ${page}`}
              aria-current={page === currentPage ? 'page' : undefined}
            >
              {page}
            </button>
          ))}

          {/* Last page + ellipsis */}
          {visiblePages[visiblePages.length - 1] < totalPages && (
            <>
              {visiblePages[visiblePages.length - 1] < totalPages - 1 && (
                <span className="text-neutral-500 text-sm">...</span>
              )}
              <button
                onClick={() => handlePageChange(totalPages)}
                className="flex items-center justify-center w-8 h-8 rounded-md text-sm font-medium text-neutral-400 hover:text-white hover:bg-neutral-700 transition-all duration-200 active:scale-95"
              >
                {totalPages}
              </button>
            </>
          )}
        </>
      )}

      {/* Next Button */}
      <button
        onClick={() => handlePageChange(currentPage + 1)}
        disabled={!canGoNext}
        className={`
          flex items-center justify-center w-8 h-8 rounded-md text-sm font-medium transition-all duration-200
          ${
            canGoNext
              ? 'text-neutral-400 hover:text-white hover:bg-neutral-700 active:scale-95'
              : 'text-neutral-600 cursor-not-allowed'
          }
        `}
        aria-label="Next page"
      >
        <ChevronRightIcon className="h-4 w-4" />
      </button>
    </div>
  );
}
