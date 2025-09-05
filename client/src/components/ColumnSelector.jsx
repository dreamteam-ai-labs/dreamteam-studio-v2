import { useState, useEffect } from 'react';

function ColumnSelector({ columns, selectedColumns, onColumnChange }) {
  const [isOpen, setIsOpen] = useState(false);
  const [localSelected, setLocalSelected] = useState(selectedColumns);

  useEffect(() => {
    setLocalSelected(selectedColumns);
  }, [selectedColumns]);

  const handleToggle = (columnKey) => {
    const newSelected = localSelected.includes(columnKey)
      ? localSelected.filter(key => key !== columnKey)
      : [...localSelected, columnKey];
    setLocalSelected(newSelected);
  };

  const handleApply = () => {
    onColumnChange(localSelected);
    setIsOpen(false);
  };

  const handleCancel = () => {
    setLocalSelected(selectedColumns);
    setIsOpen(false);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="px-3 py-1.5 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-all duration-200 flex items-center gap-2"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        Columns ({localSelected.length})
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />
          <div className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-lg border border-gray-200 z-20">
            <div className="p-3 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-700">Select Columns</h3>
                <div className="flex gap-2">
                  <button
                    onClick={() => setLocalSelected(columns.map(c => c.key))}
                    className="text-xs text-primary-600 hover:text-primary-700"
                  >
                    Select All
                  </button>
                  <span className="text-xs text-gray-400">|</span>
                  <button
                    onClick={() => setLocalSelected(columns.filter(c => c.required).map(c => c.key))}
                    className="text-xs text-primary-600 hover:text-primary-700"
                  >
                    Clear All
                  </button>
                </div>
              </div>
            </div>
            <div className="max-h-96 overflow-y-auto p-3">
              {columns.map(column => (
                <label key={column.key} className="flex items-center py-2 hover:bg-gray-50 px-2 rounded cursor-pointer">
                  <input
                    type="checkbox"
                    checked={localSelected.includes(column.key)}
                    onChange={() => handleToggle(column.key)}
                    className="mr-3 h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                  />
                  <span className="text-sm text-gray-700">{column.label}</span>
                  {column.required && (
                    <span className="ml-auto text-xs text-gray-400">Required</span>
                  )}
                </label>
              ))}
            </div>
            <div className="p-3 border-t border-gray-200 flex justify-end gap-2">
              <button
                onClick={handleCancel}
                className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={handleApply}
                className="px-3 py-1.5 text-sm bg-primary-600 text-white rounded hover:bg-primary-700"
              >
                Apply
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default ColumnSelector;