import { useState, useCallback, memo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getProblems, getProblemsFilterOptions } from '../services/api';
import SearchInput from './SearchInput';
import ColumnSelector from './ColumnSelector';
import { useTableFeatures } from '../hooks/useTableFeatures';
import '../styles/tables.css';

// Define all available columns
const ALL_COLUMNS = [
  { key: 'title', label: 'Title', required: true },
  { key: 'description', label: 'Description', required: false },
  { key: 'cluster_label', label: 'Cluster', required: false },
  { key: 'impact', label: 'Impact', required: false },
  { key: 'industry', label: 'Industry', required: false },
  { key: 'business_size', label: 'Business Size', required: false },
  { key: 'solution_count', label: 'Solutions', required: false },
  { key: 'created_at', label: 'Created', required: false },
];

// Default visible columns
const DEFAULT_COLUMNS = ['title', 'cluster_label', 'impact', 'solution_count', 'created_at'];

// Memoize the entire filters section to prevent re-renders
const FiltersSection = memo(function FiltersSection({ 
  onSearchChange, 
  apiFilters, 
  onFilterChange, 
  onClearFilters,
  filterOptions,
  visibleColumns,
  onColumnChange
}) {
  return (
    <div className="bg-white p-4 rounded-lg shadow mb-4">
      <div className="flex justify-between items-start mb-4">
        <h2 className="text-lg font-semibold text-gray-800">Filters</h2>
        <ColumnSelector 
          columns={ALL_COLUMNS}
          selectedColumns={visibleColumns}
          onColumnChange={onColumnChange}
        />
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Search
          </label>
          <SearchInput 
            onSearchChange={onSearchChange}
            placeholder="Search problems..."
          />
        </div>
        
        {visibleColumns.includes('impact') && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Impact
            </label>
            <select
              value={apiFilters.impact}
              onChange={(e) => onFilterChange('impact', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="">All</option>
              {filterOptions?.impacts?.map(impact => (
                <option key={impact} value={impact}>{impact}</option>
              ))}
            </select>
          </div>
        )}

        {visibleColumns.includes('industry') && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Industry
            </label>
            <select
              value={apiFilters.industry}
              onChange={(e) => onFilterChange('industry', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="">All</option>
              {filterOptions?.industries?.map(industry => (
                <option key={industry} value={industry}>{industry}</option>
              ))}
            </select>
          </div>
        )}

        {visibleColumns.includes('business_size') && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Business Size
            </label>
            <select
              value={apiFilters.business_size}
              onChange={(e) => onFilterChange('business_size', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="">All</option>
              {filterOptions?.business_sizes?.map(size => (
                <option key={size} value={size}>{size}</option>
              ))}
            </select>
          </div>
        )}

        {visibleColumns.includes('cluster_label') && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Cluster
            </label>
            <select
              value={apiFilters.cluster_label}
              onChange={(e) => onFilterChange('cluster_label', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="">All</option>
              {filterOptions?.cluster_labels?.map(label => (
                <option key={label} value={label}>{label}</option>
              ))}
            </select>
          </div>
        )}

        {visibleColumns.includes('solution_count') && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Solutions
            </label>
            <select
              value={apiFilters.has_solutions}
              onChange={(e) => onFilterChange('has_solutions', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="">All</option>
              <option value="true">Has Solutions</option>
              <option value="false">No Solutions</option>
            </select>
          </div>
        )}

        <div className="flex items-end">
          <button
            onClick={onClearFilters}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors"
          >
            Clear Filters
          </button>
        </div>
      </div>
    </div>
  );
});

function ProblemsTable() {
  const [visibleColumns, setVisibleColumns] = useState(DEFAULT_COLUMNS);
  const {
    scrollRef,
    topScrollRef,
    scrollIndicators,
    columnWidths,
    isResizing,
    handleTopScroll,
    handleBottomScroll,
    handleMouseDown,
    updateTopScrollWidth
  } = useTableFeatures(visibleColumns);
  const [apiFilters, setApiFilters] = useState({
    search: '',
    impact: '',
    industry: '',
    business_size: '',
    cluster_label: '',
    has_solutions: '',
    sortBy: 'created_at',
    sortOrder: 'DESC'
  });

  // Fetch filter options from database
  const { data: filterOptions } = useQuery({
    queryKey: ['problems-filter-options'],
    queryFn: getProblemsFilterOptions,
    staleTime: 1000 * 60 * 10, // Cache for 10 minutes
  });

  const { data: problems, isLoading } = useQuery({
    queryKey: ['problems', apiFilters],
    queryFn: () => getProblems(apiFilters),
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    keepPreviousData: true,
  });

  const handleSearchChange = useCallback((value) => {
    setApiFilters(prev => ({...prev, search: value}));
  }, []);

  const handleFilterChange = useCallback((field, value) => {
    setApiFilters(prev => ({...prev, [field]: value}));
  }, []);

  const handleSort = useCallback((field) => {
    setApiFilters(prev => ({
      ...prev,
      sortBy: field,
      sortOrder: prev.sortBy === field && prev.sortOrder === 'DESC' ? 'ASC' : 'DESC'
    }));
  }, []);

  const handleClearFilters = useCallback(() => {
    setApiFilters({
      search: '',
      impact: '',
      industry: '',
      business_size: '',
      cluster_label: '',
      has_solutions: '',
      sortBy: 'created_at',
      sortOrder: 'DESC'
    });
    window.location.reload();
  }, []);

  const handleColumnChange = useCallback((newColumns) => {
    // Ensure at least title column is always visible
    if (!newColumns.includes('title')) {
      newColumns = ['title', ...newColumns];
    }
    setVisibleColumns(newColumns);
    // Update top scroll width after columns change
    setTimeout(updateTopScrollWidth, 0);
  }, [updateTopScrollWidth]);

  const SortIcon = ({ field }) => {
    if (apiFilters.sortBy !== field) {
      return <span className="text-gray-400 ml-1">⇅</span>;
    }
    return apiFilters.sortOrder === 'DESC' ? 
      <span className="ml-1">↓</span> : 
      <span className="ml-1">↑</span>;
  };

  if (isLoading && !problems) {
    return <div className="text-center py-4">Loading problems...</div>;
  }

  return (
    <div>
      {/* Memoized Filters Section */}
      <FiltersSection
        onSearchChange={handleSearchChange}
        apiFilters={apiFilters}
        onFilterChange={handleFilterChange}
        onClearFilters={handleClearFilters}
        filterOptions={filterOptions}
        visibleColumns={visibleColumns}
        onColumnChange={handleColumnChange}
      />

      {/* Table */}
      <div className={`bg-white rounded-lg shadow table-container ${isResizing ? 'resizing' : ''}`}>
        {/* Top scrollbar */}
        <div 
          ref={topScrollRef}
          className="table-scroll-top"
          onScroll={handleTopScroll}
        >
          <div className="table-scroll-top-inner" />
        </div>
        
        {/* Main table container */}
        <div 
          ref={scrollRef}
          className={`table-scroll table-scroll-indicator ${scrollIndicators.left ? 'can-scroll-left' : ''} ${scrollIndicators.right ? 'can-scroll-right' : ''}`}
          onScroll={handleBottomScroll}
        >
          <table className="data-table divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              {visibleColumns.includes('title') && (
                <th 
                  onClick={() => handleSort('title')}
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 resizable-header"
                  style={{ width: columnWidths.title || 'auto' }}
                >
                  <div className="flex items-center">
                    Title
                    <SortIcon field="title" />
                  </div>
                  <div 
                    className="column-resizer"
                    onMouseDown={(e) => handleMouseDown(e, 'title')}
                  />
                </th>
              )}
              
              {visibleColumns.includes('description') && (
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider resizable-header"
                  style={{ width: columnWidths.description || 'auto' }}
                >
                  Description
                  <div 
                    className="column-resizer"
                    onMouseDown={(e) => handleMouseDown(e, 'description')}
                  />
                </th>
              )}
              
              {visibleColumns.includes('cluster_label') && (
                <th 
                  onClick={() => handleSort('cluster_label')}
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 resizable-header"
                  style={{ width: columnWidths.cluster_label || 'auto' }}
                >
                  <div className="flex items-center">
                    Cluster
                    <SortIcon field="cluster_label" />
                  </div>
                  <div 
                    className="column-resizer"
                    onMouseDown={(e) => handleMouseDown(e, 'cluster_label')}
                  />
                </th>
              )}
              
              {visibleColumns.includes('impact') && (
                <th 
                  onClick={() => handleSort('impact')}
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 resizable-header"
                  style={{ width: columnWidths.impact || 'auto' }}
                >
                  <div className="flex items-center">
                    Impact
                    <SortIcon field="impact" />
                  </div>
                  <div 
                    className="column-resizer"
                    onMouseDown={(e) => handleMouseDown(e, 'impact')}
                  />
                </th>
              )}
              
              {visibleColumns.includes('industry') && (
                <th 
                  onClick={() => handleSort('industry')}
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 resizable-header"
                  style={{ width: columnWidths.industry || 'auto' }}
                >
                  <div className="flex items-center">
                    Industry
                    <SortIcon field="industry" />
                  </div>
                  <div 
                    className="column-resizer"
                    onMouseDown={(e) => handleMouseDown(e, 'industry')}
                  />
                </th>
              )}
              
              {visibleColumns.includes('business_size') && (
                <th 
                  onClick={() => handleSort('business_size')}
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 resizable-header"
                  style={{ width: columnWidths.business_size || 'auto' }}
                >
                  <div className="flex items-center">
                    Business Size
                    <SortIcon field="business_size" />
                  </div>
                  <div 
                    className="column-resizer"
                    onMouseDown={(e) => handleMouseDown(e, 'business_size')}
                  />
                </th>
              )}
              
              {visibleColumns.includes('solution_count') && (
                <th 
                  onClick={() => handleSort('solution_count')}
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 resizable-header"
                  style={{ width: columnWidths.solution_count || 'auto' }}
                >
                  <div className="flex items-center">
                    Solutions
                    <SortIcon field="solution_count" />
                  </div>
                  <div 
                    className="column-resizer"
                    onMouseDown={(e) => handleMouseDown(e, 'solution_count')}
                  />
                </th>
              )}
              
              {visibleColumns.includes('created_at') && (
                <th 
                  onClick={() => handleSort('created_at')}
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 resizable-header"
                  style={{ width: columnWidths.created_at || 'auto' }}
                >
                  <div className="flex items-center">
                    Created
                    <SortIcon field="created_at" />
                  </div>
                  <div 
                    className="column-resizer"
                    onMouseDown={(e) => handleMouseDown(e, 'created_at')}
                  />
                </th>
              )}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {problems?.length === 0 ? (
              <tr>
                <td colSpan={visibleColumns.length} className="px-6 py-4 text-center text-gray-500">
                  No problems found matching your filters
                </td>
              </tr>
            ) : (
              problems?.map((problem) => (
                <tr key={problem.id} className="hover:bg-gray-50">
                  {visibleColumns.includes('title') && (
                    <td className="px-6 py-4 cell-title">
                      <div className="text-sm font-medium text-gray-900">
                        {problem.title}
                      </div>
                    </td>
                  )}
                  
                  {visibleColumns.includes('description') && (
                    <td className="px-6 py-4 cell-description">
                      <div className="text-sm text-gray-500">
                        {problem.description?.length > 200 
                          ? `${problem.description.substring(0, 200)}...`
                          : problem.description
                        }
                      </div>
                    </td>
                  )}
                  
                  {visibleColumns.includes('cluster_label') && (
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {problem.cluster_label || 'Unclustered'}
                    </td>
                  )}
                  
                  {visibleColumns.includes('impact') && (
                    <td className="px-6 py-4">
                      <span className={`inline-flex px-2 py-1 text-xs rounded-full ${
                        problem.impact === 'high' ? 'bg-red-100 text-red-800' :
                        problem.impact === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-green-100 text-green-800'
                      }`}>
                        {problem.impact || 'N/A'}
                      </span>
                    </td>
                  )}
                  
                  {visibleColumns.includes('industry') && (
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {problem.industry || 'N/A'}
                    </td>
                  )}
                  
                  {visibleColumns.includes('business_size') && (
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {problem.business_size || 'N/A'}
                    </td>
                  )}
                  
                  {visibleColumns.includes('solution_count') && (
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {problem.solution_count || 0}
                    </td>
                  )}
                  
                  {visibleColumns.includes('created_at') && (
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {new Date(problem.created_at).toLocaleDateString()}
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  );
}

export default ProblemsTable;