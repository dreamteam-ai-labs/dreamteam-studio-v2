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

// Items per page
const ITEMS_PER_PAGE = 20;

// Simple component to show solutions when requested
function SolutionsDisplay({ clusterId, solutionCount }) {
  const [show, setShow] = useState(false);
  
  const { data: solutions, isLoading } = useQuery({
    queryKey: ['cluster-solutions', clusterId],
    queryFn: () => getSolutionsByCluster(clusterId),
    enabled: show && !!clusterId,
    staleTime: 1000 * 60 * 5,
  });

  if (!clusterId || solutionCount === 0) {
    return <p className="text-sm text-gray-500">No solutions available</p>;
  }

  return (
    <div>
      <button
        onClick={() => setShow(!show)}
        className="text-sm text-primary-600 hover:text-primary-700 font-medium mb-2"
      >
        {show ? '▼ Hide' : '▶ Show'} {solutionCount} Solution{solutionCount > 1 ? 's' : ''}
      </button>
      
      {show && (
        <div className="ml-4 space-y-2">
          {isLoading ? (
            <p className="text-sm text-gray-500">Loading solutions...</p>
          ) : (
            solutions?.slice(0, 5).map((solution) => (
              <div key={solution.id} className="border-l-2 border-blue-200 pl-3">
                <p className="text-sm font-medium text-gray-900">{solution.title}</p>
                <p className="text-xs text-gray-600">
                  Viability: {solution.overall_viability || 'N/A'}%
                  {solution.linear_project_id && ' • ✓ Has Project'}
                </p>
              </div>
            ))
          )}
          {solutions?.length > 5 && (
            <p className="text-xs text-gray-500 italic">...and {solutions.length - 5} more</p>
          )}
        </div>
      )}
    </div>
  );
}

function ProblemsTablePaginated() {
  const [visibleColumns, setVisibleColumns] = useState(DEFAULT_COLUMNS);
  const [expandedId, setExpandedId] = useState(null);
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
    setExpandedId(null); // Close any expanded rows
  };

  const handleSort = (field) => {
    setApiFilters(prev => ({
      ...prev,
      sortBy: field,
      sortOrder: prev.sortBy === field && prev.sortOrder === 'DESC' ? 'ASC' : 'DESC'
    }));
    setCurrentPage(1);
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
            Problems ({totalItems} total)
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
            {currentProblems.map((problem) => (
              <React.Fragment key={problem.id}>
                <tr className="hover:bg-gray-50">
                  {visibleColumns.includes('title') && (
                    <td className="px-4 py-3">
                      <button
                        onClick={() => setExpandedId(expandedId === problem.id ? null : problem.id)}
                        className="text-left w-full"
                      >
                        <div className="flex items-start gap-2">
                          <span className="text-gray-400 mt-0.5">
                            {expandedId === problem.id ? '▼' : '▶'}
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
                              {!problem.cluster_id && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600">
                                  No cluster
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
                
                {expandedId === problem.id && (
                  <tr>
                    <td colSpan={visibleColumns.length} className="px-4 py-4 bg-gray-50">
                      <div className="space-y-3">
                        {/* Problem Details */}
                        <div>
                          <h4 className="text-sm font-semibold text-gray-700 mb-1">Problem Details</h4>
                          <p className="text-sm text-gray-600">{problem.description || 'No description available'}</p>
                          <div className="flex gap-4 mt-2 text-xs text-gray-500">
                            <span>Impact: {problem.impact || 'N/A'}</span>
                            <span>Industry: {problem.industry || 'N/A'}</span>
                            <span>Business Size: {problem.business_size || 'N/A'}</span>
                          </div>
                        </div>
                        
                        {/* Cluster Info */}
                        <div>
                          <h4 className="text-sm font-semibold text-gray-700 mb-1">Cluster Information</h4>
                          {problem.cluster_id ? (
                            <div>
                              <p className="text-sm text-gray-600">
                                This problem belongs to cluster: <strong>{problem.cluster_label}</strong>
                              </p>
                              {problem.cluster_similarity && (
                                <p className="text-xs text-gray-500 mt-1">
                                  Similarity score: {parseFloat(problem.cluster_similarity).toFixed(3)}
                                </p>
                              )}
                            </div>
                          ) : (
                            <p className="text-sm text-gray-500">This problem has not been assigned to a cluster yet.</p>
                          )}
                        </div>
                        
                        {/* Solutions */}
                        <div>
                          <h4 className="text-sm font-semibold text-gray-700 mb-1">Solutions</h4>
                          <SolutionsDisplay 
                            clusterId={problem.cluster_id} 
                            solutionCount={problem.solution_count}
                          />
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
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

export default ProblemsTablePaginated;