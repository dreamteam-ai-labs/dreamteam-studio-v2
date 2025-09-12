import { useState, useCallback, memo, useEffect, useMemo, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getSolutions, getProblemsBySolution, getProblemsByCluster, getSolutionsFilterOptions, getBestSolutionCandidate, createProductFromSolution } from '../services/api';
import { formatDateTime, isNewItem } from '../utils/dateUtils';
import { formatLargeCurrency, formatPercentage } from '../utils/numberUtils';
import SearchInput from './SearchInput';
import ColumnSelector from './ColumnSelector';
import TableHeader from './TableHeader';
import StudyModeModal from './StudyModeModal';
import { useTableFeatures } from '../hooks/useTableFeatures';
import { usePinnedEntities } from '../hooks/usePinnedEntities';
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
  visibleColumns
}) {
  // Load collapsed state from localStorage
  const [isCollapsed, setIsCollapsed] = useState(() => {
    const saved = localStorage.getItem('solutions-filters-collapsed');
    return saved === 'true';
  });

  // Save collapsed state to localStorage
  const toggleCollapsed = () => {
    const newState = !isCollapsed;
    setIsCollapsed(newState);
    localStorage.setItem('solutions-filters-collapsed', newState.toString());
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
            placeholder="Search solutions..."
          />
        </div>
        
        {/* Collapsible advanced filters */}
        {!isCollapsed && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-3 border-t border-gray-200">
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
      )}
      </div>
    </div>
  );
});

