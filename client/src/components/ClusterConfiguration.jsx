import React, { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { RefreshCw, Trash2, Plus, ChevronUp, ChevronDown, ChevronRight, Info, HelpCircle } from 'lucide-react';
import { 
  createClusteringScenario, 
  getClusteringScenarios, 
  getClusteringScenarioDetails,
  deleteClusteringScenario,
  getClusteringConfig 
} from '../services/api';
import { formatDateTime } from '../utils/dateUtils';
import ScenarioResults from './ScenarioResults';
import ColumnSelector from './ColumnSelector';
import ClusterVisualization from './ClusterVisualization';
import { usePinnedEntities } from '../hooks/usePinnedEntities';

function ClusterConfiguration({ entityType = 'problem' }) {
  const queryClient = useQueryClient();
  
  // Pinning functionality
  const { pinnedIds, togglePin, isPinned, separateEntities } = usePinnedEntities('pinned-scenarios');
  
  // Fetch current production configuration
  const { data: productionConfig } = useQuery({
    queryKey: ['clustering-config', entityType],
    queryFn: () => getClusteringConfig(entityType),
  });
  
  // Use production config or fallback to defaults
  const currentStats = productionConfig ? {
    k: productionConfig.k_value,
    threshold: productionConfig.similarity_threshold,
    outliers: productionConfig.outlier_percentage || 28
  } : {
    k: 25,
    threshold: 0.60,
    outliers: 28
  };
  
  // State for controls - will be updated when config loads
  const [kValue, setKValue] = useState(25);
  const [similarityThreshold, setSimilarityThreshold] = useState(0.60);
  
  // Update defaults when production config loads
  useEffect(() => {
    if (productionConfig) {
      setKValue(productionConfig.k_value);
      setSimilarityThreshold(productionConfig.similarity_threshold);
    }
  }, [productionConfig]);
  const [selectedScenarioId, setSelectedScenarioId] = useState(null);
  const [showResults, setShowResults] = useState(false);
  const [showCreatePanel, setShowCreatePanel] = useState(false);
  const [sortField, setSortField] = useState('requested_at');
  const [sortOrder, setSortOrder] = useState('desc');
  const [expandedScenarioId, setExpandedScenarioId] = useState(null);
  const [showHelp, setShowHelp] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // Column visibility
  const [visibleColumns, setVisibleColumns] = useState([
    'parameters', 'status', 'results', 'improvement', 'created', 'actions'
  ]);
  
  const availableColumns = [
    { key: 'parameters', label: 'Parameters', required: false },
    { key: 'status', label: 'Status', required: false },
    { key: 'results', label: 'Results', required: false },
    { key: 'improvement', label: 'Improvement', required: false },
    { key: 'processing_time', label: 'Processing Time', required: false },
    { key: 'total_items', label: 'Total Items', required: false },
    { key: 'created', label: 'Created', required: false },
    { key: 'notes', label: 'Notes', required: false },
    { key: 'actions', label: 'Actions', required: true }
  ];
  
  // Fetch scenarios list
  const { data: scenarios = [], isLoading: scenariosLoading, refetch: refetchScenarios } = useQuery({
    queryKey: ['clustering-scenarios', entityType],
    queryFn: () => getClusteringScenarios(entityType),
    refetchInterval: 5000, // Check more frequently
    staleTime: 1000, // Consider data stale after 1 second
  });
  
  // Fetch selected scenario details
  const { data: selectedScenario } = useQuery({
    queryKey: ['clustering-scenario-details', selectedScenarioId],
    queryFn: () => getClusteringScenarioDetails(selectedScenarioId),
    enabled: !!selectedScenarioId,
    refetchInterval: (data) => {
      return data?.status === 'processing' ? 5000 : false;
    }
  });

  // Fetch expanded scenario details for visualization
  const { data: expandedScenario } = useQuery({
    queryKey: ['clustering-scenario-details', expandedScenarioId],
    queryFn: () => getClusteringScenarioDetails(expandedScenarioId),
    enabled: !!expandedScenarioId && expandedScenarioId !== selectedScenarioId,
    refetchInterval: (data) => {
      return data?.status === 'processing' ? 5000 : false;
    }
  });
  
  // Create scenario mutation
  const createMutation = useMutation({
    mutationFn: (data) => createClusteringScenario(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['clustering-scenarios']);
      setShowCreatePanel(false);
    },
    onError: (error) => {
      alert('Failed to create scenario: ' + error.message);
    }
  });
  
  // Delete scenario mutation
  const deleteMutation = useMutation({
    mutationFn: (id) => deleteClusteringScenario(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['clustering-scenarios']);
    },
    onError: (error) => {
      alert('Failed to delete scenario: ' + error.message);
    }
  });
  
  const handleCreateScenario = () => {
    createMutation.mutate({
      entity_type: entityType,
      k_value: kValue,
      similarity_threshold: similarityThreshold,
      notes: `Testing K=${kValue}, T=${similarityThreshold}`
    });
  };
  
  // Handle refresh - matches ClustersTable implementation
  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await queryClient.invalidateQueries(['clustering-scenarios', entityType]);
      await refetchScenarios();
    } finally {
      setTimeout(() => setIsRefreshing(false), 500);
    }
  };
  
  const handleSort = (field) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };
  
  // First sort all scenarios
  const sortedAll = [...scenarios].sort((a, b) => {
    let aVal = a[sortField];
    let bVal = b[sortField];
    
    if (sortField === 'requested_at') {
      aVal = new Date(aVal);
      bVal = new Date(bVal);
    }
    
    if (sortOrder === 'asc') {
      return aVal > bVal ? 1 : -1;
    } else {
      return aVal < bVal ? 1 : -1;
    }
  });
  
  // Then separate pinned and unpinned
  const { pinned, unpinned } = separateEntities(sortedAll);
  
  // Combine with pinned first
  const sortedScenarios = [...pinned, ...unpinned];
  
  const getStatusColor = (status) => {
    switch(status) {
      case 'completed': return 'bg-green-100 text-green-800';
      case 'processing': return 'bg-blue-100 text-blue-800';
      case 'failed': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };
  
  const getImprovementColor = (improvement) => {
    if (improvement > 0) return 'text-green-600';
    if (improvement < 0) return 'text-red-600';
    return 'text-gray-600';
  };
  
  const SortIcon = ({ field }) => {
    if (sortField !== field) {
      return <span className="text-gray-400">↕</span>;
    }
    return <span className="text-blue-600">{sortOrder === 'asc' ? '↑' : '↓'}</span>;
  };
  
  // Close create panel when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showCreatePanel && !event.target.closest('.create-panel-container')) {
        setShowCreatePanel(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showCreatePanel]);
  
  // Refresh scenarios list when expanded scenario completes
  useEffect(() => {
    if (expandedScenario?.status === 'completed' || expandedScenario?.status === 'failed') {
      // Invalidate the scenarios list to get fresh data
      queryClient.invalidateQueries(['clustering-scenarios', entityType]);
    }
  }, [expandedScenario?.status, entityType, queryClient]);
  
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-full mx-auto">
        {/* Header Section */}
        <div className="bg-white shadow-sm border-b">
          <div className="px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-6">
                <h2 className="text-lg font-semibold text-gray-800">
                  {entityType === 'solution' ? 'Solution' : 'Problem'} Clustering Scenarios ({scenarios?.length || 0} total)
                </h2>
                
                {/* Current Production Info */}
                <div className="flex items-center gap-3 text-sm text-gray-600 border-l pl-6">
                  <span className="font-medium">Production:</span>
                  <div className="flex items-center gap-2">
                    <span className="bg-gray-100 px-2 py-1 rounded">K={currentStats.k}</span>
                    <span className="bg-gray-100 px-2 py-1 rounded">T={currentStats.threshold}</span>
                    <span className="bg-red-100 text-red-700 px-2 py-1 rounded font-medium">
                      {currentStats.outliers}% outliers
                    </span>
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                {/* Tab-specific controls on the left */}
                {/* New Scenario Button with Dropdown */}
                <div className="relative create-panel-container">
                  <button
                    onClick={() => setShowCreatePanel(!showCreatePanel)}
                    className={`px-3 py-1.5 text-sm border rounded-lg flex items-center gap-1.5 transition-all ${
                      showCreatePanel 
                        ? 'border-blue-500 bg-blue-50 text-blue-700' 
                        : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400 hover:bg-gray-50'
                    }`}
                  >
                    <Plus className="h-4 w-4" />
                    <span>New Scenario</span>
                    <ChevronDown className={`h-3 w-3 transition-transform ${
                      showCreatePanel ? 'rotate-180' : ''
                    }`} />
                  </button>
                  
                  {/* Dropdown Create Panel */}
                  {showCreatePanel && (
                    <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-lg border border-gray-200 p-4 z-20">
                      <h3 className="text-sm font-semibold text-gray-700 mb-3">Configure New Scenario</h3>
                      
                      {/* K Value */}
                      <div className="mb-4">
                        <label className="flex items-center gap-1 text-xs font-medium text-gray-600 mb-2">
                          Number of Clusters (K)
                          <span className="group relative">
                            <HelpCircle className="h-3 w-3 text-gray-400 cursor-help" />
                            <div className="invisible group-hover:visible absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 p-2 bg-gray-800 text-white text-xs rounded-lg w-48 z-10">
                              <div>How many groups to organize items into.</div>
                              <div className="mt-1">• Lower = Fewer, larger clusters</div>
                              <div>• Higher = More, smaller clusters</div>
                              <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 translate-y-full">
                                <div className="border-4 border-transparent border-t-gray-800"></div>
                              </div>
                            </div>
                          </span>
                        </label>
                        <div className="flex items-center gap-3">
                          <input
                            type="range"
                            min="5"
                            max="40"
                            value={kValue}
                            onChange={(e) => setKValue(Number(e.target.value))}
                            className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                          />
                          <span className="text-sm font-bold text-blue-600 w-8">{kValue}</span>
                        </div>
                      </div>
                      
                      {/* Threshold */}
                      <div className="mb-4">
                        <label className="flex items-center gap-1 text-xs font-medium text-gray-600 mb-2">
                          Similarity Threshold (T)
                          <span className="group relative">
                            <HelpCircle className="h-3 w-3 text-gray-400 cursor-help" />
                            <div className="invisible group-hover:visible absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 p-2 bg-gray-800 text-white text-xs rounded-lg w-48 z-10">
                              <div>Minimum similarity to join a cluster.</div>
                              <div className="mt-1">• Lower = More inclusive</div>
                              <div>• Higher = Stricter grouping</div>
                              <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 translate-y-full">
                                <div className="border-4 border-transparent border-t-gray-800"></div>
                              </div>
                            </div>
                          </span>
                        </label>
                        <div className="flex items-center gap-3">
                          <input
                            type="range"
                            min="0.3"
                            max="0.8"
                            step="0.05"
                            value={similarityThreshold}
                            onChange={(e) => setSimilarityThreshold(Number(e.target.value))}
                            className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                          />
                          <span className="text-sm font-bold text-blue-600 w-10">{similarityThreshold}</span>
                        </div>
                      </div>
                      
                      {/* Quick Tips */}
                      <div className="bg-gray-50 rounded p-2 mb-3">
                        <div className="text-xs text-gray-600">
                          <div className="font-medium mb-1">Quick Tips:</div>
                          <div>• To reduce outliers: Try K=15-20, T=0.50</div>
                          <div>• Current production: K={currentStats.k}, T={currentStats.threshold}</div>
                        </div>
                      </div>
                      
                      {/* Create Button */}
                      <button
                        onClick={handleCreateScenario}
                        disabled={createMutation.isLoading}
                        className="w-full px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50"
                      >
                        {createMutation.isLoading ? 'Creating Scenario...' : 'Create Scenario'}
                      </button>
                    </div>
                  )}
                </div>
                
                {/* Help Button */}
                <button
                  onClick={() => setShowHelp(!showHelp)}
                  className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                  title="Help"
                >
                  <HelpCircle className="h-5 w-5" />
                </button>
                
                {/* Standard controls on the right - same as other tabs */}
                {/* Refresh button */}
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
                
                {/* Column Selector */}
                <ColumnSelector 
                  columns={availableColumns}
                  selectedColumns={visibleColumns}
                  onColumnChange={setVisibleColumns}
                />
              </div>
            </div>
          </div>
        </div>
        
        {/* Help Section */}
        {showHelp && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mx-6 mb-4">
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <h3 className="font-semibold text-blue-900 mb-2 flex items-center gap-2">
                  <Info className="h-4 w-4" />
                  Clustering Configuration Guide
                </h3>
                <div className="grid grid-cols-2 gap-4 text-sm text-blue-800">
                  <div>
                    <div className="font-medium mb-1">🎯 To Reduce Outliers:</div>
                    <ul className="space-y-1 text-xs">
                      <li>• <strong>Decrease K</strong> - Create fewer, larger clusters</li>
                      <li>• <strong>Lower T</strong> - Allow items with less similarity to join clusters</li>
                      <li>• Start with K=15-20 and T=0.50-0.55</li>
                    </ul>
                  </div>
                  <div>
                    <div className="font-medium mb-1">📊 To Improve Quality:</div>
                    <ul className="space-y-1 text-xs">
                      <li>• <strong>Increase K</strong> - Create more focused groups</li>
                      <li>• <strong>Raise T</strong> - Ensure tighter similarity within clusters</li>
                      <li>• Monitor outlier % (aim for &lt;20%)</li>
                    </ul>
                  </div>
                </div>
                <div className="mt-3 p-2 bg-white rounded border border-blue-200">
                  <div className="text-xs text-gray-600">
                    <strong>Pro tip:</strong> Create multiple scenarios with different settings and compare results. 
                    The best configuration balances low outliers with meaningful cluster groupings. 
                    Use the eye icon to examine cluster contents before applying to production.
                  </div>
                </div>
              </div>
              <button
                onClick={() => setShowHelp(false)}
                className="text-blue-400 hover:text-blue-600 p-1"
              >
                ✕
              </button>
            </div>
          </div>
        )}
        
        {/* Table Section */}
        <div className="bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="w-12 px-4"></th>
                  {visibleColumns.includes('parameters') && (
                    <th 
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSort('k_value')}
                    >
                      <div className="flex items-center gap-1">
                        Parameters
                        <SortIcon field="k_value" />
                      </div>
                    </th>
                  )}
                  {visibleColumns.includes('status') && (
                    <th 
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSort('status')}
                    >
                      <div className="flex items-center gap-1">
                        Status
                        <SortIcon field="status" />
                      </div>
                    </th>
                  )}
                  {visibleColumns.includes('results') && (
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Results
                    </th>
                  )}
                  {visibleColumns.includes('improvement') && (
                    <th 
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSort('outlier_improvement_percentage')}
                    >
                      <div className="flex items-center gap-1">
                        Improvement
                        <SortIcon field="outlier_improvement_percentage" />
                      </div>
                    </th>
                  )}
                  {visibleColumns.includes('processing_time') && (
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Processing Time
                    </th>
                  )}
                  {visibleColumns.includes('total_items') && (
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Total Items
                    </th>
                  )}
                  {visibleColumns.includes('notes') && (
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Notes
                    </th>
                  )}
                  {visibleColumns.includes('created') && (
                    <th 
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSort('requested_at')}
                    >
                      <div className="flex items-center gap-1">
                        Created
                        <SortIcon field="requested_at" />
                      </div>
                    </th>
                  )}
                  {visibleColumns.includes('actions') && (
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {scenariosLoading ? (
                  <tr>
                    <td colSpan={visibleColumns.length} className="px-6 py-12 text-center text-gray-500">
                      <div className="flex flex-col items-center">
                        <RefreshCw className="h-8 w-8 text-gray-400 animate-spin mb-2" />
                        Loading scenarios...
                      </div>
                    </td>
                  </tr>
                ) : sortedScenarios.length === 0 ? (
                  <tr>
                    <td colSpan={visibleColumns.length} className="px-6 py-12 text-center text-gray-500">
                      <div className="flex flex-col items-center">
                        <div className="text-lg mb-2">No scenarios yet</div>
                        <div className="text-sm">Click "New Scenario" to create one</div>
                      </div>
                    </td>
                  </tr>
                ) : (
                  sortedScenarios.map((scenario) => (
                    <React.Fragment key={scenario.id}>
                    <tr 
                      className={`hover:bg-gray-50 cursor-pointer ${
                        isPinned(scenario.id) ? 'bg-blue-50 border-l-4 border-blue-500' : ''
                      } ${
                        selectedScenarioId === scenario.id ? 'bg-blue-50' : ''
                      }`}
                      onClick={() => setExpandedScenarioId(expandedScenarioId === scenario.id ? null : scenario.id)}
                    >
                      <td className="px-4 py-3 text-center">
                        <span className="text-gray-400 text-sm">
                          {expandedScenarioId === scenario.id ? '▼' : '▶'}
                        </span>
                      </td>
                      {visibleColumns.includes('parameters') && (
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm">
                            <span className="font-medium text-gray-900">K={scenario.k_value}</span>
                            <span className="text-gray-500 ml-2">T={scenario.similarity_threshold}</span>
                          </div>
                        </td>
                      )}
                      {visibleColumns.includes('status') && (
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(scenario.status)}`}>
                            {scenario.status}
                            {scenario.status === 'processing' && (
                              <div className="ml-2 animate-spin h-3 w-3 border-2 border-current border-t-transparent rounded-full"></div>
                            )}
                          </span>
                        </td>
                      )}
                      {visibleColumns.includes('results') && (
                        <td className="px-6 py-4 whitespace-nowrap">
                          {scenario.status === 'completed' ? (
                            <div className="text-sm">
                              <span className="font-medium text-gray-900">{scenario.cluster_count} clusters</span>
                              <span className="text-red-600 ml-2">{scenario.outlier_percentage}% outliers</span>
                            </div>
                          ) : (
                            <span className="text-sm text-gray-400">-</span>
                          )}
                        </td>
                      )}
                      {visibleColumns.includes('improvement') && (
                        <td className="px-6 py-4 whitespace-nowrap">
                          {scenario.status === 'completed' ? (
                            <span className={`text-sm font-medium ${getImprovementColor(scenario.outlier_improvement_percentage)}`}>
                              {scenario.outlier_improvement_percentage > 0 ? '+' : ''}{scenario.outlier_improvement_percentage}%
                            </span>
                          ) : (
                            <span className="text-sm text-gray-400">-</span>
                          )}
                        </td>
                      )}
                      {visibleColumns.includes('processing_time') && (
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {scenario.processing_time_ms ? `${(scenario.processing_time_ms / 1000).toFixed(1)}s` : '-'}
                        </td>
                      )}
                      {visibleColumns.includes('total_items') && (
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {scenario.total_items || '-'}
                        </td>
                      )}
                      {visibleColumns.includes('notes') && (
                        <td className="px-6 py-4 text-sm text-gray-500">
                          {scenario.notes ? scenario.notes.substring(0, 50) + '...' : '-'}
                        </td>
                      )}
                      {visibleColumns.includes('created') && (
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {formatDateTime(scenario.requested_at)}
                        </td>
                      )}
                      {visibleColumns.includes('actions') && (
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          <div className="flex items-center justify-center gap-2">
                            {scenario.status === 'completed' && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedScenarioId(scenario.id);
                                  setShowResults(true);
                                }}
                                className="p-2 rounded-lg transition-all transform hover:scale-110 text-purple-500 hover:text-purple-700 hover:bg-purple-100"
                                title="View Details"
                              >
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                                  <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/>
                                </svg>
                              </button>
                            )}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                togglePin(scenario.id);
                              }}
                              className={`p-2 rounded-lg transition-all transform hover:scale-110 ${
                                isPinned(scenario.id) 
                                  ? 'text-blue-600 bg-blue-50 hover:bg-blue-100' 
                                  : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
                              }`}
                              title={isPinned(scenario.id) ? 'Unpin' : 'Pin to top'}
                            >
                              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M16,12V4H17V2H7V4H8V12L6,14V16H11.2V22H12.8V16H18V14L16,12Z" />
                              </svg>
                            </button>
                            {scenario.status !== 'processing' && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (confirm('Delete this scenario?')) {
                                    deleteMutation.mutate(scenario.id);
                                  }
                                }}
                                className="p-2 rounded-lg transition-all transform hover:scale-110 text-red-500 hover:text-red-700 hover:bg-red-100"
                                title="Delete"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                    {expandedScenarioId === scenario.id && (
                      <tr>
                        <td colSpan={visibleColumns.length + 1} className="px-0 py-0 bg-gray-50">
                          <div className="border-l-4 border-blue-400 ml-8">
                            {scenario.status === 'completed' && (expandedScenario || selectedScenario) ? (
                              <ClusterVisualization scenario={expandedScenario || selectedScenario} />
                            ) : scenario.status === 'processing' ? (
                              <div className="p-8 text-center text-gray-500">
                                <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-2" />
                                Processing scenario...
                              </div>
                            ) : scenario.status === 'completed' ? (
                              <div className="p-8 text-center text-gray-500">
                                <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-2" />
                                Loading visualization...
                              </div>
                            ) : (
                              <div className="p-8 text-center text-gray-500">
                                Scenario not yet processed
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                    </React.Fragment>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      
      {/* Results Modal */}
      {showResults && selectedScenarioId && (
        <ScenarioResults 
          scenarioId={selectedScenarioId} 
          onClose={() => {
            setShowResults(false);
            refetchScenarios();
          }}
        />
      )}
    </div>
  );
}

export default ClusterConfiguration;