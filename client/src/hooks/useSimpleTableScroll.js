import { useState, useCallback, useEffect, useRef } from 'react';

/**
 * Simplified hook for table scrolling without resizing functionality
 */
export function useSimpleTableScroll() {
  const scrollRef = useRef(null);
  const topScrollRef = useRef(null);
  const [scrollIndicators, setScrollIndicators] = useState({ left: false, right: false });

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

  // Update on mount
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
  }, [checkScroll, updateTopScrollWidth]);

  return {
    scrollRef,
    topScrollRef,
    scrollIndicators,
    handleTopScroll,
    handleBottomScroll,
    updateTopScrollWidth
  };
}