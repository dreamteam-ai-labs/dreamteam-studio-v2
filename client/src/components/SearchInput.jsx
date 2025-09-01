import { useState, useEffect } from 'react';

// Controlled search input component with debouncing
function SearchInput({ value = '', onSearchChange, placeholder = "Search..." }) {
  const [localValue, setLocalValue] = useState(value);
  const [timer, setTimer] = useState(null);

  // Update local value when prop changes
  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  useEffect(() => {
    // Cleanup timer on unmount
    return () => {
      if (timer) {
        clearTimeout(timer);
      }
    };
  }, [timer]);

  const handleChange = (e) => {
    const newValue = e.target.value;
    setLocalValue(newValue);
    
    // Clear existing timer
    if (timer) {
      clearTimeout(timer);
    }
    
    // Set new timer for debounced callback
    const newTimer = setTimeout(() => {
      onSearchChange(newValue);
    }, 300);
    
    setTimer(newTimer);
  };

  return (
    <input
      type="text"
      value={localValue}
      onChange={handleChange}
      placeholder={placeholder}
      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
    />
  );
}

export default SearchInput;