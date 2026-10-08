'use client';

import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react';

export interface PaginationBarProps {
  currentPage: number;
  totalPages: number;
  pageSize: number;
  totalItems: number;
  pageSizeOptions?: number[];
  onPageChange: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  className?: string;
}

export default function PaginationBar({
  currentPage,
  totalPages,
  pageSize,
  totalItems,
  pageSizeOptions = [10, 20, 50],
  onPageChange,
  onPageSizeChange,
  className = '',
}: PaginationBarProps) {
  const [jumpInput, setJumpInput] = useState<string>('');

  useEffect(() => {
    setJumpInput('');
  }, [currentPage]);

  if (totalPages <= 0) return null;

  // Build page numbers array with ellipsis
  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (currentPage > 4) {
        pages.push('...');
      }

      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);

      for (let i = start; i <= end; i++) {
        if (!pages.includes(i)) pages.push(i);
      }

      if (currentPage < totalPages - 3) {
        pages.push('...');
      }
      if (!pages.includes(totalPages)) {
        pages.push(totalPages);
      }
    }
    return pages;
  };

  const handleJumpSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const target = parseInt(jumpInput, 10);
    if (!isNaN(target) && target >= 1 && target <= totalPages) {
      onPageChange(target);
      setJumpInput('');
    } else {
      setJumpInput('');
    }
  };

  return (
    <div className={`flex items-center justify-center py-4 ${className}`}>
      <div className="inline-flex items-center flex-wrap gap-2.5 sm:gap-3.5 bg-white border border-[#e2e8f0] shadow-sm rounded-full px-4 sm:px-6 py-2">
        {/* Previous Button */}
        <button
          type="button"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage <= 1}
          aria-label="Previous page"
          className="p-1 rounded-full text-slate-600 hover:text-slate-900 hover:bg-slate-100 disabled:opacity-30 disabled:pointer-events-none transition cursor-pointer"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        {/* Page Numbers */}
        <div className="flex items-center space-x-1">
          {getPageNumbers().map((p, idx) => {
            if (p === '...') {
              return (
                <span key={`dots-${idx}`} className="px-1.5 text-xs text-slate-400 select-none">
                  ...
                </span>
              );
            }

            const pageNum = Number(p);
            const isActive = pageNum === currentPage;

            return (
              <button
                key={`page-${pageNum}`}
                type="button"
                onClick={() => onPageChange(pageNum)}
                className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full text-xs font-medium transition flex items-center justify-center cursor-pointer ${
                  isActive
                    ? 'border border-indigo-400 bg-indigo-100/70 text-indigo-700 font-semibold shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                {pageNum}
              </button>
            );
          })}
        </div>

        {/* Next Button */}
        <button
          type="button"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage >= totalPages}
          aria-label="Next page"
          className="p-1 rounded-full text-slate-600 hover:text-slate-900 hover:bg-slate-100 disabled:opacity-30 disabled:pointer-events-none transition cursor-pointer"
        >
          <ChevronRight className="h-4 w-4" />
        </button>

        {/* Page Size Dropdown */}
        {onPageSizeChange && (
          <div className="relative inline-flex items-center">
            <div className="border border-indigo-300 hover:border-indigo-400 bg-white text-slate-700 text-xs font-medium rounded-full px-3 py-1.5 flex items-center space-x-1.5 transition pointer-events-none">
              <span>{pageSize} / page</span>
              <ChevronDown className="h-3.5 w-3.5 text-indigo-600" />
            </div>
            <select
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              aria-label="Items per page"
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer text-xs"
            >
              {pageSizeOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt} / page
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Go to [input] Page */}
        <form onSubmit={handleJumpSubmit} className="flex items-center space-x-1.5 text-xs text-slate-700">
          <span className="font-normal text-slate-600">Go to</span>
          <input
            type="number"
            min={1}
            max={totalPages}
            value={jumpInput}
            onChange={(e) => setJumpInput(e.target.value)}
            onBlur={() => handleJumpSubmit()}
            placeholder=""
            className="w-12 sm:w-14 h-7 text-center text-xs font-medium border border-indigo-300 rounded-full focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-300/50 bg-white text-slate-800 transition"
          />
          <span className="font-normal text-slate-600">Page</span>
        </form>
      </div>
    </div>
  );
}
