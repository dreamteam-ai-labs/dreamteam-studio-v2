import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getProblems, getProblemsFilterOptions, getSolutionsByCluster } from '../services/api';
import SearchInput from './SearchInput';
import ColumnSelector from './ColumnSelector';
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

// Simple solution display component
function SolutionsList({ clusterId, solutionCount }) {
  const [show, setShow] = useState(false);
  
  const { data: solutions, isLoading } = useQuery({
    queryKey: ['cluster-solutions', clusterId],
    queryFn: () => getSolutionsByCluster(clusterId),
    enabled: show && !!clusterId,
    staleTime: 1000 * 60 * 5,
  });

  if (!clusterId || solutionCount === 0) return null;

  return (
    <div className="mt-2">
      <button
        onClick={() => setShow(!show)}
        className="text-sm text-primary-600 hover:text-primary-700 font-medium"
      >
        {show ? 'Hide' : 'Show'} Solutions ({solutionCount})
      </button>
      
      {show && (
        <div className="mt-3 space-y-2">
          {isLoading ? (
            <div className="text-sm text-gray-500">Loading...</div>
          ) : (
            solutions?.map((solution) => (
              <div key={solution.id} className="bg-white p-3 rounded border border-gray-200">
                <div className="text-sm font-medium text-gray-900">{solution.title}</div>
                <div className="text-xs text-gray-500 mt-1">
                  Viability: {solution.overall_viability || 'N/A'}%
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function ProblemsTableSimple() {
  const [visibleColumns, setVisibleColumns] = useState(DEFAULT_COLUMNS);
  const [expandedId, setExpandedId] = useState(null);
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

  // Fetch filter options
  const { data: filterOptions } = useQuery({
    queryKey: ['problems-filter-options'],
    queryFn: getProblemsFilterOptions,
    staleTime: 1000 * 60 * 10,
  });

  // Fetch problems
  const { data: problems, isLoading } = useQuery({
    queryKey: ['problems', apiFilters],
    queryFn: () => getProblems(apiFilters),
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    keepPreviousData: true,
  });

  const handleSort = (field) => {
    setApiFilters(prev => ({
      ...prev,
      sortBy: field,
      sortOrder: prev.sortBy === field && prev.sortOrder === 'DESC' ? 'ASC' : 'DESC'
    }));
  };

  const handleClearFilters = () => {
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
  };

  const toggleExpand = (problemId) => {
    setExpandedId(expandedId === problemId ? null : problemId);
  };

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
      {/* Filters */}
      <div className="bg-white p-4 rounded-lg shadow mb-4">
        <div className="flex justify-between items-start mb-4">
          <h2 className="text-lg font-semibold text-gray-800">Filters</h2>
          <ColumnSelector 
            columns={ALL_COLUMNS}
            selectedColumns={visibleColumns}
            onColumnChange={setVisibleColumns}
          />
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Search
            </label>
            <SearchInput 
              onSearchChange={(value) => setApiFilters(prev => ({...prev, search: value}))}
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
                onChange={(e) => setApiFilters(prev => ({...prev, impact: e.target.value}))}
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
                onChange={(e) => setApiFilters(prev => ({...prev, cluster_label: e.target.value}))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="">All</option>
                {filterOptions?.cluster_labels?.map(label => (
                  <option key={label} value={label}>{label}</option>
                ))}
              </select>
            </div>
          )}

          <div className="flex items-end">
            <button
              onClick={handleClearFilters}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors"
            >
              Clear Filters
            </button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow overflow-x-auto">
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
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Industry
                </th>
              )}
              
              {visibleColumns.includes('business_size') && (
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Business Size
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
                  No problems found
                </td>
              </tr>
            ) : (
              problems?.map((problem) => {
                const isExpanded = expandedId === problem.id;
                
                return (
                  <React.Fragment key={problem.id}>
                    <tr className="hover:bg-gray-50">
                      {visibleColumns.includes('title') && (
                        <td className="px-6 py-4">
                          <button
                            onClick={() => toggleExpand(problem.id)}
                            className="flex items-start space-x-2 text-left"
                          >
                            <span className="text-gray-400">
                              {isExpanded ? '▼' : '▶'}
                            </span>
                            <div>
                              <div className="text-sm font-medium text-gray-900">
                                {problem.title}
                              </div>
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
                          </button>
                        </td>
                      )}
                      
                      {visibleColumns.includes('description') && (
                        <td className="px-6 py-4 text-sm text-gray-500">
                          {problem.description?.substring(0, 200)}...
                        </td>
                      )}
                      
                      {visibleColumns.includes('cluster_label') && (
                        <td className="px-6 py-4 text-sm text-gray-900">
                          {problem.cluster_label || '-'}
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
                          {problem.industry || '-'}
                        </td>
                      )}
                      
                      {visibleColumns.includes('business_size') && (
                        <td className="px-6 py-4 text-sm text-gray-900">
                          {problem.business_size || '-'}
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
                          <div className="space-y-2">
                            {problem.cluster_id ? (
                              <div>
                                <div className="text-sm font-medium text-gray-700">
                                  Cluster: {problem.cluster_label}
                                </div>
                                <SolutionsList 
                                  clusterId={problem.cluster_id} 
                                  solutionCount={problem.solution_count}
                                />
                              </div>
                            ) : (
                              <div className="text-sm text-gray-500">
                                No cluster assigned
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default ProblemsTableSimple;