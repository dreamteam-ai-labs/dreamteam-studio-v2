import { useState, useCallback, useEffect, useRef } from 'react';

/**
 * Custom hook for table features including column resizing and dual scrollbars
 */
export function useTableFeatures(visibleColumns) {
  const scrollRef = useRef(null);
  const topScrollRef = useRef(null);
  const [scrollIndicators, setScrollIndicators] = useState({ left: false, right: false });
  const [columnWidths, setColumnWidths] = useState({});
  const [isResizing, setIsResizing] = useState(false);
  const resizingColumn = useRef(null);
  const startX = useRef(0);
  const startWidth = useRef(0);

  // Calculate equal column widths based on container width
  const calculateEqualWidths = useCallback(() => {
    if (scrollRef.current && visibleColumns.length > 0) {
      const container = scrollRef.current;
      const containerWidth = container.clientWidth;
      // Reserve some width for padding and borders (approximately 20px per column)
      const availableWidth = containerWidth - (visibleColumns.length * 20);
      const columnWidth = Math.max(150, Math.floor(availableWidth / visibleColumns.length));
      
      const newWidths = {};
      visibleColumns.forEach(col => {
        newWidths[col] = columnWidth;
      });
      
      setColumnWidths(newWidths);
    }
  }, [visibleColumns]);

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

  // Column resize handlers with throttling
  const handleMouseDown = useCallback((e, columnKey) => {
    e.preventDefault();
    e.stopPropagation();
    
    const th = e.target.closest('th');
    if (!th) return;
    
    resizingColumn.current = columnKey;
    startX.current = e.pageX;
    startWidth.current = columnWidths[columnKey] || th.offsetWidth;
    setIsResizing(true);
    
    // Add resizing class to body to prevent text selection
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, [columnWidths]);

  const handleMouseMove = useCallback((e) => {
    if (!resizingColumn.current) return;
    
    // Direct update without animation frame for immediate feedback
    // but throttled to prevent excessive re-renders
    const diff = e.pageX - startX.current;
    const newWidth = Math.max(100, startWidth.current + diff);
    
    // Only update if width changed by at least 5 pixels
    const currentWidth = columnWidths[resizingColumn.current] || startWidth.current;
    if (Math.abs(newWidth - currentWidth) >= 5) {
      setColumnWidths(prev => ({
        ...prev,
        [resizingColumn.current]: newWidth
      }));
    }
  }, [columnWidths]);

  const handleMouseUp = useCallback(() => {
    if (resizingColumn.current) {
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

  // Calculate equal widths when columns change
  useEffect(() => {
    calculateEqualWidths();
  }, [calculateEqualWidths]);

  // Update scroll indicators and top scroll width on mount and when columns change
  useEffect(() => {
    checkScroll();
    updateTopScrollWidth();
    
    const handleResize = () => {
      calculateEqualWidths();
      checkScroll();
      updateTopScrollWidth();
    };
    
    window.addEventListener('resize', handleResize);
    
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [checkScroll, updateTopScrollWidth, calculateEqualWidths, visibleColumns]);

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