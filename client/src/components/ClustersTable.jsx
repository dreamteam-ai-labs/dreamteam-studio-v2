import React, { useState, useCallback, memo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getClusters, getProblemsByCluster, getSolutionsByCluster, getClustersFilterOptions } from '../services/api';
import SearchInput from './SearchInput';
import ColumnSelector from './ColumnSelector';
import { useTableFeatures } from '../hooks/useTableFeatures';
import '../styles/tables.css';

// Define all available columns
const ALL_COLUMNS = [
  { key: 'cluster_label', label: 'Cluster Label', required: true },
  { key: 'problem_count', label: 'Problems', required: false },
  { key: 'solution_count', label: 'Solutions', required: false },
  { key: 'avg_similarity', label: 'Avg Similarity', required: false },
  { key: 'status', label: 'Status', required: false },
];

// Default visible columns
const DEFAULT_COLUMNS = ['cluster_label', 'problem_count', 'solution_count', 'status'];

// Memoized filters section
const FiltersSection = memo(function FiltersSection({ 
  onSearchChange, 
  apiFilters, 
  onFilterChange, 
  onClearFilters,
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
            placeholder="Search clusters..."
          />
        </div>
        
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

        {visibleColumns.includes('problem_count') && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Min Problems
            </label>
            <input
              type="number"
              value={apiFilters.min_problems}
              onChange={(e) => onFilterChange('min_problems', e.target.value)}
              placeholder="0"
              min="0"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
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

// Cluster row component for expandable functionality
function ClusterRow({ cluster, visibleColumns }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [problemSort, setProblemSort] = useState({ field: 'impact', order: 'desc' });
  const [solutionSort, setSolutionSort] = useState({ field: 'viability', order: 'desc' });
  
  const { data: problems, isLoading: problemsLoading } = useQuery({
    queryKey: ['cluster-problems', cluster.cluster_id],
    queryFn: () => getProblemsByCluster(cluster.cluster_id),
    enabled: isExpanded,
    staleTime: 1000 * 60 * 5,
  });

  const { data: solutions, isLoading: solutionsLoading } = useQuery({
    queryKey: ['cluster-solutions', cluster.cluster_id],
    queryFn: () => getSolutionsByCluster(cluster.cluster_id),
    enabled: isExpanded,
    staleTime: 1000 * 60 * 5,
  });
  
  // Sort problems
  const sortedProblems = React.useMemo(() => {
    if (!problems) return [];
    const sorted = [...problems];
    
    sorted.sort((a, b) => {
      let compareValue = 0;
      
      switch (problemSort.field) {
        case 'title':
          compareValue = (a.title || '').localeCompare(b.title || '');
          break;
        case 'impact':
          const impactOrder = { 'high': 3, 'medium': 2, 'low': 1 };
          compareValue = (impactOrder[a.impact] || 0) - (impactOrder[b.impact] || 0);
          break;
        case 'similarity':
          compareValue = (parseFloat(a.cluster_similarity) || 0) - (parseFloat(b.cluster_similarity) || 0);
          break;
        default:
          return 0;
      }
      
      return problemSort.order === 'asc' ? compareValue : -compareValue;
    });
    
    return sorted;
  }, [problems, problemSort]);
  
  // Sort solutions
  const sortedSolutions = React.useMemo(() => {
    if (!solutions) return [];
    const sorted = [...solutions];
    
    sorted.sort((a, b) => {
      let compareValue = 0;
      
      switch (solutionSort.field) {
        case 'title':
          compareValue = (a.title || '').localeCompare(b.title || '');
          break;
        case 'viability':
          compareValue = (a.overall_viability || 0) - (b.overall_viability || 0);
          break;
        case 'status':
          compareValue = (a.status || '').localeCompare(b.status || '');
          break;
        default:
          return 0;
      }
      
      return solutionSort.order === 'asc' ? compareValue : -compareValue;
    });
    
    return sorted;
  }, [solutions, solutionSort]);

  return (
    <>
      <tr className="hover:bg-gray-50">
        <td className="px-6 py-4">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center gap-2 text-left"
          >
            <span className="text-gray-400">
              {isExpanded ? '▼' : '▶'}
            </span>
            <div>
              <span className="text-sm font-medium text-gray-900">
                {cluster.cluster_label}
              </span>
              <div className="flex gap-2 mt-1">
                {cluster.problem_count > 0 && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800">
                    📋 {cluster.problem_count} problems
                  </span>
                )}
                {cluster.solution_count > 0 && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                    💡 {cluster.solution_count} solutions
                  </span>
                )}
              </div>
            </div>
          </button>
        </td>
        
        {visibleColumns.includes('problem_count') && (
          <td className="px-6 py-4 text-sm text-gray-900">
            {cluster.problem_count || 0}
          </td>
        )}
        
        {visibleColumns.includes('solution_count') && (
          <td className="px-6 py-4 text-sm text-gray-900">
            {cluster.solution_count || 0}
          </td>
        )}
        
        {visibleColumns.includes('avg_similarity') && (
          <td className="px-6 py-4 text-sm text-gray-900">
            {cluster.avg_similarity ? parseFloat(cluster.avg_similarity).toFixed(3) : 'N/A'}
          </td>
        )}
        
        {visibleColumns.includes('status') && (
          <td className="px-6 py-4">
            {cluster.solution_count > 0 ? (
              <span className="text-green-600">✓ Has Solutions</span>
            ) : (
              <button className="text-primary-600 hover:text-primary-800 text-sm font-medium">
                Generate Solution →
              </button>
            )}
          </td>
        )}
      </tr>
      
      
      {isExpanded && (
        <tr>
          <td colSpan={visibleColumns.length + 1} className="px-6 py-0">
            <div className="bg-gradient-to-r from-purple-50 to-indigo-50 p-4 mb-4 rounded">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Problems Section */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                      📋 Problems ({problems?.length || 0})
                    </div>
                    {problems?.length > 1 && (
                      <select
                        value={`${problemSort.field}-${problemSort.order}`}
                        onChange={(e) => {
                          const [field, order] = e.target.value.split('-');
                          setProblemSort({ field, order });
                        }}
                        className="text-xs border rounded px-2 py-1"
                      >
                        <option value="impact-desc">Impact ↓</option>
                        <option value="impact-asc">Impact ↑</option>
                        <option value="title-asc">Title A-Z</option>
                        <option value="title-desc">Title Z-A</option>
                        <option value="similarity-desc">Similarity ↓</option>
                        <option value="similarity-asc">Similarity ↑</option>
                      </select>
                    )}
                  </div>
                  {problemsLoading ? (
                    <div className="text-sm text-gray-500">Loading problems...</div>
                  ) : sortedProblems?.length === 0 ? (
                    <div className="text-sm text-gray-500 italic">No problems in this cluster</div>
                  ) : (
                    <div className="space-y-2 max-h-96 overflow-y-auto">
                      {sortedProblems?.map((problem) => (
                        <div key={problem.id} className="bg-white p-3 rounded border border-gray-200">
                          <div className="text-sm font-medium text-gray-900">
                            {problem.title}
                          </div>
                          <div className="text-xs text-gray-500 mt-1 line-clamp-2">
                            {problem.description}
                          </div>
                          <div className="flex gap-3 mt-2">
                            <span className={`text-xs px-2 py-0.5 rounded-full ${
                              problem.impact === 'high' ? 'bg-red-100 text-red-800' :
                              problem.impact === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                              'bg-green-100 text-green-800'
                            }`}>
                              {problem.impact || 'N/A'} impact
                            </span>
                            {problem.cluster_similarity && (
                              <span className="text-xs text-gray-500">
                                Similarity: {parseFloat(problem.cluster_similarity).toFixed(3)}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Solutions Section */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                      💡 Solutions ({solutions?.length || 0})
                    </div>
                    {solutions?.length > 1 && (
                      <select
                        value={`${solutionSort.field}-${solutionSort.order}`}
                        onChange={(e) => {
                          const [field, order] = e.target.value.split('-');
                          setSolutionSort({ field, order });
                        }}
                        className="text-xs border rounded px-2 py-1"
                      >
                        <option value="viability-desc">Viability ↓</option>
                        <option value="viability-asc">Viability ↑</option>
                        <option value="title-asc">Title A-Z</option>
                        <option value="title-desc">Title Z-A</option>
                        <option value="status-asc">Status A-Z</option>
                        <option value="status-desc">Status Z-A</option>
                      </select>
                    )}
                  </div>
                  {solutionsLoading ? (
                    <div className="text-sm text-gray-500">Loading solutions...</div>
                  ) : sortedSolutions?.length === 0 ? (
                    <div className="text-sm text-gray-500 italic">No solutions for this cluster</div>
                  ) : (
                    <div className="space-y-2 max-h-96 overflow-y-auto">
                      {sortedSolutions?.map((solution) => (
                        <div key={solution.id} className="bg-white p-3 rounded border border-green-200">
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <div className="text-sm font-medium text-gray-900">
                                {solution.title}
                              </div>
                              {solution.description && (
                                <div className="text-xs text-gray-500 mt-1 line-clamp-2">
                                  {solution.description}
                                </div>
                              )}
                            </div>
                            {solution.overall_viability && (
                              <div className="ml-3 text-right">
                                <div className={`text-sm font-bold ${
                                  solution.overall_viability >= 80 ? 'text-green-600' :
                                  solution.overall_viability >= 60 ? 'text-yellow-600' :
                                  'text-red-600'
                                }`}>
                                  {solution.overall_viability}%
                                </div>
                                <div className="text-xs text-gray-500">viability</div>
                              </div>
                            )}
                          </div>
                          <div className="flex gap-3 mt-2">
                            {solution.status && (
                              <span className={`text-xs px-2 py-0.5 rounded ${
                                solution.status === 'approved' ? 'bg-green-100 text-green-800' :
                                solution.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                                'bg-gray-100 text-gray-800'
                              }`}>
                                {solution.status}
                              </span>
                            )}
                            {solution.linear_project_id && (
                              <span className="text-xs px-2 py-0.5 rounded bg-purple-100 text-purple-800">
                                📋 Has Project
                              </span>
                            )}
                            {solution.tech_stack && (
                              <span className="text-xs text-gray-500">
                                {solution.tech_stack}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function ClustersTable() {
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
    has_solutions: '',
    min_problems: '',
    sortBy: 'problem_count',
    sortOrder: 'DESC'
  });

  const { data: clusters, isLoading } = useQuery({
    queryKey: ['clusters', apiFilters],
    queryFn: () => getClusters(apiFilters),
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
      has_solutions: '',
      min_problems: '',
      sortBy: 'problem_count',
      sortOrder: 'DESC'
    });
    window.location.reload();
  }, []);

  const handleColumnChange = useCallback((newColumns) => {
    // Ensure cluster_label is always visible
    if (!newColumns.includes('cluster_label')) {
      newColumns = ['cluster_label', ...newColumns];
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

  if (isLoading && !clusters) {
    return <div className="text-center py-4">Loading clusters...</div>;
  }

  return (
    <div>
      {/* Memoized Filters Section */}
      <FiltersSection
        onSearchChange={handleSearchChange}
        apiFilters={apiFilters}
        onFilterChange={handleFilterChange}
        onClearFilters={handleClearFilters}
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
              <th 
                onClick={() => handleSort('cluster_label')}
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 resizable-header"
                style={{ width: columnWidths.cluster_label || 'auto' }}
              >
                <div className="flex items-center">
                  Cluster Label
                  <SortIcon field="cluster_label" />
                </div>
                <div 
                  className="column-resizer"
                  onMouseDown={(e) => handleMouseDown(e, 'cluster_label')}
                />
              </th>
              
              {visibleColumns.includes('problem_count') && (
                <th 
                  onClick={() => handleSort('problem_count')}
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 resizable-header"
                  style={{ width: columnWidths.problem_count || 'auto' }}
                >
                  <div className="flex items-center">
                    Problems
                    <SortIcon field="problem_count" />
                  </div>
                  <div 
                    className="column-resizer"
                    onMouseDown={(e) => handleMouseDown(e, 'problem_count')}
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
              
              {visibleColumns.includes('avg_similarity') && (
                <th 
                  onClick={() => handleSort('avg_similarity')}
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 resizable-header"
                  style={{ width: columnWidths.avg_similarity || 'auto' }}
                >
                  <div className="flex items-center">
                    Avg Similarity
                    <SortIcon field="avg_similarity" />
                  </div>
                  <div 
                    className="column-resizer"
                    onMouseDown={(e) => handleMouseDown(e, 'avg_similarity')}
                  />
                </th>
              )}
              
              {visibleColumns.includes('status') && (
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider resizable-header"
                  style={{ width: columnWidths.status || 'auto' }}
                >
                  Status
                  <div 
                    className="column-resizer"
                    onMouseDown={(e) => handleMouseDown(e, 'status')}
                  />
                </th>
              )}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {clusters?.length === 0 ? (
              <tr>
                <td colSpan={visibleColumns.length + 1} className="px-6 py-4 text-center text-gray-500">
                  No clusters found matching your filters
                </td>
              </tr>
            ) : (
              clusters?.map((cluster) => (
                <ClusterRow 
                  key={cluster.cluster_id} 
                  cluster={cluster} 
                  visibleColumns={visibleColumns}
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

export default ClustersTable;