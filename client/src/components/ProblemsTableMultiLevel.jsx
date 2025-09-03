import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getProblems, getProblemsFilterOptions, getSolutionsByCluster, getSolutionsByProblem } from '../services/api';
import SearchInput from './SearchInput';
import ColumnSelector from './ColumnSelector';
import TableHeader from './TableHeader';
import { useTableFeatures } from '../hooks/useTableFeatures';
import { TAB_COLUMNS, DEFAULT_VISIBLE_COLUMNS, getCellClassName, getColumnStyle, getInitialColumnWidths } from '../config/tableConfig';
import '../styles/tables.css';

// Use centralized column definitions
const ALL_COLUMNS = TAB_COLUMNS.problems;
const DEFAULT_COLUMNS = DEFAULT_VISIBLE_COLUMNS.problems;

// Items per page for pagination
const ITEMS_PER_PAGE = 20;

// Component to display solutions for a problem
function ProblemSolutions({ problemId, clusterId, clusterLabel }) {
  // Fetch direct solutions for this problem
  const { data: directSolutions, isLoading: directLoading } = useQuery({
    queryKey: ['problem-direct-solutions', problemId],
    queryFn: () => getSolutionsByProblem(problemId),
    enabled: !!problemId,
  });
  
  // Fetch cluster solutions
  const { data: clusterSolutions, isLoading: clusterLoading } = useQuery({
    queryKey: ['problem-cluster-solutions', clusterId],
    queryFn: () => getSolutionsByCluster(clusterId),
    enabled: !!clusterId,
  });
  
  const renderSolution = (solution) => (
    <div key={solution.id} className="bg-white p-3 rounded border border-green-200">
      <div className="flex justify-between items-start">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-900">{solution.title}</p>
          {solution.description && (
            <p className="text-xs text-gray-600 mt-1 line-clamp-2">
              {solution.description}
            </p>
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
  );
  
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Direct Solutions */}
      <div>
        <div className="text-sm font-semibold text-gray-700 mb-2">
          🎯 Direct Solutions
        </div>
        {directLoading ? (
          <p className="text-sm text-gray-500 italic">Loading direct solutions...</p>
        ) : !directSolutions || directSolutions.length === 0 ? (
          <p className="text-sm text-gray-500 italic">No direct solutions for this problem</p>
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {directSolutions.map(renderSolution)}
          </div>
        )}
      </div>
      
      {/* Cluster Solutions */}
      <div>
        <div className="text-sm font-semibold text-gray-700 mb-2">
          📊 Cluster Solutions {clusterLabel && <span className="text-xs font-normal text-gray-500">({clusterLabel})</span>}
        </div>
        {!clusterId ? (
          <p className="text-sm text-gray-500 italic">This problem is not assigned to a cluster</p>
        ) : clusterLoading ? (
          <p className="text-sm text-gray-500 italic">Loading cluster solutions...</p>
        ) : !clusterSolutions || clusterSolutions.length === 0 ? (
          <p className="text-sm text-gray-500 italic">No solutions for this cluster</p>
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {clusterSolutions.map(renderSolution)}
          </div>
        )}
      </div>
    </div>
  );
}

