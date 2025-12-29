import React, { useState, useCallback, memo, useEffect, useMemo, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getClusters, getProblemsByCluster, getSolutionsByCluster, getClustersFilterOptions } from '../services/api';
import api from '../services/api';
import { formatDateTime, isNewItem } from '../utils/dateUtils';
import SearchInput from './SearchInput';
import ColumnSelector from './ColumnSelector';
import TableHeader from './TableHeader';
import { useTableFeatures } from '../hooks/useTableFeatures';
import { usePinnedEntities } from '../hooks/usePinnedEntities';
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
  entityType = 'problem',
  filterOptions = {}
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
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-3 border-t border-gray-200">
          {visibleColumns.includes('primary_industry') && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Industry
              </label>
              <select
                value={apiFilters.primary_industry || ''}
                onChange={(e) => onFilterChange('primary_industry', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="">All Industries</option>
                {filterOptions.industries?.map(industry => (
                  <option key={industry} value={industry}>{industry}</option>
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
function ClusterRow({ cluster, visibleColumns, entityType = 'problem', isNew, isFlashing, onStudy, isPinned, onTogglePin }) {
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
      <tr className={`hover:bg-gray-50 cursor-pointer ${isPinned ? 'bg-blue-50 border-l-4 border-blue-500' : ''} ${isFlashing ? 'flash-new' : ''} ${isNew ? 'new-item' : ''}`} onClick={() => setIsExpanded(!isExpanded)}>
        <td className="px-6 py-4" style={{ minWidth: '350px' }}>
          <div className="flex items-center gap-2">
            <span className="text-gray-400 flex-shrink-0">
              {isExpanded ? '▼' : '▶'}
            </span>
            <div className="min-w-0">
              <span className={`text-sm font-medium block whitespace-normal ${
                (cluster.cluster_label === 'Outliers / Low Confidence' || 
                 cluster.cluster_label === 'Uncategorized Solutions' ||
                 cluster.is_outlier_bucket)
                  ? 'text-gray-500 italic' 
                  : 'text-gray-900'
              }`}>
                {(cluster.cluster_label === 'Outliers / Low Confidence' || 
                  cluster.cluster_label === 'Uncategorized Solutions' ||
                  cluster.is_outlier_bucket)
                  ? '⚠️ Outlier Bucket' 
                  : cluster.cluster_label}
              </span>
              {/* Show indicator if cluster has insights */}
              {cluster.cluster_analysis && !cluster.is_outlier_bucket && (
                <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800" title="Rich analysis available">
                  🎯 Analyzed
                </span>
              )}
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

        {visibleColumns.includes('primary_industry') && (
          <td className="px-6 py-4 text-sm text-gray-900 text-center" style={{ width: '120px' }}>
            {cluster.primary_industry ? (
              <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                cluster.primary_industry === 'Consumer'
                  ? 'bg-purple-100 text-purple-800'
                  : 'bg-blue-100 text-blue-800'
              }`}>
                {cluster.primary_industry}
              </span>
            ) : (
              <span className="text-gray-400">-</span>
            )}
          </td>
        )}

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
            {(cluster.cluster_label === 'Outliers / Low Confidence' || 
              cluster.cluster_label === 'Uncategorized Solutions' ||
              cluster.is_outlier_bucket)
              ? <span className="text-gray-400">&lt; 0.55</span>
              : cluster.avg_similarity ? parseFloat(cluster.avg_similarity).toFixed(3) : 'N/A'
            }
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
        <td className="px-3 py-4 text-center" style={{ width: '120px' }}>
          <div className="flex gap-1 justify-center">
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (onStudy) onStudy(cluster);
              }}
              className="p-2 rounded-lg transition-all transform hover:scale-110 text-purple-500 hover:text-purple-700 hover:bg-purple-100"
              title="Study this cluster"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/>
              </svg>
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (onTogglePin) onTogglePin(cluster.cluster_id);
              }}
              className={`p-2 rounded-lg transition-all transform hover:scale-110 ${
                isPinned 
                  ? 'text-blue-600 bg-blue-50 hover:bg-blue-100' 
                  : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
              }`}
              title={isPinned ? 'Unpin' : 'Pin to top'}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M16,12V4H17V2H7V4H8V12L6,14V16H11.2V22H12.8V16H18V14L16,12Z" />
              </svg>
            </button>
          </div>
        </td>
      </tr>
      
      
      {isExpanded && (
        <tr>
          <td colSpan={visibleColumns.length + 1} className="px-6 py-0">
            <div className="bg-gradient-to-r from-purple-50 to-indigo-50 p-4 mb-4 rounded">
              {/* Cluster Insights Section - Show if available */}
              {(cluster.cluster_insights || cluster.cluster_analysis) && (
                <div className="mb-6 bg-white rounded-lg p-4 shadow-sm">
                  <h3 className="text-lg font-semibold text-gray-800 mb-3 flex items-center gap-2">
                    🎯 Cluster Analysis
                  </h3>
                  
                  {/* Insights Summary */}
                  {cluster.cluster_insights && cluster.cluster_insights !== 'Cluster insights pending analysis' && (
                    <div className="mb-4 p-3 bg-blue-50 rounded-lg border-l-4 border-blue-400">
                      <p className="text-sm text-gray-700 leading-relaxed">{cluster.cluster_insights}</p>
                    </div>
                  )}
                  
                  {/* Detailed Analysis */}
                  {cluster.cluster_analysis && (
                    <div className="space-y-4">
                      {entityType === 'solution' ? (
                        <>
                          {/* Solution Cluster Analysis */}
                          {/* Patterns */}
                          {cluster.cluster_analysis.patterns && (
                            <div>
                              <h4 className="text-sm font-semibold text-gray-700 mb-2">Key Patterns</h4>
                              <div className="flex flex-wrap gap-2">
                                {cluster.cluster_analysis.patterns.map((pattern, idx) => (
                                  <span key={idx} className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                                    {pattern}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                          
                          {/* Target Market & Core Capabilities */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {cluster.cluster_analysis.target_market && (
                              <div>
                                <h4 className="text-sm font-semibold text-gray-700 mb-2">Target Market</h4>
                                <ul className="space-y-1">
                                  {cluster.cluster_analysis.target_market.map((market, idx) => (
                                    <li key={idx} className="text-sm text-gray-600 flex items-start">
                                      <span className="text-blue-400 mr-2">•</span>
                                      {market}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                            
                            {cluster.cluster_analysis.core_capabilities && (
                              <div>
                                <h4 className="text-sm font-semibold text-gray-700 mb-2">Core Capabilities</h4>
                                <ul className="space-y-1">
                                  {cluster.cluster_analysis.core_capabilities.map((capability, idx) => (
                                    <li key={idx} className="text-sm text-gray-600 flex items-start">
                                      <span className="text-green-400 mr-2">•</span>
                                      {capability}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                          
                          {/* Business Model & Competitive Advantage */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {cluster.cluster_analysis.business_model && (
                              <div className="p-3 bg-yellow-50 rounded-lg">
                                <h4 className="text-sm font-semibold text-gray-700 mb-1">Business Model</h4>
                                <p className="text-sm text-gray-600">{cluster.cluster_analysis.business_model}</p>
                              </div>
                            )}
                            
                            {cluster.cluster_analysis.competitive_advantage && (
                              <div className="p-3 bg-purple-50 rounded-lg">
                                <h4 className="text-sm font-semibold text-gray-700 mb-1">Competitive Advantage</h4>
                                <p className="text-sm text-gray-600">{cluster.cluster_analysis.competitive_advantage}</p>
                              </div>
                            )}
                          </div>
                          
                          {/* Implementation & Revenue */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {cluster.cluster_analysis.implementation_complexity && (
                              <div className="p-3 bg-orange-50 rounded-lg">
                                <h4 className="text-sm font-semibold text-gray-700 mb-1">Implementation Complexity</h4>
                                <p className="text-sm text-gray-600">{cluster.cluster_analysis.implementation_complexity}</p>
                              </div>
                            )}
                            
                            {cluster.cluster_analysis.revenue_potential && (
                              <div className="p-3 bg-green-50 rounded-lg">
                                <h4 className="text-sm font-semibold text-gray-700 mb-1">Revenue Potential</h4>
                                <p className="text-sm text-gray-600">{cluster.cluster_analysis.revenue_potential}</p>
                              </div>
                            )}
                          </div>
                          
                          {/* Representative Solutions */}
                          {cluster.cluster_analysis.representative_solutions && (
                            <div>
                              <h4 className="text-sm font-semibold text-gray-700 mb-2">Representative Solutions</h4>
                              <div className="space-y-2">
                                {cluster.cluster_analysis.representative_solutions.map((solution, idx) => (
                                  <div key={idx} className="p-2 bg-blue-50 rounded text-sm text-gray-700">
                                    {solution}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </>
                      ) : (
                        <>
                          {/* Problem Cluster Analysis - existing code */}
                          {/* Common Patterns */}
                          {cluster.cluster_analysis.common_patterns && (
                        <div>
                          <h4 className="text-sm font-semibold text-gray-700 mb-2">Common Patterns</h4>
                          <div className="flex flex-wrap gap-2">
                            {cluster.cluster_analysis.common_patterns.map((pattern, idx) => (
                              <span key={idx} className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                                {pattern}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {/* Two Column Grid for Other Info */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Affected Stakeholders */}
                        {cluster.cluster_analysis.affected_stakeholders && (
                          <div>
                            <h4 className="text-sm font-semibold text-gray-700 mb-2">Affected Stakeholders</h4>
                            <ul className="space-y-1">
                              {cluster.cluster_analysis.affected_stakeholders.map((stakeholder, idx) => (
                                <li key={idx} className="text-sm text-gray-600 flex items-start">
                                  <span className="text-gray-400 mr-2">•</span>
                                  {stakeholder}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        
                        {/* Root Causes */}
                        {cluster.cluster_analysis.root_causes && (
                          <div>
                            <h4 className="text-sm font-semibold text-gray-700 mb-2">Root Causes</h4>
                            <ul className="space-y-1">
                              {cluster.cluster_analysis.root_causes.map((cause, idx) => (
                                <li key={idx} className="text-sm text-gray-600 flex items-start">
                                  <span className="text-gray-400 mr-2">•</span>
                                  {cause}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                      
                      {/* Business Impact & Market Opportunity */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {cluster.cluster_analysis.business_impact && (
                          <div className="p-3 bg-yellow-50 rounded-lg">
                            <h4 className="text-sm font-semibold text-gray-700 mb-1">Business Impact</h4>
                            <p className="text-sm text-gray-600">{cluster.cluster_analysis.business_impact}</p>
                          </div>
                        )}
                        
                        {cluster.cluster_analysis.market_opportunity && (
                          <div className="p-3 bg-green-50 rounded-lg">
                            <h4 className="text-sm font-semibold text-gray-700 mb-1">Market Opportunity</h4>
                            <p className="text-sm text-gray-600">{cluster.cluster_analysis.market_opportunity}</p>
                          </div>
                        )}
                      </div>
                      
                      {/* Solution Themes */}
                      {cluster.cluster_analysis.solution_themes && (
                        <div>
                          <h4 className="text-sm font-semibold text-gray-700 mb-2">Solution Themes</h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                            {cluster.cluster_analysis.solution_themes.map((theme, idx) => (
                              <div key={idx} className="flex items-center text-sm text-gray-600">
                                <span className="text-green-500 mr-2">✓</span>
                                {theme}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {/* Representative Problems */}
                      {cluster.cluster_analysis.representative_problems && cluster.cluster_analysis.representative_problems.length > 0 && (
                        <div>
                          <h4 className="text-sm font-semibold text-gray-700 mb-2">Representative Problems</h4>
                          <div className="space-y-2">
                            {cluster.cluster_analysis.representative_problems.map((problem, idx) => (
                              <div key={idx} className="p-2 bg-gray-50 rounded">
                                <p className="text-sm font-medium text-gray-800">{problem.title}</p>
                                <p className="text-xs text-gray-600 mt-1 italic">{problem.why_representative}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                        </>
                      )}
                    </div>
                  )}
                </div>
              )}
              
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

function ClustersTable({ filters: externalFilters, onFiltersChange, onDataFiltered, entityType = 'problem', onStudy }) {
  // Use external filters if provided, otherwise use local state
  const [localSearchTerm, setLocalSearchTerm] = useState(''); // Local search state
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [newItemIds, setNewItemIds] = useState(new Set());
  const [flashItemIds, setFlashItemIds] = useState(new Set());
  const previousDataRef = useRef(null);
  const searchTerm = externalFilters?.searchTerm ?? localSearchTerm;
  
  // Use pinning hook with different storage keys for problem vs solution clusters
  const storageKey = entityType === 'solution' ? 'pinned-solution-clusters' : 'pinned-problem-clusters';
  const {
    pinnedIds,
    togglePin,
    isPinned,
    separateEntities: originalSeparateEntities
  } = usePinnedEntities(storageKey);
  
  // Wrapper for separateEntities to handle cluster_id instead of id
  const separateEntities = useCallback((clusters) => {
    const pinned = [];
    const unpinned = [];
    
    // First, collect pinned clusters in the order they were pinned
    pinnedIds.forEach(pinnedId => {
      const cluster = clusters.find(c => c.cluster_id === pinnedId);
      if (cluster) {
        pinned.push(cluster);
      }
    });
    
    // Then collect unpinned clusters
    clusters.forEach(cluster => {
      if (!pinnedIds.includes(cluster.cluster_id)) {
        unpinned.push(cluster);
      }
    });
    
    return { pinned, unpinned };
  }, [pinnedIds]);
  
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
    primary_industry: '',
    sortBy: 'problem_count',
    sortOrder: 'DESC'
  });

  // Fetch filter options (industries list)
  const { data: filterOptions } = useQuery({
    queryKey: ['clusters-filter-options'],
    queryFn: () => getClustersFilterOptions(),
    staleTime: 1000 * 60 * 10, // Cache for 10 minutes
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

      // Primary industry filter
      if (externalFilters.primary_industry) {
        filtered = filtered.filter(cluster =>
          cluster.primary_industry === externalFilters.primary_industry
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
    
    // Separate pinned and unpinned clusters
    const { pinned, unpinned } = separateEntities(filtered);
    
    // Sort unpinned clusters to put outlier bucket at the bottom
    const sortedUnpinned = unpinned.sort((a, b) => {
      // Outlier bucket always goes to bottom
      const aIsOutlier = a.cluster_label === 'Outliers / Low Confidence' || 
                         a.cluster_label === 'Uncategorized Solutions' ||
                         a.is_outlier_bucket;
      const bIsOutlier = b.cluster_label === 'Outliers / Low Confidence' || 
                         b.cluster_label === 'Uncategorized Solutions' ||
                         b.is_outlier_bucket;
      
      if (aIsOutlier) return 1;
      if (bIsOutlier) return -1;
      // Otherwise sort by problem count descending
      return (b.problem_count || 0) - (a.problem_count || 0);
    });
    
    // Return pinned first, then sorted unpinned
    return [...pinned, ...sortedUnpinned];
  }, [allClusters, searchTerm, externalFilters, separateEntities]);

  // Memoize the separated clusters to avoid recalculating
  const { pinnedClusters, unpinnedClusters } = useMemo(() => {
    if (!clusters) return { pinnedClusters: [], unpinnedClusters: [] };
    const { pinned, unpinned } = separateEntities(clusters);
    return { pinnedClusters: pinned, unpinnedClusters: unpinned };
  }, [clusters, separateEntities]);
  
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
      primary_industry: '',
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
          filterOptions={filterOptions || {}}
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
              <>
                {/* Render pinned clusters first */}
                {pinnedClusters.map((cluster) => (
                  <ClusterRow 
                    key={cluster.cluster_id} 
                    cluster={cluster} 
                    visibleColumns={visibleColumns}
                    entityType={entityType}
                    isNew={newItemIds.has(cluster.cluster_id)}
                    isFlashing={flashItemIds.has(cluster.cluster_id)}
                    onStudy={onStudy}
                    isPinned={true}
                    onTogglePin={togglePin}
                  />
                ))}
                
                {/* Divider between pinned and unpinned */}
                {pinnedClusters.length > 0 && unpinnedClusters.length > 0 && (
                  <tr className="bg-gray-100">
                    <td colSpan={visibleColumns.length + 1} className="px-6 py-2 text-xs text-gray-500 font-medium">
                      Other Clusters
                    </td>
                  </tr>
                )}
                
                {/* Render unpinned clusters */}
                {unpinnedClusters.map((cluster) => (
                  <ClusterRow 
                    key={cluster.cluster_id} 
                    cluster={cluster} 
                    visibleColumns={visibleColumns}
                    entityType={entityType}
                    isNew={newItemIds.has(cluster.cluster_id)}
                    isFlashing={flashItemIds.has(cluster.cluster_id)}
                    onStudy={onStudy}
                    isPinned={false}
                    onTogglePin={togglePin}
                  />
                ))}
              </>
            )}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  );
}

export default ClustersTable;