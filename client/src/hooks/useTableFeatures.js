import { useState, useCallback, useEffect, useRef } from 'react';

/**
 * Custom hook for table features including column resizing and dual scrollbars
 */
export function useTableFeatures(visibleColumns, initialWidths = {}) {
  const scrollRef = useRef(null);
  const topScrollRef = useRef(null);
  const [scrollIndicators, setScrollIndicators] = useState({ left: false, right: false });
  const [columnWidths, setColumnWidths] = useState(() => {
    // Initialize with the provided initial widths immediately
    return { ...initialWidths };
  });
  const [isResizing, setIsResizing] = useState(false);
  const resizingColumn = useRef(null);
  const startX = useRef(0);
  const startWidth = useRef(0);
  
  
  // Store user-resized columns to preserve them
  const userResizedColumns = useRef(new Set());

  // Initialize column widths only for new columns (preserve user resizes)
  const initializeColumnWidths = useCallback(() => {
    setColumnWidths(prev => {
      const newWidths = { ...prev };
      
      // Only set width for columns that haven't been user-resized and don't have a width
      visibleColumns.forEach(col => {
        if (!userResizedColumns.current.has(col) && !newWidths[col]) {
          // Use initial width from config if provided
          newWidths[col] = initialWidths[col] || 150;
        }
      });
      
      return newWidths;
    });
  }, [visibleColumns, initialWidths]);

  // Check scroll position for indicators
  const checkScroll = useCallback(() => {
    if (scrollRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
      setScrollIndicators({
        left: scrollLeft > 0,
        right: scrollLeft < scrollWidth - clientWidth - 1
      });
    }
  }, []);

  // Sync scroll positions between top and bottom scrollbars
  const handleTopScroll = useCallback(() => {
    if (scrollRef.current && topScrollRef.current) {
      scrollRef.current.scrollLeft = topScrollRef.current.scrollLeft;
      checkScroll();
    }
  }, [checkScroll]);

  const handleBottomScroll = useCallback(() => {
    if (scrollRef.current && topScrollRef.current) {
      topScrollRef.current.scrollLeft = scrollRef.current.scrollLeft;
      checkScroll();
    }
  }, [checkScroll]);

  // Update top scrollbar width when table width changes
  const updateTopScrollWidth = useCallback(() => {
    if (scrollRef.current && topScrollRef.current) {
      const table = scrollRef.current.querySelector('table');
      if (table) {
        const scrollInner = topScrollRef.current.querySelector('.table-scroll-top-inner');
        if (scrollInner) {
          scrollInner.style.width = `${table.scrollWidth}px`;
        }
      }
    }
  }, []);

  // Column resize handlers
  const handleMouseDown = useCallback((e, columnKey) => {
    e.preventDefault();
    e.stopPropagation();
    
    const th = e.target.closest('th');
    if (!th) return;
    
    resizingColumn.current = columnKey;
    startX.current = e.pageX;
    // Use the actual width from the element if columnWidths doesn't have it yet
    // Parse the width from style or use offsetWidth
    const currentWidth = columnWidths[columnKey] || 
                        parseInt(th.style.width) || 
                        th.offsetWidth;
    startWidth.current = currentWidth;
    setIsResizing(true);
    
    // Add resizing class to body to prevent text selection
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, [columnWidths]);

  const handleMouseMove = useCallback((e) => {
    if (!resizingColumn.current) return;
    
    const diff = e.pageX - startX.current;
    const newWidth = Math.max(80, startWidth.current + diff);
    
    setColumnWidths(prev => ({
      ...prev,
      [resizingColumn.current]: newWidth
    }));
  }, []);

  const handleMouseUp = useCallback(() => {
    if (resizingColumn.current) {
      // Mark this column as user-resized
      userResizedColumns.current.add(resizingColumn.current);
      
      resizingColumn.current = null;
      setIsResizing(false);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      
      // Update top scroll width after resize
      setTimeout(updateTopScrollWidth, 0);
    }
  }, [updateTopScrollWidth]);

  // Set up resize listeners
  useEffect(() => {
    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isResizing, handleMouseMove, handleMouseUp]);

  // Initialize column widths when columns change
  useEffect(() => {
    // Only initialize if we don't have widths yet
    setColumnWidths(prev => {
      const hasWidths = Object.keys(prev).length > 0;
      if (!hasWidths && Object.keys(initialWidths).length > 0) {
        return { ...initialWidths };
      }
      return prev;
    });
  }, [initialWidths]);

  // Update scroll indicators and top scroll width on mount and when columns change
  useEffect(() => {
    checkScroll();
    updateTopScrollWidth();
    
    const handleResize = () => {
      checkScroll();
      updateTopScrollWidth();
    };
    
    window.addEventListener('resize', handleResize);
    
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [checkScroll, updateTopScrollWidth, visibleColumns]);

  return {
    scrollRef,
    topScrollRef,
    scrollIndicators,
    columnWidths,
    isResizing,
    handleTopScroll,
    handleBottomScroll,
    handleMouseDown,
    checkScroll,
    updateTopScrollWidth
  };
}