function ProblemsTableMultiLevel({ filters: externalFilters, onFiltersChange, onDataFiltered }) {
  // Load saved column preferences or use defaults
  const [visibleColumns, setVisibleColumns] = useState(() => {
    const saved = localStorage.getItem('problems-visible-columns');
    return saved ? JSON.parse(saved) : DEFAULT_COLUMNS;
  });
  const [expandedProblems, setExpandedProblems] = useState(new Set());
  const [expandedClusters, setExpandedClusters] = useState(new Set());
  
  // Use external pagination if provided
  const currentPage = externalFilters?.currentPage || 1;
  const setCurrentPage = (page) => {
    if (onFiltersChange) {
      onFiltersChange(prev => ({ ...prev, currentPage: page }));
    }
  };
  
  // Use external search if provided
  const searchTerm = externalFilters?.searchTerm || '';
  
  // Save column preferences when they change
  useEffect(() => {
    localStorage.setItem('problems-visible-columns', JSON.stringify(visibleColumns));
  }, [visibleColumns]);

  // Add table features hook for column resizing with initial widths
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
  } = useTableFeatures(visibleColumns, useMemo(() => getInitialColumnWidths('problems'), []));
  
  // Build API filters from external filters if provided
  const [apiFilters, setApiFilters] = useState({
    impact: externalFilters?.impact?.[0] || '',
    cluster_label: '',
    sortBy: 'created_at',
    sortOrder: 'DESC'
  });
  
  // Update API filters when external filters change
  useEffect(() => {
    if (externalFilters) {
      setApiFilters(prev => ({
        ...prev,
        impact: '', // Let client-side filtering handle this
        cluster_label: '' // Let client-side filtering handle this
      }));
    }
  }, [externalFilters]);

  // Fetch ALL problems (without search filter)
  const { data: allProblems, isLoading } = useQuery({
    queryKey: ['problems', apiFilters],
    queryFn: () => getProblems(apiFilters),
    refetchOnWindowFocus: false,
  });

  // Client-side filtering for search and external filters
  const problems = useMemo(() => {
    if (!allProblems) return [];
    
    let filtered = allProblems;
    
    // Apply search term
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(problem => 
        problem.title?.toLowerCase().includes(term) ||
        problem.description?.toLowerCase().includes(term) ||
        problem.cluster_label?.toLowerCase().includes(term) ||
        problem.identifier?.toLowerCase().includes(term)
      );
    }
    
    // Apply external filters if provided
    if (externalFilters) {
      // Title filter
      if (externalFilters.title) {
        const titleTerm = externalFilters.title.toLowerCase();
        filtered = filtered.filter(problem => 
          problem.title?.toLowerCase().includes(titleTerm)
        );
      }
      
      // Description filter
      if (externalFilters.description) {
        const descTerm = externalFilters.description.toLowerCase();
        filtered = filtered.filter(problem => 
          problem.description?.toLowerCase().includes(descTerm)
        );
      }
      
      // Cluster label filter
      if (externalFilters.cluster_label) {
        const clusterTerm = externalFilters.cluster_label.toLowerCase();
        filtered = filtered.filter(problem => 
          problem.cluster_label?.toLowerCase().includes(clusterTerm)
        );
      }
      
      // Impact filter (multiple selection)
      if (externalFilters.impact?.length > 0) {
        filtered = filtered.filter(problem => 
          externalFilters.impact.includes(problem.impact)
        );
      }
      
      // Industry filter
      if (externalFilters.industry?.length > 0) {
        filtered = filtered.filter(problem => 
          externalFilters.industry.includes(problem.industry)
        );
      }
      
      // Business size filter
      if (externalFilters.businessSize?.length > 0) {
        filtered = filtered.filter(problem => 
          externalFilters.businessSize.includes(problem.business_size)
        );
      }
      
      // Solution count filter (minimum)
      if (externalFilters.solution_count !== null && externalFilters.solution_count !== undefined) {
        filtered = filtered.filter(problem => 
          (problem.solution_count || 0) >= externalFilters.solution_count
        );
      }
      
      // Project count filter (minimum)
      if (externalFilters.project_count !== null && externalFilters.project_count !== undefined) {
        filtered = filtered.filter(problem => 
          (problem.project_count || 0) >= externalFilters.project_count
        );
      }
      
      // Created date filter (after date)
      if (externalFilters.created_at) {
        const filterDate = new Date(externalFilters.created_at);
        filtered = filtered.filter(problem => {
          const problemDate = new Date(problem.created_at);
          return problemDate >= filterDate;
        });
      }
    }
    
    return filtered;
  }, [allProblems, searchTerm, externalFilters]);

  // Pass filtered data back to parent
  useEffect(() => {
    if (onDataFiltered) {
      onDataFiltered(problems);
    }
  }, [problems, onDataFiltered]);

  // Fetch filter options
  const { data: filterOptions } = useQuery({
    queryKey: ['problems-filter-options'],
    queryFn: getProblemsFilterOptions,
  });

  // Calculate pagination
  const totalItems = problems?.length || 0;
  const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const currentProblems = problems?.slice(startIndex, endIndex) || [];

  // Reset to page 1 when filters change
  const updateFilter = (key, value) => {
    setApiFilters(prev => ({...prev, [key]: value}));
    setCurrentPage(1);
    setExpandedProblems(new Set());
    setExpandedClusters(new Set());
  };

  const handleSort = (field) => {
    setApiFilters(prev => ({
      ...prev,
      sortBy: field,
      sortOrder: prev.sortBy === field && prev.sortOrder === 'DESC' ? 'ASC' : 'DESC'
    }));
    setCurrentPage(1);
  };

  const handleColumnChange = useCallback((newColumns) => {
    // Ensure title column is always visible
    if (!newColumns.includes('title')) {
      newColumns = ['title', ...newColumns];
    }
    setVisibleColumns(newColumns);
    // Update top scroll width after columns change
    setTimeout(updateTopScrollWidth, 0);
  }, [updateTopScrollWidth]);

  const toggleProblem = (problemId) => {
    setExpandedProblems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(problemId)) {
        newSet.delete(problemId);
        // Also collapse cluster when problem is collapsed
        const key = `${problemId}-cluster`;
        setExpandedClusters(prev => {
          const clusterSet = new Set(prev);
          clusterSet.delete(key);
          return clusterSet;
        });
      } else {
        newSet.add(problemId);
      }
      return newSet;
    });
  };

  const toggleCluster = (problemId, clusterId) => {
    const key = `${problemId}-cluster`;
    setExpandedClusters(prev => {
      const newSet = new Set(prev);
      if (newSet.has(key)) {
        newSet.delete(key);
      } else {
        newSet.add(key);
      }
      return newSet;
    });
  };

  if (isLoading) {
    return <div className="text-center py-4">Loading...</div>;
  }

  return (
    <div>
      {/* Only show local filters if no external filters provided */}
      {!externalFilters && (
        <div className="bg-white p-4 rounded-lg shadow mb-4">
          <h2 className="text-lg font-semibold">Filters</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Search
              </label>
              <SearchInput 
                onSearchChange={(value) => setSearchTerm(value)}
                placeholder="Search problems..."
                value={searchTerm}
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Impact Level
              </label>
              <select
                value={apiFilters.impact}
                onChange={(e) => updateFilter('impact', e.target.value)}
                className="w-full px-3 py-2 border rounded"
              >
                <option value="">All Impact Levels</option>
                {filterOptions?.impacts?.map(i => (
                  <option key={i} value={i}>{i}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Cluster
              </label>
              <select
                value={apiFilters.cluster_label}
                onChange={(e) => updateFilter('cluster_label', e.target.value)}
                className="w-full px-3 py-2 border rounded"
              >
                <option value="">All Clusters</option>
                {filterOptions?.cluster_labels?.map(label => (
                  <option key={label} value={label}>{label}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      <div className={`bg-white rounded-lg shadow table-container ${isResizing ? 'resizing' : ''}`}>
        {/* Table Header */}
        <div className="p-4 border-b border-gray-200">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold text-gray-800">
              Problems ({totalItems} total) - Multi-Level View
            </h2>
            <ColumnSelector 
              columns={ALL_COLUMNS}
              selectedColumns={visibleColumns}
              onColumnChange={handleColumnChange}
            />
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
          <tbody className="divide-y divide-gray-200">
            {currentProblems.map((problem) => {
              const isProblemExpanded = expandedProblems.has(problem.id);
              const clusterKey = `${problem.id}-cluster`;
              const isClusterExpanded = expandedClusters.has(clusterKey);

              return (
                <React.Fragment key={problem.id}>
                  {/* Level 1: Problem Row */}
                  <tr className="hover:bg-gray-50">
                    {visibleColumns.includes('title') && (
                      <td className="px-4 py-3">
                        <button
                          onClick={() => toggleProblem(problem.id)}
                          className="text-left w-full"
                        >
                          <div className="flex items-start gap-2">
                            <span className="text-gray-400 mt-0.5">
                              {isProblemExpanded ? '▼' : '▶'}
                            </span>
                            <div>
                              <p className="text-sm font-medium text-gray-900">{problem.title}</p>
                              <div className="flex gap-2 mt-1">
                                {problem.cluster_label && (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800">
                                    📊 {problem.cluster_label}
                                  </span>
                                )}
                                {problem.solution_count > 0 && (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                                    💡 {problem.solution_count} solution{problem.solution_count > 1 ? 's' : ''}
                                  </span>
                                )}
                                {problem.project_count > 0 && (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800">
                                    🚀 {problem.project_count} project{problem.project_count > 1 ? 's' : ''}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </button>
                      </td>
                    )}
                    {visibleColumns.includes('description') && (
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {problem.description?.substring(0, 100)}...
                      </td>
                    )}
                    {visibleColumns.includes('cluster_label') && (
                      <td className="px-4 py-3 text-sm">
                        {problem.cluster_label || '-'}
                      </td>
                    )}
                    {visibleColumns.includes('impact') && (
                      <td className="px-4 py-3 text-sm">
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
                      <td className="px-4 py-3 text-sm text-gray-700">
                        {problem.industry || '-'}
                      </td>
                    )}
                    {visibleColumns.includes('business_size') && (
                      <td className="px-4 py-3 text-sm text-gray-700">
                        {problem.business_size || '-'}
                      </td>
                    )}
                    {visibleColumns.includes('solution_count') && (
                      <td className="px-4 py-3 text-sm">
                        {problem.solution_count || 0}
                      </td>
                    )}
                    {visibleColumns.includes('project_count') && (
                      <td className="px-4 py-3 text-sm">
                        {problem.project_count || 0}
                      </td>
                    )}
                    {visibleColumns.includes('created_at') && (
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {new Date(problem.created_at).toLocaleDateString()}
                      </td>
                    )}
                  </tr>
                  
                  {/* Level 2: Problem Details (when expanded) */}
                  {isProblemExpanded && (
                    <tr>
                      <td colSpan={visibleColumns.length} className="px-6 py-0">
                        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-4 mb-4 rounded">
                          <div className="space-y-4">
                            {/* Problem Details Section */}
                            <div>
                              <h4 className="text-sm font-semibold text-gray-700 mb-2">Problem Details</h4>
                              <div className="bg-white p-3 rounded border border-gray-200">
                                <p className="text-sm text-gray-700">{problem.description || 'No description available'}</p>
                                <div className="grid grid-cols-3 gap-4 mt-3 text-sm">
                                  <div>
                                    <span className="text-gray-500">Impact:</span>
                                    <span className={`ml-2 font-medium ${
                                      problem.impact === 'high' ? 'text-red-600' :
                                      problem.impact === 'medium' ? 'text-yellow-600' :
                                      'text-green-600'
                                    }`}>
                                      {problem.impact || 'N/A'}
                                    </span>
                                  </div>
                                  <div>
                                    <span className="text-gray-500">Industry:</span>
                                    <span className="ml-2 text-gray-700">{problem.industry || 'N/A'}</span>
                                  </div>
                                  <div>
                                    <span className="text-gray-500">Business Size:</span>
                                    <span className="ml-2 text-gray-700">{problem.business_size || 'N/A'}</span>
                                  </div>
                                </div>
                              </div>
                            </div>
                            
                            {/* Solutions Section */}
                            <div>
                              <button
                                onClick={() => toggleCluster(problem.id, problem.cluster_id)}
                                className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-3"
                              >
                                <span className="text-gray-400">
                                  {isClusterExpanded ? '▼' : '▶'}
                                </span>
                                <span>Solutions</span>
                                {problem.solution_count > 0 && (
                                  <span className="text-xs text-gray-500">
                                    ({problem.solution_count} total)
                                  </span>
                                )}
                              </button>
                              
                              {/* Expanded Solutions View */}
                              {isClusterExpanded && (
                                <ProblemSolutions 
                                  problemId={problem.id}
                                  clusterId={problem.cluster_id}
                                  clusterLabel={problem.cluster_label}
                                />
                              )}
                          </div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
          </table>
        </div>
      </div>
        
      {/* Pagination */}
      {totalPages > 1 && (
        <div className="bg-white rounded-lg shadow mt-4">
          <div className="px-4 py-3 flex items-center justify-between border-t">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1 text-sm bg-white border rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                Previous
              </button>
              
              <span className="text-sm text-gray-700">
                Page {currentPage} of {totalPages}
              </span>
              
              <button
                onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-1 text-sm bg-white border rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                Next
              </button>
            </div>
            
            <div className="text-sm text-gray-500">
              Showing {startIndex + 1}-{Math.min(endIndex, totalItems)} of {totalItems}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ProblemsTableMultiLevel;