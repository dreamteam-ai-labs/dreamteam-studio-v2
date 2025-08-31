import { memo } from 'react';

// Memoized input component that won't lose focus
export const FilterInput = memo(function FilterInput({ 
  label, 
  value, 
  onChange, 
  placeholder,
  type = 'text',
  ...props 
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
        {...props}
      />
    </div>
  );
});

export const FilterSelect = memo(function FilterSelect({ 
  label, 
  value, 
  onChange, 
  children,
  ...props 
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}
      </label>
      <select
        value={value}
        onChange={onChange}
        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
        {...props}
      >
        {children}
      </select>
    </div>
  );
});