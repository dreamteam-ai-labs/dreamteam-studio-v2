import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getProblems, getProblemsFilterOptions, getSolutionsByCluster, getSolutionsByProblem } from '../services/api';
import SearchInput from './SearchInput';
import ColumnSelector from './ColumnSelector';
import TableHeader from './TableHeader';
import StudyModeModal from './StudyModeModal';
import { useTableFeatures } from '../hooks/useTableFeatures';
import { usePinnedEntities } from '../hooks/usePinnedEntities';
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
  // Initialize pinning functionality
  const {
    pinnedIds,
    togglePin,
    isPinned,
    separateEntities,
    clearAll
  } = usePinnedEntities('pinned-problems');
  
  // Load saved column preferences or use defaults
  const [visibleColumns, setVisibleColumns] = useState(() => {
    const saved = localStorage.getItem('problems-visible-columns');
    return saved ? JSON.parse(saved) : DEFAULT_COLUMNS;
  });
  const [expandedProblems, setExpandedProblems] = useState(new Set());
  const [expandedClusters, setExpandedClusters] = useState(new Set());
  const [selectedItems, setSelectedItems] = useState(new Set());
  const [studyModalOpen, setStudyModalOpen] = useState(false);
  const [studyEntity, setStudyEntity] = useState(null);
  const [studyEntityType, setStudyEntityType] = useState(null);
  
  // Load collapsed state for filters
  const [isFiltersCollapsed, setIsFiltersCollapsed] = useState(() => {
    const saved = localStorage.getItem('problems-filters-collapsed');
    return saved === 'true';
  });
  
  // Selection handlers
  const handleSelectAll = (problems) => {
    const allIds = problems.map(p => p.id);
    if (selectedItems.size === allIds.length && allIds.every(id => selectedItems.has(id))) {
      // All are selected, so deselect all
      setSelectedItems(new Set());
    } else {
      // Select all
      setSelectedItems(new Set(allIds));
    }
  };
  
  const handleSelectItem = (itemId) => {
    setSelectedItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(itemId)) {
        newSet.delete(itemId);
      } else {
        newSet.add(itemId);
      }
      return newSet;
    });
  };
  
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

  const openStudyMode = (entity, type) => {
    setStudyEntity(entity);
    setStudyEntityType(type);
    setStudyModalOpen(true);
  };

  if (isLoading) {
    return <div className="text-center py-4">Loading...</div>;
  }

  return (
    <div>
      {/* Only show local filters if no external filters provided */}
      {!externalFilters && (
        <div className="bg-white p-4 rounded-lg shadow mb-4">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold">Filters</h2>
            <button
              onClick={() => {
                const newState = !isFiltersCollapsed;
                setIsFiltersCollapsed(newState);
                localStorage.setItem('problems-filters-collapsed', newState.toString());
              }}
              className="text-sm text-gray-600 hover:text-gray-800 flex items-center gap-1"
              title={isFiltersCollapsed ? "Show advanced filters" : "Hide advanced filters"}
            >
              <span>{isFiltersCollapsed ? 'Show Advanced' : 'Hide Advanced'}</span>
              <svg 
                className={`w-4 h-4 transition-transform ${isFiltersCollapsed ? 'rotate-180' : ''}`}
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </div>
          
          {/* Always show search */}
          <div className="mb-3">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Search
            </label>
            <SearchInput 
              onSearchChange={(value) => setSearchTerm(value)}
              placeholder="Search problems..."
              value={searchTerm}
            />
          </div>
          
          {/* Collapsible advanced filters */}
          {!isFiltersCollapsed && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-3 border-t border-gray-200">
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
          )}
        </div>
      )}

      {/* Table */}
      <div className={`bg-white rounded-lg shadow table-container ${isResizing ? 'resizing' : ''}`}>
        {/* Table Header */}
        <div className="p-4 border-b border-gray-200">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-4">
              <h2 className="text-lg font-semibold text-gray-800">
                Problems ({totalItems} total) - Multi-Level View
              </h2>
              {pinnedIds.length > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-500">
                    {pinnedIds.length} pinned
                  </span>
                  <button
                    onClick={clearAll}
                    className="text-sm text-blue-600 hover:text-blue-800 underline"
                  >
                    Clear all pins
                  </button>
                </div>
              )}
            </div>
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
                <th className="px-3 py-3 text-center" style={{ width: '40px' }}>
                  <input
                    type="checkbox"
                    className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 focus:ring-2"
                    title="Select all"
                    checked={currentProblems?.length > 0 && currentProblems.every(p => selectedItems.has(p.id))}
                    onChange={() => handleSelectAll(currentProblems)}
                  />
                </th>
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
                <th className="px-3 py-3 text-center" style={{ width: '50px' }}>
                  <span className="sr-only">Pin</span>
                </th>
              </tr>
            </thead>
          <tbody className="divide-y divide-gray-200">
            {/* Pinned problems first */}
            {separateEntities(currentProblems).pinned.map((problem) => {
              const isProblemExpanded = expandedProblems.has(problem.id);
              const clusterKey = `${problem.id}-cluster`;
              const isClusterExpanded = expandedClusters.has(clusterKey);

              return (
                <React.Fragment key={problem.id}>
                  {/* Level 1: Problem Row */}
                  <tr className={`hover:bg-gray-50 ${isPinned(problem.id) ? 'bg-blue-50 border-l-4 border-blue-500' : ''}`}>
                    <td className="px-3 py-3 text-center" style={{ width: '40px' }}>
                      <input
                        type="checkbox"
                        className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 focus:ring-2"
                        checked={selectedItems.has(problem.id)}
                        onChange={() => handleSelectItem(problem.id)}
                        onClick={(e) => e.stopPropagation()}
                        title="Select for bulk actions"
                      />
                    </td>
                    {visibleColumns.includes('title') && (
                      <td className="px-4 py-3 cursor-pointer" onClick={() => toggleProblem(problem.id)}>
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
                    <td className="px-3 py-3 text-center" style={{ width: '100px' }}>
                      <div className="flex gap-1 justify-center">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            openStudyMode(problem, 'problem');
                          }}
                          className="p-2 rounded-lg transition-all transform hover:scale-110 text-purple-500 hover:text-purple-700 hover:bg-purple-100"
                          title="Study this problem"
                        >
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/>
                          </svg>
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            togglePin(problem.id);
                          }}
                          className={`p-2 rounded-lg transition-all transform hover:scale-110 ${
                            isPinned(problem.id) 
                              ? 'text-blue-600 bg-blue-50 hover:bg-blue-100' 
                              : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
                          }`}
                          title={isPinned(problem.id) ? 'Unpin' : 'Pin to top'}
                        >
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M16,12V4H17V2H7V4H8V12L6,14V16H11.2V22H12.8V16H18V14L16,12Z" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                  
                  {/* Level 2: Problem Details (when expanded) */}
                  {isProblemExpanded && (
                    <tr>
                      <td colSpan={visibleColumns.length + 2} className="px-6 py-0">
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
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleCluster(problem.id, problem.cluster_id);
                                }}
                                className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-3 hover:text-gray-900"
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
            
            {/* Divider between pinned and unpinned */}
            {separateEntities(currentProblems).pinned.length > 0 && separateEntities(currentProblems).unpinned.length > 0 && (
              <tr className="bg-gray-100">
                <td colSpan={visibleColumns.length + 2} className="px-6 py-2 text-xs text-gray-500 font-medium">
                  Other Problems
                </td>
              </tr>
            )}
            
            {/* Unpinned problems */}
            {separateEntities(currentProblems).unpinned.map((problem) => {
              const isProblemExpanded = expandedProblems.has(problem.id);
              const clusterKey = `${problem.id}-cluster`;
              const isClusterExpanded = expandedClusters.has(clusterKey);

              return (
                <React.Fragment key={problem.id}>
                  {/* Level 1: Problem Row */}
                  <tr className={`hover:bg-gray-50 ${isPinned(problem.id) ? 'bg-blue-50 border-l-4 border-blue-500' : ''}`}>
                    <td className="px-3 py-3 text-center" style={{ width: '40px' }}>
                      <input
                        type="checkbox"
                        className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 focus:ring-2"
                        checked={selectedItems.has(problem.id)}
                        onChange={() => handleSelectItem(problem.id)}
                        onClick={(e) => e.stopPropagation()}
                        title="Select for bulk actions"
                      />
                    </td>
                    {visibleColumns.includes('title') && (
                      <td className="px-4 py-3 cursor-pointer" onClick={() => toggleProblem(problem.id)}>
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
                    <td className="px-3 py-3 text-center" style={{ width: '100px' }}>
                      <div className="flex gap-1 justify-center">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            openStudyMode(problem, 'problem');
                          }}
                          className="p-2 rounded-lg transition-all transform hover:scale-110 text-purple-500 hover:text-purple-700 hover:bg-purple-100"
                          title="Study this problem"
                        >
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/>
                          </svg>
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            togglePin(problem.id);
                          }}
                          className={`p-2 rounded-lg transition-all transform hover:scale-110 ${
                            isPinned(problem.id) 
                              ? 'text-blue-600 bg-blue-50 hover:bg-blue-100' 
                              : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
                          }`}
                          title={isPinned(problem.id) ? 'Unpin' : 'Pin to top'}
                        >
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M16,12V4H17V2H7V4H8V12L6,14V16H11.2V22H12.8V16H18V14L16,12Z" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                  
                  {/* Level 2: Problem Details (when expanded) */}
                  {isProblemExpanded && (
                    <tr>
                      <td colSpan={visibleColumns.length + 2} className="px-6 py-0">
                        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-4 mb-4 rounded">
                          <div className="space-y-4">
                            {/* Problem Details Section */}
                            <div>
                              <h4 className="text-sm font-semibold text-gray-700 mb-2">Problem Details</h4>
                              <div className="bg-white p-3 rounded border border-gray-200">
                                <p className="text-sm text-gray-700">{problem.description}</p>
                                <div className="mt-3 flex flex-wrap gap-2">
                                  {problem.source_url && (
                                    <a
                                      href={problem.source_url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-xs text-blue-600 hover:text-blue-800"
                                    >
                                      🔗 View Source
                                    </a>
                                  )}
                                  <span className="text-xs text-gray-500">
                                    Created: {new Date(problem.created_at).toLocaleDateString()}
                                  </span>
                                  {problem.last_checked && (
                                    <span className="text-xs text-gray-500">
                                      Last checked: {new Date(problem.last_checked).toLocaleDateString()}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                            
                            {/* Solutions Section */}
                            <div className="space-y-2">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleCluster(problem.id, problem.cluster_id);
                                }}
                                className="flex items-center gap-2 text-sm font-semibold text-gray-700 hover:text-primary-600 transition-colors"
                              >
                                <span className="text-gray-400">
                                  {isClusterExpanded ? '▼' : '▶'}
                                </span>
                                Solutions
                                {(problem.solution_count > 0 || problem.cluster_label) && (
                                  <span className="text-xs text-gray-500 font-normal">
                                    ({problem.solution_count} direct, cluster solutions available)
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
      
      {/* Study Mode Modal */}
      <StudyModeModal 
        isOpen={studyModalOpen}
        onClose={() => setStudyModalOpen(false)}
        initialEntity={studyEntity}
        entityType={studyEntityType}
      />
    </div>
  );
}

export default ProblemsTableMultiLevel;