// Solution row component for expandable functionality
function SolutionRow({ solution, visibleColumns, isBestCandidate, isPinned, onTogglePin, isSelected, onToggleSelect, onStudy, onCreateProduct, isNew, isFlashing }) {
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
      <tr className={`hover:bg-gray-50 ${isPinned ? 'bg-blue-50 border-l-4 border-blue-500' : ''} ${isFlashing ? 'flash-new' : ''} ${isNew ? 'new-item' : ''}`}>
        <td className="px-3 py-4 text-center" style={{ width: '40px' }}>
          <input
            type="checkbox"
            checked={isSelected}
            onChange={onToggleSelect}
            className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 focus:ring-2"
            onClick={(e) => e.stopPropagation()}
            title="Select for bulk actions"
          />
        </td>
        {visibleColumns.includes('title') && (
          <td className="px-6 py-4 cell-title cursor-pointer" style={{ minWidth: '400px' }} onClick={() => setIsExpanded(!isExpanded)}>
            <div className="flex items-start gap-2">
              <span className="text-gray-400 mt-1 flex-shrink-0">
                {isExpanded ? '▼' : '▶'}
              </span>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  {isPinned && (
                    <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-800 rounded">
                      📌 Pinned
                    </span>
                  )}
                  {isBestCandidate && (
                    <span className="inline-flex items-center px-2 py-1 text-xs font-bold bg-yellow-400 text-yellow-900 rounded" title="Best candidate for next project based on viability score, LTV/CAC ratio, and problem count">
                      ⭐ BEST CANDIDATE
                    </span>
                  )}
                  <span className="text-sm font-medium text-gray-900">
                    {solution.title}
                  </span>
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
          <td className="px-6 py-4 text-center cursor-pointer" style={{ width: '120px' }} onClick={() => setIsExpanded(!isExpanded)}>
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
        
        {visibleColumns.includes('candidate_score') && (
          <td className="px-6 py-4 text-sm font-medium text-gray-900 text-center cursor-pointer" style={{ width: '80px' }} onClick={() => setIsExpanded(!isExpanded)}>
            {solution.candidate_score ? parseFloat(solution.candidate_score).toFixed(1) : '0.0'}
          </td>
        )}
        
        {visibleColumns.includes('ltv_cac') && (
          <td className="px-6 py-4 text-sm text-gray-900 text-center cursor-pointer" style={{ width: '140px' }} onClick={() => setIsExpanded(!isExpanded)}>
            {solution.ltv_estimate && solution.cac_estimate ? 
              `${formatLargeCurrency(solution.ltv_estimate, 0)} / ${formatLargeCurrency(solution.cac_estimate, 0)}` : 
              'N/A'
            }
          </td>
        )}
        
        {visibleColumns.includes('revenue') && (
          <td className="px-6 py-4 text-sm text-gray-900 text-center cursor-pointer" style={{ width: '100px' }} onClick={() => setIsExpanded(!isExpanded)}>
            {solution.recurring_revenue_potential ? 
              formatLargeCurrency(solution.recurring_revenue_potential) : 
              'N/A'
            }
          </td>
        )}
        
        {visibleColumns.includes('source_cluster') && (
          <td className="px-6 py-4 text-sm text-gray-900 cursor-pointer" style={{ width: '200px' }} onClick={() => setIsExpanded(!isExpanded)}>
            {solution.source_cluster_label || 'N/A'}
          </td>
        )}
        
        {visibleColumns.includes('problem_count') && (
          <td className="px-6 py-4 text-sm text-gray-900 text-center cursor-pointer" style={{ width: '100px' }} onClick={() => setIsExpanded(!isExpanded)}>
            {solution.problem_count || 0}
          </td>
        )}
        
        {visibleColumns.includes('status') && (
          <td className="px-6 py-4 text-center cursor-pointer" style={{ width: '100px' }} onClick={() => setIsExpanded(!isExpanded)}>
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
          <td className="px-6 py-4 text-sm text-center cursor-pointer" style={{ width: '100px' }} onClick={() => setIsExpanded(!isExpanded)}>
            {solution.linear_project_id ? (
              <span className="text-primary-600">✓ Linear</span>
            ) : (
              <span className="text-gray-400">-</span>
            )}
          </td>
        )}
        
        {visibleColumns.includes('created_at') && (
          <td className="px-6 py-4 text-sm text-gray-900 text-center cursor-pointer" style={{ width: '120px' }} onClick={() => setIsExpanded(!isExpanded)}>
            {formatDateTime(solution.created_at)}
          </td>
        )}
        <td className="px-3 py-4 text-center" style={{ width: '150px' }}>
          <div className="flex gap-1 justify-center">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onStudy(solution, 'solution');
              }}
              className="p-2 rounded-lg transition-all transform hover:scale-110 text-purple-500 hover:text-purple-700 hover:bg-purple-100"
              title="Study this solution"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/>
              </svg>
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onTogglePin(solution.id);
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
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (solution.linear_project_id) {
                  if (window.confirm(`This solution already has a project. Create another one?`)) {
                    onCreateProduct(solution);
                  }
                } else {
                  onCreateProduct(solution);
                }
              }}
              className={`p-2 rounded-lg transition-all transform hover:scale-110 ${
                solution.linear_project_id 
                  ? 'text-amber-500 hover:text-amber-700 hover:bg-amber-100' 
                  : 'text-green-500 hover:text-green-700 hover:bg-green-100'
              }`}
              title={solution.linear_project_id 
                ? "Solution already has a project - click to create another" 
                : "Create product from this solution"
              }
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d={solution.linear_project_id 
                  ? "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm5 11h-4v4h-2v-4H7v-2h4V7h2v4h4v2z"
                  : "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm5 11h-4v4h-2v-4H7v-2h4V7h2v4h4v2z"
                }/>
              </svg>
            </button>
          </div>
        </td>
      </tr>
      
      {isExpanded && (
        <tr>
          <td colSpan={visibleColumns.length + 2} className="px-6 py-0">
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
                            formatLargeCurrency(solution.recurring_revenue_potential) : 
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

function SolutionsTable({ filters: externalFilters, onFiltersChange, onDataFiltered }) {
  // Use external filters if provided, otherwise use local state
  const [localSearchTerm, setLocalSearchTerm] = useState(''); // Local search state
  const searchTerm = externalFilters?.searchTerm ?? localSearchTerm;
  
  // Initialize pinning functionality
  const {
    pinnedIds,
    togglePin,
    isPinned,
    separateEntities,
    pinMultiple,
    clearAll
  } = usePinnedEntities('pinned-solutions');
  
  // Load saved column preferences or use defaults
  const [visibleColumns, setVisibleColumns] = useState(() => {
    const saved = localStorage.getItem('solutions-visible-columns');
    return saved ? JSON.parse(saved) : DEFAULT_COLUMNS;
  });
  
  // Selection state
  const [selectedItems, setSelectedItems] = useState(new Set());
  const [studyModalOpen, setStudyModalOpen] = useState(false);
  const [studyEntity, setStudyEntity] = useState(null);
  const [studyEntityType, setStudyEntityType] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [newItemIds, setNewItemIds] = useState(new Set());
  const [flashItemIds, setFlashItemIds] = useState(new Set());
  const previousDataRef = useRef(null);
  
  // Selection handlers
  const handleSelectAll = (solutions) => {
    const allIds = solutions.map(s => s.id);
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
  
  const openStudyMode = (entity, type) => {
    setStudyEntity(entity);
    setStudyEntityType(type);
    setStudyModalOpen(true);
  };

  const handleCreateProduct = async (solution) => {
    if (window.confirm(`Create a product from "${solution.title}"?\n\nThis will trigger the F4 workflow to create:\n- GitHub repository\n- Linear project\n- Complete product setup`)) {
      try {
        await createProductFromSolution(solution.id);
        alert('Product creation initiated! Check Linear and GitHub in a few minutes.');
        // Refresh solutions to update the UI
        await refetchSolutions();
      } catch (error) {
        alert(`Failed to create product: ${error.message}`);
      }
    }
  };
  
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

  const { data: allSolutions, isLoading, refetch: refetchSolutions } = useQuery({
    queryKey: ['solutions', apiFilters],
    queryFn: () => getSolutions(apiFilters),
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    keepPreviousData: true,
  });

  // Handle refresh
  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      // Store current data before refresh
      previousDataRef.current = allSolutions ? new Set(allSolutions.map(s => s.id)) : new Set();
      await Promise.all([
        refetchSolutions(),
        refetchBestCandidate()
      ]);
    } finally {
      setTimeout(() => setIsRefreshing(false), 500);
    }
  };

  // Detect new items after data changes
  useEffect(() => {
    if (allSolutions && previousDataRef.current) {
      const newIds = new Set();
      allSolutions.forEach(solution => {
        // Item is new if it wasn't in previous data OR was created in last 10 seconds
        if (!previousDataRef.current.has(solution.id) || isNewItem(solution.created_at)) {
          newIds.add(solution.id);
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
  }, [allSolutions]);
  
  // Fetch the best solution candidate
  const { data: bestCandidate, refetch: refetchBestCandidate } = useQuery({
    queryKey: ['best-solution-candidate'],
    queryFn: getBestSolutionCandidate,
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
  });

  // Client-side filtering for search
  const solutions = useMemo(() => {
    if (!allSolutions) return [];
    
    let filtered = allSolutions;
    
    // Apply search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(solution => 
        solution.title?.toLowerCase().includes(term) ||
        solution.description?.toLowerCase().includes(term) ||
        solution.identifier?.toLowerCase().includes(term)
      );
    }
    
    // Apply external filters if provided
    if (externalFilters) {
      // Title filter
      if (externalFilters.title) {
        const titleTerm = externalFilters.title.toLowerCase();
        filtered = filtered.filter(solution => 
          solution.title?.toLowerCase().includes(titleTerm)
        );
      }
      
      // Status filter
      if (externalFilters.status?.length > 0) {
        filtered = filtered.filter(solution => 
          externalFilters.status.includes(solution.status)
        );
      }
      
      // Viability range filter (renamed from viabilityRange to overall_viability)
      if (externalFilters.overall_viability) {
        const [min, max] = externalFilters.overall_viability;
        filtered = filtered.filter(solution => {
          const viability = solution.overall_viability || 0;
          return viability >= min && viability <= max;
        });
      }
      
      // LTV/CAC filter (minimum ratio)
      if (externalFilters.ltv_cac !== null && externalFilters.ltv_cac !== undefined) {
        filtered = filtered.filter(solution => {
          // Calculate the LTV/CAC ratio if both values exist
          if (solution.ltv_estimate && solution.cac_estimate && solution.cac_estimate > 0) {
            const ratio = solution.ltv_estimate / solution.cac_estimate;
            return ratio >= externalFilters.ltv_cac;
          }
          return false; // Exclude solutions without LTV/CAC data
        });
      }
      
      // Revenue filter (minimum)
      if (externalFilters.revenue !== null && externalFilters.revenue !== undefined) {
        filtered = filtered.filter(solution => 
          (solution.recurring_revenue_potential || 0) >= externalFilters.revenue
        );
      }
      
      // Source cluster filter
      if (externalFilters.source_cluster) {
        const clusterTerm = externalFilters.source_cluster.toLowerCase();
        filtered = filtered.filter(solution => 
          solution.source_cluster_label?.toLowerCase().includes(clusterTerm)
        );
      }
      
      // Problem count filter (minimum)
      if (externalFilters.problem_count !== null && externalFilters.problem_count !== undefined) {
        filtered = filtered.filter(solution => 
          (solution.problem_count || 0) >= externalFilters.problem_count
        );
      }
      
      // Has project filter
      if (externalFilters.hasProject === true) {
        filtered = filtered.filter(solution => solution.linear_project_id);
      } else if (externalFilters.hasProject === false) {
        filtered = filtered.filter(solution => !solution.linear_project_id);
      }
    }
    
    return filtered;
  }, [allSolutions, searchTerm, externalFilters]);

  // Pass filtered data back to parent
  useEffect(() => {
    if (onDataFiltered) {
      onDataFiltered(solutions);
    }
  }, [solutions, onDataFiltered]);

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
      {/* Only show local filters if no external filters provided */}
      {!externalFilters && (
        <FiltersSection
          searchTerm={searchTerm}
          onSearchChange={handleSearchChange}
          apiFilters={apiFilters}
          onFilterChange={handleFilterChange}
          onClearFilters={handleClearFilters}
          filterOptions={filterOptions}
          visibleColumns={visibleColumns}
        />
      )}

      {/* Table */}
      <div className={`bg-white rounded-lg shadow table-container ${isResizing ? 'resizing' : ''}`}>
        {/* Table Header */}
        <div className="p-4 border-b border-gray-200">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-4">
              <h2 className="text-lg font-semibold text-gray-800">
                Solutions ({solutions?.length || 0} total)
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
            <div className="flex items-center gap-2">
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
              {bestCandidate && !isPinned(bestCandidate.id) && (
                <button
                  onClick={() => togglePin(bestCandidate.id)}
                  className="px-3 py-1.5 bg-yellow-500 text-white text-sm font-medium rounded hover:bg-yellow-600 transition-colors flex items-center gap-2"
                  title={`Pin "${bestCandidate.title}" - Best candidate based on viability (40%), LTV/CAC (30%), and problem count (30%)`}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M16,12V4H17V2H7V4H8V12L6,14V16H11.2V22H12.8V16H18V14L16,12Z" />
                  </svg>
                  Pin Best Candidate
                </button>
              )}
              <ColumnSelector 
                columns={ALL_COLUMNS}
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
              <th className="px-3 py-3 text-center" style={{ width: '40px' }}>
                <input
                  type="checkbox"
                  className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 focus:ring-2"
                  title="Select all"
                  checked={solutions?.length > 0 && solutions.every(s => selectedItems.has(s.id))}
                  onChange={() => handleSelectAll(solutions)}
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
          <tbody className="bg-white divide-y divide-gray-200">
            {solutions?.length === 0 ? (
              <tr>
                <td colSpan={visibleColumns.length + 2} className="px-6 py-4 text-center text-gray-500">
                  No solutions found matching your filters
                </td>
              </tr>
            ) : (
              <>
                {/* Pinned solutions first */}
                {separateEntities(solutions).pinned.map((solution) => (
                  <SolutionRow 
                    key={solution.id} 
                    solution={solution} 
                    visibleColumns={visibleColumns}
                    isBestCandidate={bestCandidate?.id === solution.id}
                    isPinned={true}
                    onTogglePin={togglePin}
                    isSelected={selectedItems.has(solution.id)}
                    onToggleSelect={() => handleSelectItem(solution.id)}
                    onStudy={openStudyMode}
                    onCreateProduct={handleCreateProduct}
                    isNew={newItemIds.has(solution.id)}
                    isFlashing={flashItemIds.has(solution.id)}
                  />
                ))}
                {/* Divider between pinned and unpinned */}
                {separateEntities(solutions).pinned.length > 0 && separateEntities(solutions).unpinned.length > 0 && (
                  <tr className="bg-gray-100">
                    <td colSpan={visibleColumns.length + 2} className="px-6 py-2 text-xs text-gray-500 font-medium">
                      Other Solutions
                    </td>
                  </tr>
                )}
                {/* Unpinned solutions */}
                {separateEntities(solutions).unpinned.map((solution) => (
                  <SolutionRow 
                    key={solution.id} 
                    solution={solution} 
                    visibleColumns={visibleColumns}
                    isBestCandidate={bestCandidate?.id === solution.id}
                    isPinned={false}
                    onTogglePin={togglePin}
                    isSelected={selectedItems.has(solution.id)}
                    onToggleSelect={() => handleSelectItem(solution.id)}
                    onStudy={openStudyMode}
                    onCreateProduct={handleCreateProduct}
                    isNew={newItemIds.has(solution.id)}
                    isFlashing={flashItemIds.has(solution.id)}
                  />
                ))}
              </>
            )}
          </tbody>
        </table>
        </div>
      </div>
      
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

export default SolutionsTable;