import { useState, useCallback, memo, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getSolutions, getProblemsBySolution, getProblemsByCluster, getSolutionsFilterOptions } from '../services/api';
import SearchInput from './SearchInput';
import ColumnSelector from './ColumnSelector';
import TableHeader from './TableHeader';
import { useTableFeatures } from '../hooks/useTableFeatures';
import { TAB_COLUMNS, DEFAULT_VISIBLE_COLUMNS, getCellClassName, getColumnStyle, getInitialColumnWidths } from '../config/tableConfig';
import '../styles/tables.css';

// Use centralized column definitions
const ALL_COLUMNS = TAB_COLUMNS.solutions;
const DEFAULT_COLUMNS = DEFAULT_VISIBLE_COLUMNS.solutions;

// Memoized filters section
const FiltersSection = memo(function FiltersSection({ 
  searchTerm,
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
            value={searchTerm}
            onSearchChange={onSearchChange}
            placeholder="Search solutions..."
          />
        </div>
        
        {visibleColumns.includes('status') && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Status
            </label>
            <select
              value={apiFilters.status}
              onChange={(e) => onFilterChange('status', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="">All</option>
              {filterOptions?.statuses?.map(status => (
                <option key={status} value={status}>{status}</option>
              ))}
            </select>
          </div>
        )}

        {visibleColumns.includes('overall_viability') && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Min Viability (%)
            </label>
            <input
              type="number"
              value={apiFilters.min_viability}
              onChange={(e) => onFilterChange('min_viability', e.target.value)}
              placeholder="0"
              min="0"
              max="100"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
        )}

        {visibleColumns.includes('project') && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Project
            </label>
            <select
              value={apiFilters.has_project}
              onChange={(e) => onFilterChange('has_project', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="">All</option>
              <option value="true">Has Project</option>
              <option value="false">No Project</option>
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

// Solution row component for expandable functionality
function SolutionRow({ solution, visibleColumns }) {
  const [isExpanded, setIsExpanded] = useState(false);
  
  // Get problems directly linked to solution
  const { data: directProblems, isLoading: directLoading } = useQuery({
    queryKey: ['solution-problems', solution.id],
    queryFn: () => getProblemsBySolution(solution.id),
    enabled: isExpanded,
    staleTime: 1000 * 60 * 5,
  });
  
  // Get problems from the cluster if solution has a cluster
  const { data: clusterProblems, isLoading: clusterLoading } = useQuery({
    queryKey: ['cluster-problems', solution.source_cluster_id],
    queryFn: () => getProblemsByCluster(solution.source_cluster_id),
    enabled: isExpanded && !!solution.source_cluster_id, // Always load when expanded if cluster exists
    staleTime: 1000 * 60 * 5,
  });

  return (
    <>
      <tr className="hover:bg-gray-50 cursor-pointer" onClick={() => setIsExpanded(!isExpanded)}>
        {visibleColumns.includes('title') && (
          <td className="px-6 py-4 cell-title" style={{ minWidth: '400px' }}>
            <div className="flex items-start gap-2">
              <span className="text-gray-400 mt-1 flex-shrink-0">
                {isExpanded ? '▼' : '▶'}
              </span>
              <div className="flex-1">
                <div className="text-sm font-medium text-gray-900">
                  {solution.title}
                </div>
                <div className="text-sm text-gray-500 mt-1">
                  {solution.primary_feature || solution.value_proposition?.substring(0, 150)}...
                </div>
                <div className="flex gap-2 mt-1">
                  {solution.source_cluster_label && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800">
                      📊 {solution.source_cluster_label}
                    </span>
                  )}
                  {solution.problem_count > 0 && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                      📋 {solution.problem_count} problems
                    </span>
                  )}
                  {solution.linear_project_id && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                      ✓ Has Project
                    </span>
                  )}
                </div>
              </div>
            </div>
          </td>
        )}
        
        {visibleColumns.includes('overall_viability') && (
          <td className="px-6 py-4 text-center" style={{ width: '120px' }}>
            <div className="flex items-center justify-center">
              <div className="text-sm font-medium text-gray-900">
                {solution.overall_viability || 'N/A'}
              </div>
              <div className="ml-2 flex-shrink-0">
                <div className="w-16 bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-primary-600 h-2 rounded-full" 
                    style={{width: `${solution.overall_viability || 0}%`}}
                  />
                </div>
              </div>
            </div>
          </td>
        )}
        
        {visibleColumns.includes('ltv_cac') && (
          <td className="px-6 py-4 text-sm text-gray-900 text-center" style={{ width: '140px' }}>
            {solution.ltv_estimate && solution.cac_estimate ? 
              `£${(solution.ltv_estimate / 1000).toFixed(0)}k / £${(solution.cac_estimate / 1000).toFixed(0)}k` : 
              'N/A'
            }
          </td>
        )}
        
        {visibleColumns.includes('revenue') && (
          <td className="px-6 py-4 text-sm text-gray-900 text-center" style={{ width: '100px' }}>
            {solution.recurring_revenue_potential ? 
              `£${(solution.recurring_revenue_potential / 1000000).toFixed(1)}M` : 
              'N/A'
            }
          </td>
        )}
        
        {visibleColumns.includes('source_cluster') && (
          <td className="px-6 py-4 text-sm text-gray-900" style={{ width: '200px' }}>
            {solution.source_cluster_label || 'N/A'}
          </td>
        )}
        
        {visibleColumns.includes('problem_count') && (
          <td className="px-6 py-4 text-sm text-gray-900 text-center" style={{ width: '100px' }}>
            {solution.problem_count || 0}
          </td>
        )}
        
        {visibleColumns.includes('status') && (
          <td className="px-6 py-4 text-center" style={{ width: '100px' }}>
            <span className={`inline-flex px-2 py-1 text-xs rounded-full ${
              solution.status === 'launched' ? 'bg-green-100 text-green-800' :
              solution.status === 'selected' ? 'bg-blue-100 text-blue-800' :
              solution.status === 'evaluated' ? 'bg-yellow-100 text-yellow-800' :
              'bg-gray-100 text-gray-800'
            }`}>
              {solution.status || 'candidate'}
            </span>
          </td>
        )}
        
        {visibleColumns.includes('project') && (
          <td className="px-6 py-4 text-sm text-center" style={{ width: '100px' }}>
            {solution.linear_project_id ? (
              <span className="text-primary-600">✓ Linear</span>
            ) : (
              <span className="text-gray-400">-</span>
            )}
          </td>
        )}
      </tr>
      
      {isExpanded && (
        <tr>
          <td colSpan={visibleColumns.length} className="px-6 py-0">
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-4 mb-4 rounded">
              <div className="space-y-4">
                {/* Solution Details */}
                <div>
                  <h4 className="text-sm font-semibold text-gray-700 mb-2">Solution Details</h4>
                  <div className="bg-white p-3 rounded border border-gray-200">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-gray-500">Value Proposition:</span>
                        <p className="text-gray-700 mt-1">{solution.value_proposition || 'Not specified'}</p>
                      </div>
                      <div>
                        <span className="text-gray-500">Tech Stack:</span>
                        <p className="text-gray-700 mt-1">{solution.tech_stack || 'Not specified'}</p>
                      </div>
                      <div>
                        <span className="text-gray-500">MVP Timeline:</span>
                        <p className="text-gray-700 mt-1">{solution.mvp_timeline || 'Not specified'}</p>
                      </div>
                      <div>
                        <span className="text-gray-500">Revenue Potential:</span>
                        <p className="text-gray-700 mt-1">
                          {solution.recurring_revenue_potential ? 
                            `£${(solution.recurring_revenue_potential / 1000000).toFixed(1)}M` : 
                            'Not specified'
                          }
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* Problems Section - Side by Side */}
                <div>
                  <h4 className="text-sm font-semibold text-gray-700 mb-3">Related Problems</h4>
                  
                  {solution.source_cluster_id ? (
                    <>
                      <div className="text-sm text-gray-600 mb-3">
                        Source Cluster: <span className="font-medium">{solution.source_cluster_label}</span>
                      </div>
                      
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                          {/* Directly Mapped Problems */}
                          <div>
                            <div className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                              🎯 Problems This Solution Addresses ({directProblems?.length || 0})
                              <span className="text-xs font-normal text-gray-500" title="High-relevance problems (similarity ≥ 0.55) that were specifically selected when this solution was created">
                                ⓘ
                              </span>
                            </div>
                            {directLoading ? (
                              <div className="text-sm text-gray-500">Loading...</div>
                            ) : directProblems?.length === 0 ? (
                              <div className="text-sm text-gray-500 italic">No problems directly mapped to this solution</div>
                            ) : (
                              <div className="space-y-2 max-h-96 overflow-y-auto">
                                {directProblems?.map((problem) => (
                                  <div key={problem.id} className="bg-white p-3 rounded border border-blue-200">
                                    <div className="text-sm font-medium text-gray-900">
                                      {problem.title}
                                    </div>
                                    <div className="text-xs text-gray-500 mt-1 line-clamp-2">
                                      {problem.description}
                                    </div>
                                    {problem.impact && (
                                      <span className={`inline-flex mt-2 px-2 py-0.5 text-xs rounded-full ${
                                        problem.impact === 'high' ? 'bg-red-100 text-red-800' :
                                        problem.impact === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                                        'bg-green-100 text-green-800'
                                      }`}>
                                        {problem.impact} impact
                                      </span>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                          
                          {/* Cluster Problems */}
                          <div>
                            <div className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                              📊 Current Cluster Contents ({clusterProblems?.length || 0})
                              <span className="text-xs font-normal text-gray-500" title="All problems currently in the source cluster. May be empty if problems were re-clustered after this solution was created.">
                                ⓘ
                              </span>
                            </div>
                            {clusterLoading ? (
                              <div className="text-sm text-gray-500">Loading cluster problems...</div>
                            ) : clusterProblems?.length === 0 ? (
                              <div className="text-sm text-gray-500 italic bg-gray-50 p-3 rounded">
                                <div className="font-medium mb-1">Cluster has been re-organized</div>
                                <div className="text-xs">
                                  The original cluster "{solution.source_cluster_label}" no longer contains problems 
                                  (likely due to re-clustering). The problems this solution addresses are preserved 
                                  in the left column.
                                </div>
                              </div>
                            ) : (
                              <div className="space-y-2 max-h-96 overflow-y-auto">
                                {clusterProblems?.map((problem) => (
                                  <div key={problem.id} className="bg-white p-3 rounded border border-purple-200">
                                    <div className="text-sm font-medium text-gray-900">
                                      {problem.title}
                                    </div>
                                    <div className="text-xs text-gray-500 mt-1 line-clamp-2">
                                      {problem.description}
                                    </div>
                                    {problem.impact && (
                                      <span className={`inline-flex mt-2 px-2 py-0.5 text-xs rounded-full ${
                                        problem.impact === 'high' ? 'bg-red-100 text-red-800' :
                                        problem.impact === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                                        'bg-green-100 text-green-800'
                                      }`}>
                                        {problem.impact} impact
                                      </span>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                    </>
                  ) : (
                    // No cluster - only show direct problems if any
                    <div>
                      {directProblems?.length > 0 ? (
                        <>
                          <div className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                            🎯 Problems This Solution Addresses ({directProblems.length})
                            <span className="text-xs font-normal text-gray-500" title="Problems specifically selected for this solution">
                              ⓘ
                            </span>
                          </div>
                          <div className="space-y-2">
                            {directProblems.map((problem) => (
                              <div key={problem.id} className="bg-white p-3 rounded border border-blue-200">
                                <div className="text-sm font-medium text-gray-900">
                                  {problem.title}
                                </div>
                                <div className="text-xs text-gray-500 mt-1">
                                  {problem.description?.substring(0, 150)}...
                                </div>
                              </div>
                            ))}
                          </div>
                        </>
                      ) : (
                        <div className="text-sm text-gray-500 italic">
                          No source cluster and no directly mapped problems
                        </div>
                      )}
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

function SolutionsTable() {
  const [searchTerm, setSearchTerm] = useState(''); // Local search state
  
  // Load saved column preferences or use defaults
  const [visibleColumns, setVisibleColumns] = useState(() => {
    const saved = localStorage.getItem('solutions-visible-columns');
    return saved ? JSON.parse(saved) : DEFAULT_COLUMNS;
  });
  
  // Save column preferences when they change
  useEffect(() => {
    localStorage.setItem('solutions-visible-columns', JSON.stringify(visibleColumns));
  }, [visibleColumns]);
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
  } = useTableFeatures(visibleColumns, useMemo(() => getInitialColumnWidths('solutions'), []));
  const [apiFilters, setApiFilters] = useState({
    status: '',
    min_viability: '',
    has_project: '',
    sortBy: 'overall_viability',
    sortOrder: 'DESC'
  });

  // Fetch filter options from database
  const { data: filterOptions } = useQuery({
    queryKey: ['solutions-filter-options'],
    queryFn: getSolutionsFilterOptions,
    staleTime: 1000 * 60 * 10, // Cache for 10 minutes
  });

  const { data: allSolutions, isLoading } = useQuery({
    queryKey: ['solutions', apiFilters],
    queryFn: () => getSolutions(apiFilters),
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    keepPreviousData: true,
  });

  // Client-side filtering for search
  const solutions = useMemo(() => {
    if (!allSolutions) return [];
    if (!searchTerm) return allSolutions;
    
    const term = searchTerm.toLowerCase();
    return allSolutions.filter(solution => 
      solution.title?.toLowerCase().includes(term) ||
      solution.description?.toLowerCase().includes(term) ||
      solution.identifier?.toLowerCase().includes(term)
    );
  }, [allSolutions, searchTerm]);

  const handleSearchChange = useCallback((value) => {
    setSearchTerm(value);
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
    setSearchTerm('');
    setApiFilters({
      status: '',
      min_viability: '',
      has_project: '',
      sortBy: 'overall_viability',
      sortOrder: 'DESC'
    });
  }, []);

  const handleColumnChange = useCallback((newColumns) => {
    // Ensure title column is always visible
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

  if (isLoading && !solutions) {
    return <div className="text-center py-4">Loading solutions...</div>;
  }

  return (
    <div>
      {/* Memoized Filters Section */}
      <FiltersSection
        searchTerm={searchTerm}
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
              {ALL_COLUMNS.filter(col => visibleColumns.includes(col.key)).map(column => (
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
            {solutions?.length === 0 ? (
              <tr>
                <td colSpan={visibleColumns.length} className="px-6 py-4 text-center text-gray-500">
                  No solutions found matching your filters
                </td>
              </tr>
            ) : (
              solutions?.map((solution) => (
                <SolutionRow 
                  key={solution.id} 
                  solution={solution} 
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

export default SolutionsTable;