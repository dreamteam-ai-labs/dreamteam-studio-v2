import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getProblems, getProblemsFilterOptions, getSolutionsByCluster } from '../services/api';
import SearchInput from './SearchInput';
import ColumnSelector from './ColumnSelector';

// Define all available columns
const ALL_COLUMNS = [
  { key: 'title', label: 'Title', required: true },
  { key: 'description', label: 'Description', required: false },
  { key: 'cluster_label', label: 'Cluster', required: false },
  { key: 'impact', label: 'Impact', required: false },
  { key: 'solution_count', label: 'Solutions', required: false },
  { key: 'created_at', label: 'Created', required: false },
];

// Default visible columns
const DEFAULT_COLUMNS = ['title', 'cluster_label', 'impact', 'solution_count'];

// Items per page for pagination
const ITEMS_PER_PAGE = 20;

function ProblemsTableMultiLevel() {
  const [visibleColumns, setVisibleColumns] = useState(DEFAULT_COLUMNS);
  const [expandedProblems, setExpandedProblems] = useState(new Set());
  const [expandedClusters, setExpandedClusters] = useState(new Set());
  const [loadedSolutions, setLoadedSolutions] = useState({});
  const [currentPage, setCurrentPage] = useState(1);
  const [apiFilters, setApiFilters] = useState({
    search: '',
    impact: '',
    cluster_label: '',
    sortBy: 'created_at',
    sortOrder: 'DESC'
  });

  // Fetch problems
  const { data: problems, isLoading } = useQuery({
    queryKey: ['problems', apiFilters],
    queryFn: () => getProblems(apiFilters),
    refetchOnWindowFocus: false,
  });

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
        // Load solutions if not already loaded
        if (clusterId && !loadedSolutions[clusterId]) {
          loadSolutions(clusterId);
        }
      }
      return newSet;
    });
  };

  const loadSolutions = async (clusterId) => {
    try {
      const solutions = await getSolutionsByCluster(clusterId);
      setLoadedSolutions(prev => ({
        ...prev,
        [clusterId]: solutions
      }));
    } catch (error) {
      console.error('Error loading solutions:', error);
    }
  };

  if (isLoading) {
    return <div className="text-center py-4">Loading...</div>;
  }

  return (
    <div>
      {/* Filters */}
      <div className="bg-white p-4 rounded-lg shadow mb-4">
        <div className="flex justify-between items-start mb-4">
          <h2 className="text-lg font-semibold">
            Problems ({totalItems} total) - Multi-Level View
          </h2>
          <ColumnSelector 
            columns={ALL_COLUMNS}
            selectedColumns={visibleColumns}
            onColumnChange={setVisibleColumns}
          />
        </div>
        
        <div className="flex gap-4">
          <SearchInput 
            onSearchChange={(value) => updateFilter('search', value)}
            placeholder="Search..."
          />
          
          <select
            value={apiFilters.impact}
            onChange={(e) => updateFilter('impact', e.target.value)}
            className="px-3 py-2 border rounded"
          >
            <option value="">All Impact</option>
            {filterOptions?.impacts?.map(i => (
              <option key={i} value={i}>{i}</option>
            ))}
          </select>

          <select
            value={apiFilters.cluster_label}
            onChange={(e) => updateFilter('cluster_label', e.target.value)}
            className="px-3 py-2 border rounded"
          >
            <option value="">All Clusters</option>
            {filterOptions?.cluster_labels?.map(label => (
              <option key={label} value={label}>{label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              {visibleColumns.includes('title') && (
                <th 
                  onClick={() => handleSort('title')}
                  className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100"
                >
                  Title {apiFilters.sortBy === 'title' && (apiFilters.sortOrder === 'DESC' ? '↓' : '↑')}
                </th>
              )}
              {visibleColumns.includes('description') && (
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                  Description
                </th>
              )}
              {visibleColumns.includes('cluster_label') && (
                <th 
                  onClick={() => handleSort('cluster_label')}
                  className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100"
                >
                  Cluster {apiFilters.sortBy === 'cluster_label' && (apiFilters.sortOrder === 'DESC' ? '↓' : '↑')}
                </th>
              )}
              {visibleColumns.includes('impact') && (
                <th 
                  onClick={() => handleSort('impact')}
                  className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100"
                >
                  Impact {apiFilters.sortBy === 'impact' && (apiFilters.sortOrder === 'DESC' ? '↓' : '↑')}
                </th>
              )}
              {visibleColumns.includes('solution_count') && (
                <th 
                  onClick={() => handleSort('solution_count')}
                  className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100"
                >
                  Solutions {apiFilters.sortBy === 'solution_count' && (apiFilters.sortOrder === 'DESC' ? '↓' : '↑')}
                </th>
              )}
              {visibleColumns.includes('created_at') && (
                <th 
                  onClick={() => handleSort('created_at')}
                  className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100"
                >
                  Created {apiFilters.sortBy === 'created_at' && (apiFilters.sortOrder === 'DESC' ? '↓' : '↑')}
                </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {currentProblems.map((problem) => {
              const isProblemExpanded = expandedProblems.has(problem.id);
              const clusterKey = `${problem.id}-cluster`;
              const isClusterExpanded = expandedClusters.has(clusterKey);
              const solutions = problem.cluster_id ? loadedSolutions[problem.cluster_id] : null;

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
                                    💡 {problem.solution_count}
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
                    {visibleColumns.includes('solution_count') && (
                      <td className="px-4 py-3 text-sm">
                        {problem.solution_count || 0}
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
                            
                            {/* Cluster and Solutions Section */}
                            <div>
                              <h4 className="text-sm font-semibold text-gray-700 mb-3">Related Information</h4>
                              
                              {problem.cluster_id ? (
                                <>
                                  <div className="text-sm text-gray-600 mb-3">
                                    Cluster: <span className="font-medium">{problem.cluster_label}</span>
                                    {problem.cluster_similarity && (
                                      <span className="text-xs text-gray-500 ml-2">
                                        (Similarity: {parseFloat(problem.cluster_similarity).toFixed(3)})
                                      </span>
                                    )}
                                  </div>
                                  
                                  <button
                                    onClick={() => toggleCluster(problem.id, problem.cluster_id)}
                                    className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 mb-3"
                                  >
                                    <span className="text-gray-400">
                                      {isClusterExpanded ? '▼' : '▶'}
                                    </span>
                                    <span>View Solutions for this Cluster</span>
                                    {problem.solution_count > 0 && (
                                      <span className="text-xs text-gray-500">
                                        ({problem.solution_count} available)
                                      </span>
                                    )}
                                  </button>
                                
                                  {/* Solutions (when expanded) */}
                                  {isClusterExpanded && (
                                    <div>
                                      {!solutions ? (
                                        <p className="text-sm text-gray-500 italic">Loading solutions...</p>
                                      ) : solutions.length === 0 ? (
                                        <p className="text-sm text-gray-500 italic">No solutions available for this cluster</p>
                                      ) : (
                                        <div className="space-y-3">
                                        {solutions.slice(0, 5).map((solution) => (
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
                                        ))}
                                        {solutions.length > 5 && (
                                          <p className="text-xs text-gray-500 italic">
                                            ...and {solutions.length - 5} more solutions
                                          </p>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                )}
                              </>
                            ) : (
                              <div className="bg-white p-3 rounded border border-gray-200">
                                <p className="text-sm text-gray-500 italic">
                                  This problem has not been assigned to a cluster yet.
                                </p>
                              </div>
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
        
        {/* Pagination */}
        {totalPages > 1 && (
          <div className="bg-gray-50 px-4 py-3 flex items-center justify-between border-t">
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
        )}
      </div>
    </div>
  );
}

export default ProblemsTableMultiLevel;