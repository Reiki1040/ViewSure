import { useCallback, useState } from 'react';

type PageNavigationProps = {
  currentPage: number;
  totalPages: number;
  disabled?: boolean;
  onPageChange: (page: number) => void;
  className?: string;
};

export const PageNavigation = ({
  currentPage,
  totalPages,
  disabled = false,
  onPageChange,
  className = ''
}: PageNavigationProps) => {
  const [pageInputValue, setPageInputValue] = useState(String(currentPage));

  const handlePageInputCommit = useCallback(() => {
    if (totalPages < 1) return;
    
    const parsed = Number(pageInputValue);
    if (!Number.isFinite(parsed)) return;
    
    const nextPage = Math.min(Math.max(parsed, 1), totalPages);
    onPageChange(nextPage);
  }, [pageInputValue, totalPages, onPageChange]);

  const goToPrevious = useCallback(() => {
    if (currentPage > 1) {
      onPageChange(currentPage - 1);
    }
  }, [currentPage, onPageChange]);

  const goToNext = useCallback(() => {
    if (currentPage < totalPages) {
      onPageChange(currentPage + 1);
    }
  }, [currentPage, totalPages, onPageChange]);

  const goToFirst = useCallback(() => {
    onPageChange(1);
  }, [onPageChange]);

  const goToLast = useCallback(() => {
    onPageChange(totalPages);
  }, [totalPages, onPageChange]);

  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      handlePageInputCommit();
    }
  }, [handlePageInputCommit]);

  // Update input value when currentPage changes
  useState(() => {
    setPageInputValue(String(currentPage));
  });

  if (totalPages <= 1) {
    return null;
  }

  return (
    <div className={`page-navigation ${className}`}>
      <div className="page-navigation__controls">
        <button
          type="button"
          onClick={goToFirst}
          disabled={disabled || currentPage === 1}
          aria-label="最初のページへ"
          className="page-navigation__button"
        >
          ⏮
        </button>
        <button
          type="button"
          onClick={goToPrevious}
          disabled={disabled || currentPage === 1}
          aria-label="前のページへ"
          className="page-navigation__button"
        >
          ⏪
        </button>
        
        <div className="page-navigation__slider">
          <input
            type="range"
            min={1}
            max={totalPages}
            step={1}
            value={currentPage}
            onChange={(event) => onPageChange(Number(event.target.value))}
            disabled={disabled}
            className="page-navigation__range"
          />
          <div className="page-navigation__value">
            {currentPage} / {totalPages}
          </div>
        </div>

        <button
          type="button"
          onClick={goToNext}
          disabled={disabled || currentPage === totalPages}
          aria-label="次のページへ"
          className="page-navigation__button"
        >
          ⏩
        </button>
        <button
          type="button"
          onClick={goToLast}
          disabled={disabled || currentPage === totalPages}
          aria-label="最後のページへ"
          className="page-navigation__button"
        >
          ⏭
        </button>
      </div>

      <div className="page-navigation__jump">
        <input
          type="number"
          min={1}
          max={totalPages}
          value={pageInputValue}
          onChange={(event) => setPageInputValue(event.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          aria-label="移動先のページ番号"
          className="page-navigation__input"
        />
        <button
          type="button"
          onClick={handlePageInputCommit}
          disabled={disabled}
          className="page-navigation__jump-button"
        >
          移動
        </button>
      </div>
    </div>
  );
};