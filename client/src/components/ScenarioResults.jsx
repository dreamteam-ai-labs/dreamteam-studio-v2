import React, { useState, useEffect } from 'react';
import { ChevronDown, ChevronRight, AlertCircle, CheckCircle2, XCircle, TrendingUp, TrendingDown, Minus, BarChart3, Users, AlertTriangle } from 'lucide-react';
import * as api from '../services/api';

function ScenarioResults({ scenarioId, onClose }) {
  const [scenario, setScenario] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedClusters, setExpandedClusters] = useState(new Set());
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    fetchScenarioDetails();
  }, [scenarioId]);

  const fetchScenarioDetails = async () => {
    try {
      setLoading(true);
      const data = await api.getClusteringScenarioDetails(scenarioId);
      setScenario(data);
    } catch (err) {
      setError('Failed to load scenario details');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const toggleClusterExpansion = (clusterId) => {
    const newExpanded = new Set(expandedClusters);
    if (newExpanded.has(clusterId)) {
      newExpanded.delete(clusterId);
    } else {
      newExpanded.add(clusterId);
    }
    setExpandedClusters(newExpanded);
  };

  const applyToProduction = async () => {
    if (!window.confirm(`Are you sure you want to apply this clustering configuration to production?\n\nThis will update all ${scenario.entity_type} cluster assignments.`)) {
      return;
    }

    try {
      await api.applyScenarioToProduction(scenarioId);
      alert('Scenario applied to production successfully!');
      onClose();
    } catch (err) {
      alert('Failed to apply scenario: ' + err.message);
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-xl p-8 shadow-2xl">
          <div className="flex flex-col items-center">
            <div className="animate-spin h-12 w-12 border-4 border-blue-500 border-t-transparent rounded-full mb-4"></div>
            <div className="text-gray-600">Loading scenario details...</div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-xl p-8 shadow-2xl max-w-md">
          <div className="text-red-600 flex items-center mb-4">
            <XCircle className="mr-2 h-6 w-6" />
            <span className="text-lg font-semibold">Error</span>
          </div>
          <p className="text-gray-700 mb-6">{error}</p>
        </div>
      </div>
    );
  }

  if (!scenario) return null;

  const getImprovementIcon = () => {
    if (scenario.outlier_improvement_percentage > 5) return <TrendingUp className="h-5 w-5" />;
    if (scenario.outlier_improvement_percentage > -5) return <Minus className="h-5 w-5" />;
    return <TrendingDown className="h-5 w-5" />;
  };

  const getImprovementColor = () => {
    if (scenario.outlier_improvement_percentage > 0) {
      return { bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-700', subtext: 'text-green-600' };
    } else if (scenario.outlier_improvement_percentage > -5) {
      return { bg: 'bg-gray-50', border: 'border-gray-200', text: 'text-gray-700', subtext: 'text-gray-600' };
    }
    return { bg: 'bg-yellow-50', border: 'border-yellow-200', text: 'text-yellow-700', subtext: 'text-yellow-600' };
  };

  const improvementColors = getImprovementColor();

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-7xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gray-50 border-b p-6">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-2xl font-bold mb-2 text-gray-800">Scenario Analysis Results</h2>
              <div className="flex items-center gap-4 text-gray-600">
                <span>Type: <span className="font-semibold text-gray-800">{scenario.entity_type}</span></span>
                <span>K: <span className="font-semibold text-gray-800">{scenario.k_value}</span></span>
                <span>Threshold: <span className="font-semibold text-gray-800">{scenario.similarity_threshold}</span></span>
              </div>
            </div>
            <button 
              onClick={onClose}
              className="p-2 hover:bg-gray-200 rounded-lg transition-colors text-gray-500"
              title="Close"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b bg-gray-50">
          <nav className="flex -mb-px">
            <button
              onClick={() => setActiveTab('overview')}
              className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'overview' 
                  ? 'border-blue-500 text-blue-600' 
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Overview
            </button>
            <button
              onClick={() => setActiveTab('clusters')}
              className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'clusters' 
                  ? 'border-blue-500 text-blue-600' 
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Cluster Details
            </button>
            <button
              onClick={() => setActiveTab('comparison')}
              className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'comparison' 
                  ? 'border-blue-500 text-blue-600' 
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Production Comparison
            </button>
          </nav>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Key Metrics */}
              <div className="grid grid-cols-3 gap-4">
                {/* Total Clusters */}
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
                  <div className="flex items-center justify-between mb-2">
                    <BarChart3 className="h-8 w-8 text-blue-500" />
                    <span className="text-3xl font-bold text-blue-700">{scenario.cluster_count}</span>
                  </div>
                  <div className="text-sm text-blue-600">Total Clusters</div>
                  <div className="text-xs text-blue-500 mt-1">Including outlier bucket</div>
                </div>

                {/* Total Items */}
                <div className="bg-purple-50 border border-purple-200 rounded-xl p-6">
                  <div className="flex items-center justify-between mb-2">
                    <Users className="h-8 w-8 text-purple-500" />
                    <span className="text-3xl font-bold text-purple-700">{scenario.total_items}</span>
                  </div>
                  <div className="text-sm text-purple-600">Total Items</div>
                  <div className="text-xs text-purple-500 mt-1">Successfully clustered</div>
                </div>

                {/* Outliers */}
                <div className="bg-red-50 border border-red-200 rounded-xl p-6">
                  <div className="flex items-center justify-between mb-2">
                    <AlertTriangle className="h-8 w-8 text-red-500" />
                    <span className="text-3xl font-bold text-red-700">{scenario.outlier_count}</span>
                  </div>
                  <div className="text-sm text-red-600">Outliers</div>
                  <div className="text-xs text-red-500 mt-1">{scenario.outlier_percentage}% of total</div>
                </div>
              </div>

              {/* Improvement Banner */}
              <div className={`${improvementColors.bg} ${improvementColors.border} border rounded-xl p-6`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className={improvementColors.text}>
                      {getImprovementIcon()}
                    </span>
                    <div>
                      <div className={`text-2xl font-bold ${improvementColors.text}`}>
                        {scenario.outlier_improvement_percentage > 0 ? '+' : ''}{scenario.outlier_improvement_percentage}%
                      </div>
                      <div className={`text-sm ${improvementColors.subtext}`}>
                        Outlier Improvement vs Production
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm text-gray-600">Production Outliers: {scenario.production_outlier_percentage}%</div>
                    <div className="text-sm text-gray-600">Scenario Outliers: {scenario.outlier_percentage}%</div>
                  </div>
                </div>
              </div>

              {/* Visual Assessment */}
              <div className="bg-gray-50 rounded-xl p-6">
                <h3 className="text-lg font-semibold mb-4 text-gray-800">Quality Assessment</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className={`p-4 rounded-lg border ${
                    scenario.outlier_percentage < 20 
                      ? 'bg-green-50 border-green-200' 
                      : scenario.outlier_percentage < 40 
                      ? 'bg-yellow-50 border-yellow-200' 
                      : 'bg-red-50 border-red-200'
                  }`}>
                    <div className="flex items-center gap-2 mb-2">
                      {scenario.outlier_percentage < 20 ? (
                        <CheckCircle2 className="h-5 w-5 text-green-600" />
                      ) : (
                        <AlertCircle className="h-5 w-5 text-yellow-600" />
                      )}
                      <span className="font-medium text-gray-700">Outlier Rate</span>
                    </div>
                    <p className="text-sm text-gray-600">
                      {scenario.outlier_percentage < 20 
                        ? 'Excellent clustering quality' 
                        : scenario.outlier_percentage < 40 
                        ? 'Moderate clustering quality' 
                        : 'Consider adjusting parameters'}
                    </p>
                  </div>

                  <div className={`p-4 rounded-lg border ${
                    scenario.outlier_improvement_percentage > 0 
                      ? 'bg-green-50 border-green-200' 
                      : 'bg-yellow-50 border-yellow-200'
                  }`}>
                    <div className="flex items-center gap-2 mb-2">
                      {scenario.outlier_improvement_percentage > 0 ? (
                        <CheckCircle2 className="h-5 w-5 text-green-600" />
                      ) : (
                        <AlertCircle className="h-5 w-5 text-yellow-600" />
                      )}
                      <span className="font-medium text-gray-700">Production Comparison</span>
                    </div>
                    <p className="text-sm text-gray-600">
                      {scenario.outlier_improvement_percentage > 0 
                        ? 'Better than current production' 
                        : 'Worse than current production'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'clusters' && (
            <div className="space-y-4">
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm text-gray-600">
                  {scenario.cluster_count} clusters with {scenario.total_items} items total.
                  Click on a cluster to see its items.
                </p>
              </div>

              {scenario.clusters?.map((cluster, index) => (
                <div key={cluster.id || `cluster-${index}`} className="bg-white border rounded-lg">
                  <button
                    onClick={() => toggleClusterExpansion(cluster.id)}
                    className="w-full p-4 flex items-center justify-between hover:bg-gray-50"
                  >
                    <div className="flex items-center gap-3">
                      {expandedClusters.has(cluster.id) ? (
                        <ChevronDown className="h-5 w-5 text-gray-400" />
                      ) : (
                        <ChevronRight className="h-5 w-5 text-gray-400" />
                      )}
                      <div className="text-left">
                        <div className="font-medium text-gray-800">
                          {cluster.is_outlier ? 'Outlier Bucket' : cluster.label || `Cluster ${cluster.id ? cluster.id.slice(0, 8) : 'Unknown'}`}
                        </div>
                        <div className="text-sm text-gray-600">{cluster.item_count} items</div>
                      </div>
                    </div>
                    {cluster.is_outlier && (
                      <span className="px-2 py-1 bg-red-100 text-red-700 text-xs rounded">Outliers</span>
                    )}
                  </button>

                  {expandedClusters.has(cluster.id) && (
                    <div className="border-t p-4 bg-gray-50">
                      <div className="space-y-2">
                        {cluster.items?.map((item, itemIndex) => (
                          <div key={item.id || `item-${itemIndex}`} className="p-2 bg-white rounded border">
                            <div className="text-sm font-medium text-gray-800">{item.name || item.statement}</div>
                            {item.similarity && (
                              <div className="text-xs text-gray-500 mt-1">
                                Similarity: {(item.similarity * 100).toFixed(1)}%
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {activeTab === 'comparison' && (
            <div className="space-y-6">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h3 className="font-semibold text-blue-900 mb-2">Production vs Scenario</h3>
                <div className="grid grid-cols-2 gap-4 mt-4">
                  <div>
                    <div className="text-sm text-blue-700">Production</div>
                    <div className="text-2xl font-bold text-blue-900">{scenario.production_outlier_percentage}%</div>
                    <div className="text-xs text-blue-600">Current outlier rate</div>
                  </div>
                  <div>
                    <div className="text-sm text-blue-700">This Scenario</div>
                    <div className="text-2xl font-bold text-blue-900">{scenario.outlier_percentage}%</div>
                    <div className="text-xs text-blue-600">Projected outlier rate</div>
                  </div>
                </div>
              </div>

              {scenario.outlier_improvement_percentage > 0 ? (
                <div className="bg-green-50 border border-green-200 rounded-lg p-6">
                  <div className="flex items-center gap-3 mb-3">
                    <CheckCircle2 className="h-6 w-6 text-green-600" />
                    <h3 className="font-semibold text-green-900">Recommended for Production</h3>
                  </div>
                  <p className="text-sm text-green-700 mb-4">
                    This configuration reduces outliers by {scenario.outlier_improvement_percentage}% compared to current production settings.
                  </p>
                  <button 
                    onClick={applyToProduction}
                    className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                  >
                    Apply to Production
                  </button>
                </div>
              ) : (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
                  <div className="flex items-center gap-3 mb-3">
                    <AlertCircle className="h-6 w-6 text-yellow-600" />
                    <h3 className="font-semibold text-yellow-900">Not Recommended</h3>
                  </div>
                  <p className="text-sm text-yellow-700">
                    This configuration would increase outliers by {Math.abs(scenario.outlier_improvement_percentage)}% compared to current production settings.
                    Consider adjusting parameters for better results.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t p-4 bg-gray-50">
          <div className="text-sm text-gray-600">
            Created: {new Date(scenario.requested_at).toLocaleString()}
          </div>
        </div>
      </div>
    </div>
  );
}

export default ScenarioResults;