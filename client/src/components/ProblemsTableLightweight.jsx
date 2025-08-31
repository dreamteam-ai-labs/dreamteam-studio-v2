import { useState, useCallback, memo, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getProblems, getProblemsFilterOptions, getSolutionsByCluster } from '../services/api';
import SearchInput from './SearchInput';
import ColumnSelector from './ColumnSelector';
import { useSimpleTableScroll } from '../hooks/useSimpleTableScroll';
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

// Simple expansion content - only render when expanded
const ExpansionContent = memo(function ExpansionContent({ problem }) {
  const [showSolutions, setShowSolutions] = useState(false);
  
  // Only fetch solutions when explicitly requested
  const { data: solutions, isLoading } = useQuery({
    queryKey: ['cluster-solutions', problem.cluster_id],
    queryFn: () => getSolutionsByCluster(problem.cluster_id),
    enabled: showSolutions && !!problem.cluster_id,
    staleTime: 1000 * 60 * 5,
  });

  if (!problem.cluster_id) {
    return (
      <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
        <div className="text-sm text-yellow-800">
          ⚠️ This problem is not assigned to any cluster yet
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-50 p-4 rounded-lg">
      <div className="mb-3">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-sm font-medium text-gray-700">Cluster: </span>
            <span className="text-sm text-gray-900">{problem.cluster_label || 'Unnamed Cluster'}</span>
          </div>
          {problem.solution_count > 0 && (
            <button
              onClick={() => setShowSolutions(!showSolutions)}
              className="text-sm text-primary-600 hover:text-primary-700 font-medium"
            >
              {showSolutions ? 'Hide' : 'Show'} Solutions ({problem.solution_count})
            </button>
          )}
        </div>
      </div>

      {showSolutions && (
        <div className="mt-3 space-y-2">
          {isLoading ? (
            <div className="text-sm text-gray-500">Loading solutions...</div>
          ) : (
            solutions?.map((solution) => (
              <div key={solution.id} className="bg-white p-3 rounded border border-gray-200">
                <div className="text-sm font-medium text-gray-900">{solution.title}</div>
                <div className="text-xs text-gray-500 mt-1">
                  {solution.primary_feature || solution.value_proposition?.substring(0, 100)}...
                </div>
                <div className="flex gap-3 mt-2">
                  <span className="text-xs text-gray-600">
                    Viability: {solution.overall_viability || 'N/A'}%
                  </span>
                  {solution.linear_project_id && (
                    <span className="text-xs text-primary-600">✓ Has Project</span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
});

// Lightweight problem row without complex state management
const ProblemRow = memo(function ProblemRow({ problem, visibleColumns, isExpanded, onToggle }) {
  // Create badges for quick visual reference
  const badges = useMemo(() => {
    const items = [];
    
    if (problem.cluster_id && problem.cluster_label) {
      items.push(
        <span key="cluster" className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800">
          📊 {problem.cluster_label}
        </span>
      );
    }
    
    if (problem.solution_count > 0) {
      items.push(
        <span key="solutions" className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
          💡 {problem.solution_count} solution{problem.solution_count > 1 ? 's' : ''}
        </span>
      );
    }
    
    if (!problem.cluster_id) {
      items.push(
        <span key="no-cluster" className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600">
          No cluster
        </span>
      );
    }
    
    return items;
  }, [problem.cluster_id, problem.cluster_label, problem.solution_count]);
  
  return (
    <>
      <tr className="hover:bg-gray-50">
        {visibleColumns.includes('title') && (
          <td className="px-6 py-4">
            <div>
              <button
                onClick={() => onToggle(problem.id)}
                className="flex items-start space-x-2 text-left w-full"
              >
                <span className="text-gray-400 flex-shrink-0 mt-1">
                  {isExpanded ? '▼' : '▶'}
                </span>
                <div className="flex-1">
                  <div className="text-sm font-medium text-gray-900">
                    {problem.title}
                  </div>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {badges}
                  </div>
                </div>
              </button>
            </div>
          </td>
        )}
        
        {visibleColumns.includes('description') && (
          <td className="px-6 py-4">
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
      
      {isExpanded && (
        <tr>
          <td colSpan={visibleColumns.length} className="px-6 py-4 bg-gray-50">
            <ExpansionContent problem={problem} />
          </td>
        </tr>
      )}
    </>
  );
});

// Memoized filters section
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

function ProblemsTableLightweight() {
  const [visibleColumns, setVisibleColumns] = useState(DEFAULT_COLUMNS);
  const [expandedRows, setExpandedRows] = useState(new Set());
  
  const {
    scrollRef,
    topScrollRef,
    scrollIndicators,
    handleTopScroll,
    handleBottomScroll,
    updateTopScrollWidth
  } = useSimpleTableScroll();
  
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
    staleTime: 1000 * 60 * 10,
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
    if (!newColumns.includes('title')) {
      newColumns = ['title', ...newColumns];
    }
    setVisibleColumns(newColumns);
    setTimeout(updateTopScrollWidth, 0);
  }, [updateTopScrollWidth]);

  const handleToggleRow = useCallback((problemId) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      if (next.has(problemId)) {
        next.delete(problemId);
      } else {
        next.add(problemId);
      }
      return next;
    });
  }, []);

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
      <FiltersSection
        onSearchChange={handleSearchChange}
        apiFilters={apiFilters}
        onFilterChange={handleFilterChange}
        onClearFilters={handleClearFilters}
        filterOptions={filterOptions}
        visibleColumns={visibleColumns}
        onColumnChange={handleColumnChange}
      />

      <div className="bg-white rounded-lg shadow table-container">
        <div 
          ref={topScrollRef}
          className="table-scroll-top"
          onScroll={handleTopScroll}
        >
          <div className="table-scroll-top-inner" />
        </div>
        
        <div 
          ref={scrollRef}
          className={`table-scroll table-scroll-indicator ${scrollIndicators.left ? 'can-scroll-left' : ''} ${scrollIndicators.right ? 'can-scroll-right' : ''}`}
          onScroll={handleBottomScroll}
        >
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {visibleColumns.includes('title') && (
                  <th 
                    onClick={() => handleSort('title')}
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  >
                    <div className="flex items-center">
                      Title
                      <SortIcon field="title" />
                    </div>
                  </th>
                )}
                
                {visibleColumns.includes('description') && (
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Description
                  </th>
                )}
                
                {visibleColumns.includes('cluster_label') && (
                  <th 
                    onClick={() => handleSort('cluster_label')}
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  >
                    <div className="flex items-center">
                      Cluster
                      <SortIcon field="cluster_label" />
                    </div>
                  </th>
                )}
                
                {visibleColumns.includes('impact') && (
                  <th 
                    onClick={() => handleSort('impact')}
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  >
                    <div className="flex items-center">
                      Impact
                      <SortIcon field="impact" />
                    </div>
                  </th>
                )}
                
                {visibleColumns.includes('industry') && (
                  <th 
                    onClick={() => handleSort('industry')}
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  >
                    <div className="flex items-center">
                      Industry
                      <SortIcon field="industry" />
                    </div>
                  </th>
                )}
                
                {visibleColumns.includes('business_size') && (
                  <th 
                    onClick={() => handleSort('business_size')}
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  >
                    <div className="flex items-center">
                      Business Size
                      <SortIcon field="business_size" />
                    </div>
                  </th>
                )}
                
                {visibleColumns.includes('solution_count') && (
                  <th 
                    onClick={() => handleSort('solution_count')}
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  >
                    <div className="flex items-center">
                      Solutions
                      <SortIcon field="solution_count" />
                    </div>
                  </th>
                )}
                
                {visibleColumns.includes('created_at') && (
                  <th 
                    onClick={() => handleSort('created_at')}
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  >
                    <div className="flex items-center">
                      Created
                      <SortIcon field="created_at" />
                    </div>
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
                  <ProblemRow 
                    key={problem.id} 
                    problem={problem} 
                    visibleColumns={visibleColumns}
                    isExpanded={expandedRows.has(problem.id)}
                    onToggle={handleToggleRow}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default ProblemsTableLightweight;