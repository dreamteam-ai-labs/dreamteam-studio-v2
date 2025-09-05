import React, { useState, useCallback, memo, useEffect, useMemo, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getClusters, getProblemsByCluster, getSolutionsByCluster, getClustersFilterOptions } from '../services/api';
import api from '../services/api';
import { formatDateTime, isNewItem } from '../utils/dateUtils';
import SearchInput from './SearchInput';
import ColumnSelector from './ColumnSelector';
import TableHeader from './TableHeader';
import { useTableFeatures } from '../hooks/useTableFeatures';
import { TAB_COLUMNS, DEFAULT_VISIBLE_COLUMNS, getCellClassName, getColumnStyle, getInitialColumnWidths } from '../config/tableConfig';
import '../styles/tables.css';

// Use centralized column definitions
const ALL_COLUMNS = TAB_COLUMNS.clusters;
const DEFAULT_COLUMNS = DEFAULT_VISIBLE_COLUMNS.clusters;

// Memoized filters section
const FiltersSection = memo(function FiltersSection({ 
  searchTerm,
  onSearchChange, 
  apiFilters, 
  onFilterChange, 
  onClearFilters,
  visibleColumns,
  entityType = 'problem'
}) {
  // Load collapsed state from localStorage
  const [isCollapsed, setIsCollapsed] = useState(() => {
    const saved = localStorage.getItem('clusters-filters-collapsed');
    return saved === 'true';
  });

  // Save collapsed state to localStorage
  const toggleCollapsed = () => {
    const newState = !isCollapsed;
    setIsCollapsed(newState);
    localStorage.setItem('clusters-filters-collapsed', newState.toString());
  };

  return (
    <div className="bg-white p-4 rounded-lg shadow mb-4">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold text-gray-800">Filters</h2>
        <button
          onClick={toggleCollapsed}
          className="text-sm text-gray-600 hover:text-gray-800 flex items-center gap-1"
          title={isCollapsed ? "Show advanced filters" : "Hide advanced filters"}
        >
          <span>{isCollapsed ? 'Show Advanced' : 'Hide Advanced'}</span>
          <svg 
            className={`w-4 h-4 transition-transform ${isCollapsed ? 'rotate-180' : ''}`}
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>
      
      <div>
        {/* Always show search */}
        <div className="mb-3">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Search
          </label>
          <SearchInput 
            value={searchTerm}
            onSearchChange={onSearchChange}
            placeholder="Search clusters..."
          />
        </div>
        
        {/* Collapsible advanced filters */}
        {!isCollapsed && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-3 border-t border-gray-200">
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

          {visibleColumns.includes('problem_count') && entityType === 'problem' && (
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
      )}
      </div>
    </div>
  );
});

// Cluster row component for expandable functionality
function ClusterRow({ cluster, visibleColumns, entityType = 'problem', isNew, isFlashing }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [problemSort, setProblemSort] = useState({ field: 'impact', order: 'desc' });
  const [solutionSort, setSolutionSort] = useState({ field: 'viability', order: 'desc' });
  
  const { data: problems, isLoading: problemsLoading } = useQuery({
    queryKey: ['cluster-problems', cluster.cluster_id],
    queryFn: () => getProblemsByCluster(cluster.cluster_id),
    enabled: isExpanded && entityType === 'problem',
    staleTime: 1000 * 60 * 5,
  });

  const { data: solutions, isLoading: solutionsLoading } = useQuery({
    queryKey: ['cluster-solutions', cluster.cluster_id, entityType],
    queryFn: () => {
      // For solution clusters, fetch solutions directly from that cluster
      if (entityType === 'solution') {
        return api.get(`/solution-clusters/${cluster.cluster_id}/solutions`);
      }
      // For problem clusters, fetch solutions generated from that cluster
      return getSolutionsByCluster(cluster.cluster_id);
    },
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
      <tr className={`hover:bg-gray-50 cursor-pointer ${isFlashing ? 'flash-new' : ''} ${isNew ? 'new-item' : ''}`} onClick={() => setIsExpanded(!isExpanded)}>
        <td className="px-6 py-4" style={{ minWidth: '350px' }}>
          <div className="flex items-center gap-2">
            <span className="text-gray-400 flex-shrink-0">
              {isExpanded ? '▼' : '▶'}
            </span>
            <div className="min-w-0">
              <span className="text-sm font-medium text-gray-900 block whitespace-normal">
                {cluster.cluster_label}
              </span>
              <div className="flex gap-2 mt-1 flex-wrap">
                {entityType === 'problem' && cluster.problem_count > 0 && (
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
          </div>
        </td>
        
        {visibleColumns.includes('problem_count') && entityType === 'problem' && (
          <td className="px-6 py-4 text-sm text-gray-900 text-center" style={{ width: '100px' }}>
            {cluster.problem_count || 0}
          </td>
        )}
        
        {visibleColumns.includes('solution_count') && (
          <td className="px-6 py-4 text-sm text-gray-900 text-center" style={{ width: '100px' }}>
            {cluster.solution_count || 0}
          </td>
        )}
        
        {visibleColumns.includes('avg_similarity') && (
          <td className="px-6 py-4 text-sm text-gray-900 text-center" style={{ width: '120px' }}>
            {cluster.avg_similarity ? parseFloat(cluster.avg_similarity).toFixed(3) : 'N/A'}
          </td>
        )}
        
        {visibleColumns.includes('status') && entityType === 'problem' && (
          <td className="px-6 py-4" style={{ width: '180px' }}>
            {cluster.solution_count > 0 ? (
              <span className="text-green-600">✓ Has Solutions</span>
            ) : (
              <button className="text-primary-600 hover:text-primary-800 text-sm font-medium">
                Generate Solution →
              </button>
            )}
          </td>
        )}
        
        {visibleColumns.includes('created_at') && (
          <td className="px-6 py-4 text-sm text-gray-900 text-center" style={{ width: '120px' }}>
            {formatDateTime(cluster.created_at)}
          </td>
        )}
      </tr>
      
      
      {isExpanded && (
        <tr>
          <td colSpan={visibleColumns.length + 1} className="px-6 py-0">
            <div className="bg-gradient-to-r from-purple-50 to-indigo-50 p-4 mb-4 rounded">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Problems Section - Only show for problem clusters */}
                {entityType === 'problem' && (
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
                )}

                {/* Solutions Section */}
                <div className={entityType === 'solution' ? 'col-span-2' : ''}>
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

function ClustersTable({ filters: externalFilters, onFiltersChange, onDataFiltered, entityType = 'problem' }) {
  // Use external filters if provided, otherwise use local state
  const [localSearchTerm, setLocalSearchTerm] = useState(''); // Local search state
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [newItemIds, setNewItemIds] = useState(new Set());
  const [flashItemIds, setFlashItemIds] = useState(new Set());
  const previousDataRef = useRef(null);
  const searchTerm = externalFilters?.searchTerm ?? localSearchTerm;
  
  // Load saved column preferences or use defaults - separate for each entity type
  const [visibleColumns, setVisibleColumns] = useState(() => {
    const storageKey = entityType === 'solution' ? 'solution-clusters-visible-columns' : 'clusters-visible-columns';
    const saved = localStorage.getItem(storageKey);
    // For solution clusters, exclude status AND problem_count
    // For problem clusters, use all default columns including problem_count
    let defaultCols;
    if (entityType === 'solution') {
      // Remove status and problem_count for solution clusters
      defaultCols = DEFAULT_COLUMNS.filter(col => col !== 'status' && col !== 'problem_count');
    } else {
      // Problem clusters get all columns from DEFAULT_COLUMNS
      defaultCols = [...DEFAULT_COLUMNS];
    }
    // If there's saved data but it doesn't include critical columns, reset it
    if (saved) {
      const savedCols = JSON.parse(saved);
      // For problem clusters, ensure problem_count is visible
      if (entityType === 'problem' && !savedCols.includes('problem_count')) {
        return defaultCols;
      }
      // For solution clusters, remove problem_count if it's there
      if (entityType === 'solution') {
        return savedCols.filter(col => col !== 'problem_count');
      }
      return savedCols;
    }
    return defaultCols;
  });
  
  // Save column preferences when they change
  useEffect(() => {
    const storageKey = entityType === 'solution' ? 'solution-clusters-visible-columns' : 'clusters-visible-columns';
    localStorage.setItem(storageKey, JSON.stringify(visibleColumns));
  }, [visibleColumns, entityType]);
  
  // Memoize initial widths to prevent infinite loop
  const initialWidths = useMemo(() => getInitialColumnWidths('clusters'), []);
  
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
  } = useTableFeatures(visibleColumns, initialWidths);
  const [apiFilters, setApiFilters] = useState({
    has_solutions: '',
    min_problems: '',
    sortBy: 'problem_count',
    sortOrder: 'DESC'
  });

  const { data: allClusters, isLoading, refetch: refetchClusters } = useQuery({
    queryKey: [entityType === 'solution' ? 'solution-clusters' : 'clusters', apiFilters],
    queryFn: () => getClusters(apiFilters, entityType),
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    keepPreviousData: true,
  });

  // Handle refresh
  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      // Store current data before refresh
      previousDataRef.current = allClusters ? new Set(allClusters.map(c => c.cluster_id)) : new Set();
      await refetchClusters();
    } finally {
      setTimeout(() => setIsRefreshing(false), 500);
    }
  };

  // Detect new items after data changes
  useEffect(() => {
    if (allClusters && previousDataRef.current) {
      const newIds = new Set();
      allClusters.forEach(cluster => {
        // Item is new if it wasn't in previous data OR was created in last 10 seconds
        if (!previousDataRef.current.has(cluster.cluster_id) || isNewItem(cluster.created_at)) {
          newIds.add(cluster.cluster_id);
        }
      });
      
      if (newIds.size > 0) {
        setNewItemIds(newIds);  // Keep persistent for green border
        setFlashItemIds(newIds); // For flash animation
        // Clear only the flash animation after 1.5 seconds
        setTimeout(() => setFlashItemIds(new Set()), 1500);
      } else {
        // Clear new items on refresh if no new items found
        setNewItemIds(new Set());
        setFlashItemIds(new Set());
      }
    }
  }, [allClusters]);

  // Client-side filtering for search and external filters
  const clusters = useMemo(() => {
    if (!allClusters) return [];
    
    let filtered = allClusters;
    
    // Apply search term
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(cluster => 
        cluster.cluster_label?.toLowerCase().includes(term) ||
        cluster.label?.toLowerCase().includes(term)
      );
    }
    
    // Apply external filters if provided
    if (externalFilters) {
      // Cluster label filter
      if (externalFilters.cluster_label) {
        const labelTerm = externalFilters.cluster_label.toLowerCase();
        filtered = filtered.filter(cluster => 
          cluster.cluster_label?.toLowerCase().includes(labelTerm) ||
          cluster.label?.toLowerCase().includes(labelTerm)
        );
      }
      
      // Problem count filter (minimum)
      if (externalFilters.problem_count !== null && externalFilters.problem_count !== undefined) {
        filtered = filtered.filter(cluster => 
          (cluster.problem_count || 0) >= externalFilters.problem_count
        );
      }
      
      // Solution count filter (minimum)
      if (externalFilters.solution_count !== null && externalFilters.solution_count !== undefined) {
        filtered = filtered.filter(cluster => 
          (cluster.solution_count || 0) >= externalFilters.solution_count
        );
      }
      
      // Avg similarity filter (minimum)
      if (externalFilters.avg_similarity !== null && externalFilters.avg_similarity !== undefined) {
        filtered = filtered.filter(cluster => 
          (parseFloat(cluster.avg_similarity) || 0) >= externalFilters.avg_similarity
        );
      }
      
      // Status filter (multiple selection)
      if (externalFilters.status?.length > 0) {
        filtered = filtered.filter(cluster => {
          // Determine cluster status based on solution count
          const status = cluster.solution_count > 0 ? 'has-solutions' : 'no-solutions';
          return externalFilters.status.includes(status);
        });
      }
    }
    
    return filtered;
  }, [allClusters, searchTerm, externalFilters]);

  // Pass filtered data back to parent
  useEffect(() => {
    if (onDataFiltered) {
      onDataFiltered(clusters);
    }
  }, [clusters, onDataFiltered]);

  const handleSearchChange = useCallback((value) => {
    if (externalFilters) {
      onFiltersChange?.(prev => ({ ...prev, searchTerm: value }));
    } else {
      setLocalSearchTerm(value);
    }
  }, [externalFilters, onFiltersChange]);

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
    setSearchTerm('');
    setApiFilters({
      has_solutions: '',
      min_problems: '',
      sortBy: 'problem_count',
      sortOrder: 'DESC'
    });
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
      {/* Only show local filters if no external filters provided */}
      {!externalFilters && (
        <FiltersSection
          searchTerm={searchTerm}
          onSearchChange={handleSearchChange}
          apiFilters={apiFilters}
          onFilterChange={handleFilterChange}
          onClearFilters={handleClearFilters}
          visibleColumns={visibleColumns}
          entityType={entityType}
        />
      )}

      {/* Table */}
      <div className={`bg-white rounded-lg shadow table-container ${isResizing ? 'resizing' : ''}`}>
        {/* Table Header */}
        <div className="p-4 border-b border-gray-200">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold text-gray-800">
              {entityType === 'solution' ? 'Solution' : 'Problem'} Clusters ({clusters?.length || 0} total)
            </h2>
            <div className="flex items-center gap-3">
              <button
                onClick={handleRefresh}
                disabled={isRefreshing}
                className="flex items-center gap-2 px-3 py-1.5 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors disabled:opacity-50"
                title="Refresh data"
              >
                <svg 
                  className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} 
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
              <ColumnSelector 
                columns={entityType === 'solution' 
                  ? ALL_COLUMNS.filter(col => col.key !== 'status' && col.key !== 'problem_count')
                  : ALL_COLUMNS}
                selectedColumns={visibleColumns}
                onColumnChange={handleColumnChange}
              />
            </div>
          </div>
        </div>
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
              {ALL_COLUMNS.filter(col => {
                // Hide status and problem_count columns for solution clusters
                if (entityType === 'solution' && (col.key === 'status' || col.key === 'problem_count')) return false;
                // Show column if it's in visibleColumns
                return visibleColumns.includes(col.key);
              }).map(column => (
                <TableHeader
                  key={column.key}
                  column={column}
                  sortBy={apiFilters.sortBy}
                  sortOrder={apiFilters.sortOrder}
                  onSort={handleSort}
                  columnWidth={columnWidths[column.key]}
                  onMouseDown={handleMouseDown}
                />
              ))}
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
                  entityType={entityType}
                  isNew={newItemIds.has(cluster.cluster_id)}
                  isFlashing={flashItemIds.has(cluster.cluster_id)}
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