import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getProblems, getProblemsFilterOptions } from '../services/api';
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

function ProblemsTableBasic() {
  const [visibleColumns, setVisibleColumns] = useState(DEFAULT_COLUMNS);
  const [expandedId, setExpandedId] = useState(null);
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

  if (isLoading) {
    return <div className="text-center py-4">Loading...</div>;
  }

  return (
    <div>
      {/* Simple Filters */}
      <div className="bg-white p-4 rounded-lg shadow mb-4">
        <div className="flex justify-between items-start mb-4">
          <h2 className="text-lg font-semibold">Problems</h2>
          <ColumnSelector 
            columns={ALL_COLUMNS}
            selectedColumns={visibleColumns}
            onColumnChange={setVisibleColumns}
          />
        </div>
        
        <div className="flex gap-4">
          <SearchInput 
            onSearchChange={(value) => setApiFilters(prev => ({...prev, search: value}))}
            placeholder="Search..."
          />
          
          <select
            value={apiFilters.impact}
            onChange={(e) => setApiFilters(prev => ({...prev, impact: e.target.value}))}
            className="px-3 py-2 border rounded"
          >
            <option value="">All Impact</option>
            {filterOptions?.impacts?.map(i => (
              <option key={i} value={i}>{i}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Simple Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              {visibleColumns.includes('title') && (
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                  Title
                </th>
              )}
              {visibleColumns.includes('description') && (
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                  Description
                </th>
              )}
              {visibleColumns.includes('cluster_label') && (
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                  Cluster
                </th>
              )}
              {visibleColumns.includes('impact') && (
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                  Impact
                </th>
              )}
              {visibleColumns.includes('solution_count') && (
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                  Solutions
                </th>
              )}
              {visibleColumns.includes('created_at') && (
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                  Created
                </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {problems?.map((problem) => (
              <React.Fragment key={problem.id}>
                <tr className="hover:bg-gray-50">
                  {visibleColumns.includes('title') && (
                    <td className="px-4 py-2">
                      <button
                        onClick={() => setExpandedId(expandedId === problem.id ? null : problem.id)}
                        className="text-left"
                      >
                        <span className="mr-2">
                          {expandedId === problem.id ? '▼' : '▶'}
                        </span>
                        <span className="text-sm font-medium">{problem.title}</span>
                        {problem.cluster_label && (
                          <span className="ml-2 text-xs bg-purple-100 text-purple-800 px-2 py-1 rounded">
                            {problem.cluster_label}
                          </span>
                        )}
                        {problem.solution_count > 0 && (
                          <span className="ml-2 text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                            {problem.solution_count} solutions
                          </span>
                        )}
                      </button>
                    </td>
                  )}
                  {visibleColumns.includes('description') && (
                    <td className="px-4 py-2 text-sm text-gray-500">
                      {problem.description?.substring(0, 100)}...
                    </td>
                  )}
                  {visibleColumns.includes('cluster_label') && (
                    <td className="px-4 py-2 text-sm">
                      {problem.cluster_label || '-'}
                    </td>
                  )}
                  {visibleColumns.includes('impact') && (
                    <td className="px-4 py-2 text-sm">
                      {problem.impact || '-'}
                    </td>
                  )}
                  {visibleColumns.includes('solution_count') && (
                    <td className="px-4 py-2 text-sm">
                      {problem.solution_count || 0}
                    </td>
                  )}
                  {visibleColumns.includes('created_at') && (
                    <td className="px-4 py-2 text-sm">
                      {new Date(problem.created_at).toLocaleDateString()}
                    </td>
                  )}
                </tr>
                {expandedId === problem.id && (
                  <tr>
                    <td colSpan={visibleColumns.length} className="px-4 py-2 bg-gray-50">
                      <div className="text-sm">
                        <p><strong>Cluster:</strong> {problem.cluster_label || 'None'}</p>
                        <p><strong>Solutions:</strong> {problem.solution_count || 0}</p>
                        <p><strong>Impact:</strong> {problem.impact || 'N/A'}</p>
                        {problem.description && (
                          <p><strong>Description:</strong> {problem.description}</p>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default ProblemsTableBasic;