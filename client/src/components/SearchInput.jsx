import { useRef, useEffect } from 'react';

// Completely isolated search input component
function SearchInput({ onSearchChange, placeholder = "Search..." }) {
  const inputRef = useRef(null);
  const timerRef = useRef(null);

  useEffect(() => {
    // Cleanup timer on unmount
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  const handleChange = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    
    timerRef.current = setTimeout(() => {
      const value = inputRef.current?.value || '';
      onSearchChange(value);
    }, 500);
  };

  return (
    <input
      ref={inputRef}
      type="text"
      onChange={handleChange}
      placeholder={placeholder}
      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
    />
  );
}

export default SearchInput;