import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getProblems, getSolutions, getSolutionsByProblem, getSolutionsByCluster, getSolutionsBySolutionCluster, getProblemsBySolution, getProblemsByCluster, getClusterById } from '../services/api';
import { formatCurrency, formatLargeCurrency } from '../utils/numberUtils';

function StudyModeModal({ isOpen, onClose, initialEntity, entityType }) {
  const [currentEntity, setCurrentEntity] = useState(initialEntity);
  const [currentType, setCurrentType] = useState(entityType);
  const [navigationHistory, setNavigationHistory] = useState([]);
  const [activeTab, setActiveTab] = useState('overview');

  // Update when props change
  useEffect(() => {
    if (initialEntity && entityType) {
      setCurrentEntity(initialEntity);
      setCurrentType(entityType);
      setNavigationHistory([{ entity: initialEntity, type: entityType }]);
      setActiveTab('overview');
    }
  }, [initialEntity, entityType]);

  // Fetch related solutions for problems
  const { data: relatedSolutions } = useQuery({
    queryKey: ['study-solutions', currentEntity?.id, currentType],
    queryFn: () => {
      if (currentType === 'problem' && currentEntity?.id) {
        return getSolutionsByProblem(currentEntity.id);
      }
      return null;
    },
    enabled: currentType === 'problem' && !!currentEntity?.id,
  });

  // Fetch cluster solutions if problem has cluster
  const { data: clusterSolutions } = useQuery({
    queryKey: ['study-cluster-solutions', currentEntity?.cluster_id],
    queryFn: () => getSolutionsByCluster(currentEntity.cluster_id),
    enabled: currentType === 'problem' && !!currentEntity?.cluster_id,
  });

  // Fetch problems directly linked to solution
  const { data: directProblems } = useQuery({
    queryKey: ['study-problems', currentEntity?.id, currentType],
    queryFn: () => {
      if (currentType === 'solution' && currentEntity?.id) {
        return getProblemsBySolution(currentEntity.id);
      }
      return null;
    },
    enabled: currentType === 'solution' && !!currentEntity?.id,
  });

  // Fetch problems from the cluster if solution has a cluster
  const { data: clusterProblems } = useQuery({
    queryKey: ['study-cluster-problems', currentEntity?.source_cluster_id],
    queryFn: () => getProblemsByCluster(currentEntity.source_cluster_id),
    enabled: currentType === 'solution' && !!currentEntity?.source_cluster_id,
  });

  // Fetch problems for cluster entity (only for problem clusters)
  const { data: clusterEntityProblems } = useQuery({
    queryKey: ['cluster-entity-problems', currentEntity?.cluster_id, currentType],
    queryFn: () => {
      if (currentType === 'cluster' && currentEntity?.cluster_id) {
        return getProblemsByCluster(currentEntity.cluster_id);
      }
      return null;
    },
    enabled: currentType === 'cluster' && !!currentEntity?.cluster_id,
  });

  // Fetch solutions for cluster entity (for problem clusters)
  const { data: clusterEntitySolutions } = useQuery({
    queryKey: ['cluster-entity-solutions', currentEntity?.cluster_id, currentType],
    queryFn: () => {
      if (currentType === 'cluster' && currentEntity?.cluster_id) {
        return getSolutionsByCluster(currentEntity.cluster_id);
      }
      return null;
    },
    enabled: currentType === 'cluster' && !!currentEntity?.cluster_id,
  });

  // Fetch solutions for solution cluster entity
  const { data: solutionClusterSolutions } = useQuery({
    queryKey: ['solution-cluster-solutions', currentEntity?.cluster_id, currentType],
    queryFn: () => {
      if (currentType === 'solutionCluster' && currentEntity?.cluster_id) {
        // Get solutions that belong to this solution cluster
        return getSolutionsBySolutionCluster(currentEntity.cluster_id);
      }
      return null;
    },
    enabled: currentType === 'solutionCluster' && !!currentEntity?.cluster_id,
  });

  if (!isOpen) return null;

  const navigateToEntity = (entity, type) => {
    setCurrentEntity(entity);
    setCurrentType(type);
    setNavigationHistory(prev => [...prev, { entity, type }]);
    setActiveTab('overview');
  };

  const goBack = () => {
    if (navigationHistory.length > 1) {
      const newHistory = [...navigationHistory];
      newHistory.pop();
      const previous = newHistory[newHistory.length - 1];
      setCurrentEntity(previous.entity);
      setCurrentType(previous.type);
      setNavigationHistory(newHistory);
    }
  };

  const renderBreadcrumbs = () => (
    <div className="flex items-center gap-2 text-sm text-gray-600 mb-4">
      {navigationHistory.map((item, index) => (
        <React.Fragment key={index}>
          {index > 0 && <span className="text-gray-400">→</span>}
          <button
            onClick={() => {
              if (index < navigationHistory.length - 1) {
                const newHistory = navigationHistory.slice(0, index + 1);
                setNavigationHistory(newHistory);
                setCurrentEntity(item.entity);
                setCurrentType(item.type);
              }
            }}
            className={`hover:text-blue-600 ${
              index === navigationHistory.length - 1 ? 'font-semibold text-gray-900' : ''
            }`}
          >
            {item.type === 'problem' ? '❓' : item.type === 'solution' ? '💡' : '📊'} {item.entity.title || item.entity.cluster_label || item.entity.identifier}
          </button>
        </React.Fragment>
      ))}
    </div>
  );

  const renderOverviewTab = () => {
    if (currentType === 'cluster' || currentType === 'solutionCluster') {
      return (
        <div className="space-y-6">
          {/* Cluster Header */}
          <div>
            <h3 className="text-2xl font-bold text-gray-900 mb-2">
              {currentEntity.is_outlier_bucket ? '⚠️ Outlier Bucket' : currentEntity.cluster_label}
            </h3>
            <div className="flex gap-3 mb-4">
              <span className="px-3 py-1 bg-purple-100 text-purple-700 rounded-lg text-sm">
                📊 Cluster ID: {currentEntity.cluster_id?.slice(0, 8)}...
              </span>
              {currentEntity.avg_similarity && (
                <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-lg text-sm">
                  Similarity: {(currentEntity.avg_similarity * 100).toFixed(1)}%
                </span>
              )}
            </div>
          </div>

          {/* Cluster Statistics */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div className="bg-white p-4 rounded-lg border border-gray-200">
              <div className="text-sm text-gray-500 mb-1">Problems</div>
              <div className="font-medium text-xl">{currentEntity.problem_count || 0}</div>
            </div>
            <div className="bg-white p-4 rounded-lg border border-gray-200">
              <div className="text-sm text-gray-500 mb-1">Solutions</div>
              <div className="font-medium text-xl">{currentEntity.solution_count || 0}</div>
            </div>
            {currentEntity.created_at && (
              <div className="bg-white p-4 rounded-lg border border-gray-200">
                <div className="text-sm text-gray-500 mb-1">Created</div>
                <div className="font-medium">{new Date(currentEntity.created_at).toLocaleDateString()}</div>
              </div>
            )}
          </div>

          {/* Cluster Insights and Analysis */}
          {currentEntity.cluster_insights && (
            <div className="bg-blue-50 p-6 rounded-lg border-l-4 border-blue-400">
              <h4 className="font-semibold text-blue-900 mb-3">Cluster Insights</h4>
              <p className="text-blue-800 leading-relaxed">
                {currentEntity.cluster_insights}
              </p>
            </div>
          )}

          {/* Comprehensive Cluster Analysis */}
          {currentEntity.cluster_analysis && (
            <div className="space-y-6">
              {/* Check if this is a solution cluster and render appropriate fields */}
              {currentType === 'solutionCluster' ? (
                <>
                  {/* Solution Cluster Patterns */}
                  {currentEntity.cluster_analysis.patterns && (
                    <div className="bg-white p-6 rounded-lg border border-gray-200">
                      <h4 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
                        <span className="text-purple-600">🔍</span> Key Patterns
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {currentEntity.cluster_analysis.patterns.map((pattern, idx) => (
                          <span key={idx} className="inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium bg-purple-100 text-purple-800">
                            {pattern}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {/* Target Market & Core Capabilities */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {currentEntity.cluster_analysis.target_market && (
                      <div className="bg-blue-50 p-6 rounded-lg border border-blue-200">
                        <h4 className="font-semibold text-blue-900 mb-4 flex items-center gap-2">
                          <span>🎯</span> Target Market
                        </h4>
                        <ul className="space-y-2">
                          {currentEntity.cluster_analysis.target_market.map((market, idx) => (
                            <li key={idx} className="flex items-start">
                              <span className="text-blue-400 mr-2 mt-0.5">•</span>
                              <span className="text-blue-800">{market}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    
                    {currentEntity.cluster_analysis.core_capabilities && (
                      <div className="bg-green-50 p-6 rounded-lg border border-green-200">
                        <h4 className="font-semibold text-green-900 mb-4 flex items-center gap-2">
                          <span>⚡</span> Core Capabilities
                        </h4>
                        <ul className="space-y-2">
                          {currentEntity.cluster_analysis.core_capabilities.map((capability, idx) => (
                            <li key={idx} className="flex items-start">
                              <span className="text-green-400 mr-2 mt-0.5">•</span>
                              <span className="text-green-800">{capability}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                  
                  {/* Business Model & Competitive Advantage */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {currentEntity.cluster_analysis.business_model && (
                      <div className="bg-yellow-50 p-6 rounded-lg border border-yellow-200">
                        <h4 className="font-semibold text-yellow-900 mb-3 flex items-center gap-2">
                          <span>💰</span> Business Model
                        </h4>
                        <p className="text-yellow-800 leading-relaxed">
                          {currentEntity.cluster_analysis.business_model}
                        </p>
                      </div>
                    )}
                    
                    {currentEntity.cluster_analysis.competitive_advantage && (
                      <div className="bg-purple-50 p-6 rounded-lg border border-purple-200">
                        <h4 className="font-semibold text-purple-900 mb-3 flex items-center gap-2">
                          <span>🏆</span> Competitive Advantage
                        </h4>
                        <p className="text-purple-800 leading-relaxed">
                          {currentEntity.cluster_analysis.competitive_advantage}
                        </p>
                      </div>
                    )}
                  </div>
                  
                  {/* Implementation & Revenue */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {currentEntity.cluster_analysis.implementation_complexity && (
                      <div className="bg-orange-50 p-6 rounded-lg border border-orange-200">
                        <h4 className="font-semibold text-orange-900 mb-3 flex items-center gap-2">
                          <span>🔧</span> Implementation Complexity
                        </h4>
                        <p className="text-orange-800 leading-relaxed">
                          {currentEntity.cluster_analysis.implementation_complexity}
                        </p>
                      </div>
                    )}
                    
                    {currentEntity.cluster_analysis.revenue_potential && (
                      <div className="bg-indigo-50 p-6 rounded-lg border border-indigo-200">
                        <h4 className="font-semibold text-indigo-900 mb-3 flex items-center gap-2">
                          <span>📈</span> Revenue Potential
                        </h4>
                        <p className="text-indigo-800 leading-relaxed">
                          {currentEntity.cluster_analysis.revenue_potential}
                        </p>
                      </div>
                    )}
                  </div>
                  
                  {/* Representative Solutions */}
                  {currentEntity.cluster_analysis.representative_solutions && currentEntity.cluster_analysis.representative_solutions.length > 0 && (
                    <div className="bg-gray-50 p-6 rounded-lg border border-gray-200">
                      <h4 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
                        <span className="text-teal-600">🌟</span> Representative Solutions
                      </h4>
                      <div className="space-y-2">
                        {currentEntity.cluster_analysis.representative_solutions.map((solution, idx) => (
                          <div key={idx} className="bg-white p-3 rounded-lg border border-gray-200">
                            <p className="text-gray-800">{solution}</p>
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
                  {currentEntity.cluster_analysis.common_patterns && (
                <div className="bg-white p-6 rounded-lg border border-gray-200">
                  <h4 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
                    <span className="text-purple-600">🔍</span> Common Patterns
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {currentEntity.cluster_analysis.common_patterns.map((pattern, idx) => (
                      <span key={idx} className="inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium bg-purple-100 text-purple-800">
                        {pattern}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Business Impact & Market Opportunity */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {currentEntity.cluster_analysis.business_impact && (
                  <div className="bg-yellow-50 p-6 rounded-lg border border-yellow-200">
                    <h4 className="font-semibold text-yellow-900 mb-3 flex items-center gap-2">
                      <span>💼</span> Business Impact
                    </h4>
                    <p className="text-yellow-800 leading-relaxed">
                      {currentEntity.cluster_analysis.business_impact}
                    </p>
                  </div>
                )}
                
                {currentEntity.cluster_analysis.market_opportunity && (
                  <div className="bg-green-50 p-6 rounded-lg border border-green-200">
                    <h4 className="font-semibold text-green-900 mb-3 flex items-center gap-2">
                      <span>📈</span> Market Opportunity
                    </h4>
                    <p className="text-green-800 leading-relaxed">
                      {currentEntity.cluster_analysis.market_opportunity}
                    </p>
                  </div>
                )}
              </div>

              {/* Stakeholders & Root Causes */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {currentEntity.cluster_analysis.affected_stakeholders && (
                  <div className="bg-white p-6 rounded-lg border border-gray-200">
                    <h4 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
                      <span className="text-blue-600">👥</span> Affected Stakeholders
                    </h4>
                    <ul className="space-y-2">
                      {currentEntity.cluster_analysis.affected_stakeholders.map((stakeholder, idx) => (
                        <li key={idx} className="flex items-start">
                          <span className="text-gray-400 mr-2 mt-0.5">•</span>
                          <span className="text-gray-700">{stakeholder}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                
                {currentEntity.cluster_analysis.root_causes && (
                  <div className="bg-white p-6 rounded-lg border border-gray-200">
                    <h4 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
                      <span className="text-red-600">🎯</span> Root Causes
                    </h4>
                    <ul className="space-y-2">
                      {currentEntity.cluster_analysis.root_causes.map((cause, idx) => (
                        <li key={idx} className="flex items-start">
                          <span className="text-gray-400 mr-2 mt-0.5">•</span>
                          <span className="text-gray-700">{cause}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {/* Solution Themes */}
              {currentEntity.cluster_analysis.solution_themes && (
                <div className="bg-indigo-50 p-6 rounded-lg border border-indigo-200">
                  <h4 className="font-semibold text-indigo-900 mb-4 flex items-center gap-2">
                    <span>💡</span> Solution Themes
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {currentEntity.cluster_analysis.solution_themes.map((theme, idx) => (
                      <div key={idx} className="flex items-center">
                        <span className="text-green-500 mr-2">✓</span>
                        <span className="text-indigo-800">{theme}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Representative Problems */}
              {currentEntity.cluster_analysis.representative_problems && currentEntity.cluster_analysis.representative_problems.length > 0 && (
                <div className="bg-gray-50 p-6 rounded-lg border border-gray-200">
                  <h4 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
                    <span className="text-orange-600">📌</span> Representative Problems
                  </h4>
                  <div className="space-y-3">
                    {currentEntity.cluster_analysis.representative_problems.map((problem, idx) => (
                      <div key={idx} className="bg-white p-4 rounded-lg border border-gray-200">
                        <p className="font-medium text-gray-900 mb-2">{problem.title}</p>
                        <p className="text-sm text-gray-600 italic">{problem.why_representative}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
                </>
              )}
            </div>
          )}

          {/* Outlier Bucket Description - Keep existing for outliers */}
          {currentEntity.is_outlier_bucket && !currentEntity.cluster_insights && (
            <div className="bg-yellow-50 p-6 rounded-lg border border-yellow-200">
              <h4 className="font-semibold text-yellow-900 mb-3">About the Outlier Bucket</h4>
              <p className="text-yellow-800 leading-relaxed">
                This cluster contains problems that have low similarity scores (&lt; 0.55) with other problems,
                or are considered outliers in the clustering process. These problems may be unique,
                edge cases, or require individual attention.
              </p>
            </div>
          )}
        </div>
      );
    } else if (currentType === 'problem') {
      return (
        <div className="space-y-6">
          {/* Problem Header */}
          <div>
            <h3 className="text-2xl font-bold text-gray-900 mb-2">{currentEntity.title}</h3>
            <div className="flex gap-3 mb-4">
              {currentEntity.identifier && (
                <span className="px-3 py-1 bg-gray-100 text-gray-700 rounded-lg text-sm">
                  {currentEntity.identifier}
                </span>
              )}
              {currentEntity.impact && (
                <span className={`px-3 py-1 rounded-lg text-sm font-medium ${
                  currentEntity.impact === 'high' ? 'bg-red-100 text-red-700' :
                  currentEntity.impact === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                  'bg-green-100 text-green-700'
                }`}>
                  {currentEntity.impact} impact
                </span>
              )}
              {currentEntity.cluster_label && (
                <span className="px-3 py-1 bg-purple-100 text-purple-700 rounded-lg text-sm">
                  📊 {currentEntity.cluster_label}
                </span>
              )}
            </div>
          </div>

          {/* Full Description */}
          <div className="bg-gray-50 p-6 rounded-lg">
            <h4 className="font-semibold text-gray-700 mb-3">Description</h4>
            <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">
              {currentEntity.description || 'No description available'}
            </p>
          </div>

          {/* Metadata Grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {currentEntity.industry && (
              <div className="bg-white p-4 rounded-lg border border-gray-200">
                <div className="text-sm text-gray-500 mb-1">Industry</div>
                <div className="font-medium">{currentEntity.industry}</div>
              </div>
            )}
            {currentEntity.business_size && (
              <div className="bg-white p-4 rounded-lg border border-gray-200">
                <div className="text-sm text-gray-500 mb-1">Business Size</div>
                <div className="font-medium">{currentEntity.business_size}</div>
              </div>
            )}
            {currentEntity.source_url && (
              <div className="bg-white p-4 rounded-lg border border-gray-200">
                <div className="text-sm text-gray-500 mb-1">Source</div>
                <a href={currentEntity.source_url} target="_blank" rel="noopener noreferrer" 
                   className="text-blue-600 hover:text-blue-800 text-sm truncate block">
                  {currentEntity.source_url}
                </a>
              </div>
            )}
            {currentEntity.solution_count !== undefined && (
              <div className="bg-white p-4 rounded-lg border border-gray-200">
                <div className="text-sm text-gray-500 mb-1">Solutions</div>
                <div className="font-medium">{currentEntity.solution_count || 0}</div>
              </div>
            )}
            {currentEntity.created_at && (
              <div className="bg-white p-4 rounded-lg border border-gray-200">
                <div className="text-sm text-gray-500 mb-1">Created</div>
                <div className="font-medium">{new Date(currentEntity.created_at).toLocaleDateString()}</div>
              </div>
            )}
          </div>
        </div>
      );
    } else if (currentType === 'solution') {
      return (
        <div className="space-y-6">
          {/* Solution Header */}
          <div>
            <h3 className="text-2xl font-bold text-gray-900 mb-2">{currentEntity.title}</h3>
            <div className="flex gap-3 mb-4">
              {currentEntity.identifier && (
                <span className="px-3 py-1 bg-gray-100 text-gray-700 rounded-lg text-sm">
                  {currentEntity.identifier}
                </span>
              )}
              {currentEntity.overall_viability && (
                <span className={`px-3 py-1 rounded-lg text-sm font-medium ${
                  currentEntity.overall_viability >= 80 ? 'bg-green-100 text-green-700' :
                  currentEntity.overall_viability >= 60 ? 'bg-yellow-100 text-yellow-700' :
                  'bg-red-100 text-red-700'
                }`}>
                  {currentEntity.overall_viability}% viability
                </span>
              )}
              {currentEntity.candidate_score && (
                <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-lg text-sm">
                  Score: {currentEntity.candidate_score}
                </span>
              )}
            </div>
          </div>

          {/* Full Description */}
          <div className="bg-gray-50 p-6 rounded-lg">
            <h4 className="font-semibold text-gray-700 mb-3">Description</h4>
            <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">
              {currentEntity.description || 'No description available'}
            </p>
          </div>

          {/* Value Proposition */}
          {currentEntity.value_proposition && (
            <div className="bg-blue-50 p-6 rounded-lg">
              <h4 className="font-semibold text-blue-900 mb-3">Value Proposition</h4>
              <p className="text-blue-800 leading-relaxed">
                {currentEntity.value_proposition}
              </p>
            </div>
          )}

          {/* Business Metrics */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {currentEntity.market_size_estimate && (
              <div className="bg-white p-4 rounded-lg border border-gray-200">
                <div className="text-sm text-gray-500 mb-1">Market Size</div>
                <div className="font-medium">{formatLargeCurrency(currentEntity.market_size_estimate).replace('£', '$')}</div>
              </div>
            )}
            {currentEntity.ltv_estimate && (
              <div className="bg-white p-4 rounded-lg border border-gray-200">
                <div className="text-sm text-gray-500 mb-1">LTV</div>
                <div className="font-medium">{formatCurrency(currentEntity.ltv_estimate)}</div>
              </div>
            )}
            {currentEntity.cac_estimate && (
              <div className="bg-white p-4 rounded-lg border border-gray-200">
                <div className="text-sm text-gray-500 mb-1">CAC</div>
                <div className="font-medium">{formatCurrency(currentEntity.cac_estimate)}</div>
              </div>
            )}
            {currentEntity.estimated_dev_weeks && (
              <div className="bg-white p-4 rounded-lg border border-gray-200">
                <div className="text-sm text-gray-500 mb-1">Dev Time</div>
                <div className="font-medium">{currentEntity.estimated_dev_weeks} weeks</div>
              </div>
            )}
            {currentEntity.revenue_model && (
              <div className="bg-white p-4 rounded-lg border border-gray-200">
                <div className="text-sm text-gray-500 mb-1">Revenue Model</div>
                <div className="font-medium">{currentEntity.revenue_model}</div>
              </div>
            )}
          </div>
        </div>
      );
    }
    return null;
  };

  const renderRelationshipsTab = () => {
    if (currentType === 'solutionCluster') {
      // For solution clusters, only show solutions
      return (
        <div className="space-y-6">
          {/* Solutions in this Cluster */}
          <div>
            <h4 className="font-semibold text-gray-700 mb-4">Solutions in this Cluster ({solutionClusterSolutions?.length || 0})</h4>
            {solutionClusterSolutions && solutionClusterSolutions.length > 0 ? (
              <div className="grid gap-4">
                {solutionClusterSolutions.map(solution => (
                  <div key={solution.id}
                       className="bg-white p-4 rounded-lg border border-gray-200 hover:border-blue-300 hover:shadow-md transition-all cursor-pointer"
                       onClick={() => navigateToEntity(solution, 'solution')}>
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <h5 className="font-medium text-gray-900 mb-2">{solution.title}</h5>
                        <p className="text-sm text-gray-600 line-clamp-2">{solution.description}</p>
                      </div>
                      <div className="ml-4 text-right">
                        {solution.overall_viability && (
                          <div className={`text-lg font-bold ${
                            solution.overall_viability >= 80 ? 'text-green-600' :
                            solution.overall_viability >= 60 ? 'text-yellow-600' :
                            'text-red-600'
                          }`}>
                            {solution.overall_viability}%
                          </div>
                        )}
                        <div className="text-xs text-gray-500">viability</div>
                      </div>
                    </div>
                    <div className="flex gap-2 mt-3">
                      <span className="text-xs px-2 py-1 bg-gray-100 rounded">
                        Click to explore →
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 italic">No solutions in this cluster</p>
            )}
          </div>
        </div>
      );
    } else if (currentType === 'cluster') {
      return (
        <div className="space-y-6">
          {/* Cluster Problems */}
          <div>
            <h4 className="font-semibold text-gray-700 mb-4">Problems in this Cluster ({clusterEntityProblems?.length || 0})</h4>
            {clusterEntityProblems && clusterEntityProblems.length > 0 ? (
              <div className="grid gap-4">
                {clusterEntityProblems.map(problem => (
                  <div key={problem.id} 
                       className="bg-white p-4 rounded-lg border border-gray-200 hover:border-purple-300 hover:shadow-md transition-all cursor-pointer"
                       onClick={() => navigateToEntity(problem, 'problem')}>
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <h5 className="font-medium text-gray-900 mb-2">{problem.title}</h5>
                        <p className="text-sm text-gray-600 line-clamp-2">{problem.description}</p>
                        {problem.source_url && (
                          <a 
                            href={problem.source_url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 mt-2 text-xs text-blue-600 hover:text-blue-800 hover:underline"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                            </svg>
                            View Source
                          </a>
                        )}
                      </div>
                      <div className="ml-4 text-right">
                        {problem.impact && (
                          <div className={`text-sm font-medium px-2 py-1 rounded ${
                            problem.impact === 'critical' ? 'bg-purple-100 text-purple-700' :
                            problem.impact === 'high' ? 'bg-red-100 text-red-700' :
                            problem.impact === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                            'bg-green-100 text-green-700'
                          }`}>
                            {problem.impact}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2 mt-3">
                      <span className="text-xs px-2 py-1 bg-gray-100 rounded">
                        Click to explore →
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 italic">No problems in this cluster</p>
            )}
          </div>

          {/* Cluster Solutions */}
          <div>
            <h4 className="font-semibold text-gray-700 mb-4">Solutions for this Cluster ({clusterEntitySolutions?.length || 0})</h4>
            {clusterEntitySolutions && clusterEntitySolutions.length > 0 ? (
              <div className="grid gap-4">
                {clusterEntitySolutions.map(solution => (
                  <div key={solution.id}
                       className="bg-white p-4 rounded-lg border border-gray-200 hover:border-blue-300 hover:shadow-md transition-all cursor-pointer"
                       onClick={() => navigateToEntity(solution, 'solution')}>
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <h5 className="font-medium text-gray-900 mb-2">{solution.title}</h5>
                        <p className="text-sm text-gray-600 line-clamp-2">{solution.description}</p>
                      </div>
                      <div className="ml-4 text-right">
                        {solution.overall_viability && (
                          <div className={`text-lg font-bold ${
                            solution.overall_viability >= 80 ? 'text-green-600' :
                            solution.overall_viability >= 60 ? 'text-yellow-600' :
                            'text-red-600'
                          }`}>
                            {solution.overall_viability}%
                          </div>
                        )}
                        <div className="text-xs text-gray-500">viability</div>
                      </div>
                    </div>
                    <div className="flex gap-2 mt-3">
                      <span className="text-xs px-2 py-1 bg-gray-100 rounded">
                        Click to explore →
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 italic">No solutions for this cluster yet</p>
            )}
          </div>
        </div>
      );
    } else if (currentType === 'problem') {
      return (
        <div className="space-y-6">
          {/* Direct Solutions */}
          <div>
            <h4 className="font-semibold text-gray-700 mb-4">Direct Solutions</h4>
            {relatedSolutions && relatedSolutions.length > 0 ? (
              <div className="grid gap-4">
                {relatedSolutions.map(solution => (
                  <div key={solution.id} 
                       className="bg-white p-4 rounded-lg border border-gray-200 hover:border-blue-300 hover:shadow-md transition-all cursor-pointer"
                       onClick={() => navigateToEntity(solution, 'solution')}>
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <h5 className="font-medium text-gray-900 mb-2">{solution.title}</h5>
                        <p className="text-sm text-gray-600 line-clamp-2">{solution.description}</p>
                      </div>
                      <div className="ml-4 text-right">
                        {solution.overall_viability && (
                          <div className={`text-lg font-bold ${
                            solution.overall_viability >= 80 ? 'text-green-600' :
                            solution.overall_viability >= 60 ? 'text-yellow-600' :
                            'text-red-600'
                          }`}>
                            {solution.overall_viability}%
                          </div>
                        )}
                        <div className="text-xs text-gray-500">viability</div>
                      </div>
                    </div>
                    <div className="flex gap-2 mt-3">
                      <span className="text-xs px-2 py-1 bg-gray-100 rounded">
                        Click to explore →
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 italic">No direct solutions found</p>
            )}
          </div>

          {/* Cluster Solutions */}
          {currentEntity.cluster_id && (
            <div>
              <h4 className="font-semibold text-gray-700 mb-4">
                Cluster Solutions ({currentEntity.cluster_label})
              </h4>
              {clusterSolutions && clusterSolutions.length > 0 ? (
                <div className="grid gap-4">
                  {clusterSolutions.map(solution => (
                    <div key={solution.id}
                         className="bg-gray-50 p-4 rounded-lg border border-gray-200 hover:border-purple-300 hover:shadow-md transition-all cursor-pointer"
                         onClick={() => navigateToEntity(solution, 'solution')}>
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <h5 className="font-medium text-gray-900 mb-2">{solution.title}</h5>
                          <p className="text-sm text-gray-600 line-clamp-2">{solution.description}</p>
                        </div>
                        <div className="ml-4 text-right">
                          {solution.overall_viability && (
                            <div className={`text-lg font-bold ${
                              solution.overall_viability >= 80 ? 'text-green-600' :
                              solution.overall_viability >= 60 ? 'text-yellow-600' :
                              'text-red-600'
                            }`}>
                              {solution.overall_viability}%
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 italic">No cluster solutions found</p>
              )}
            </div>
          )}
        </div>
      );
    } else if (currentType === 'solution') {
      return (
        <div className="space-y-6">
          {/* Direct Problems */}
          <div>
            <h4 className="font-semibold text-gray-700 mb-4">Directly Linked Problems</h4>
            {directProblems && directProblems.length > 0 ? (
              <div className="grid gap-4">
                {directProblems.map(problem => (
                  <div key={problem.id} 
                       className="bg-white p-4 rounded-lg border border-gray-200 hover:border-blue-300 hover:shadow-md transition-all cursor-pointer"
                       onClick={() => navigateToEntity(problem, 'problem')}>
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <h5 className="font-medium text-gray-900 mb-2">{problem.title}</h5>
                        <p className="text-sm text-gray-600 line-clamp-2">{problem.description}</p>
                        {problem.source_url && (
                          <a 
                            href={problem.source_url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 mt-2 text-xs text-blue-600 hover:text-blue-800 hover:underline"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                            </svg>
                            View Source
                          </a>
                        )}
                      </div>
                      <div className="ml-4 text-right">
                        {problem.impact && (
                          <div className={`text-sm font-medium px-2 py-1 rounded ${
                            problem.impact === 'high' ? 'bg-red-100 text-red-700' :
                            problem.impact === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                            'bg-green-100 text-green-700'
                          }`}>
                            {problem.impact} impact
                          </div>
                        )}
                      </div>
                    </div>
                    {(problem.industry || problem.business_size) && (
                      <div className="flex gap-2 mt-2 text-xs text-gray-500">
                        {problem.industry && <span>🏢 {problem.industry}</span>}
                        {problem.business_size && <span>📏 {problem.business_size}</span>}
                      </div>
                    )}
                    <div className="flex gap-2 mt-3">
                      <span className="text-xs px-2 py-1 bg-gray-100 rounded">
                        Click to explore →
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 italic">No directly linked problems</p>
            )}
          </div>

          {/* Cluster Problems */}
          {currentEntity.source_cluster_id && (
            <div>
              <h4 className="font-semibold text-gray-700 mb-4">
                Problems from Cluster {currentEntity.source_cluster_label && `(${currentEntity.source_cluster_label})`}
              </h4>
              {clusterProblems && clusterProblems.length > 0 ? (
                <div className="grid gap-4">
                  {clusterProblems.map(problem => (
                    <div key={problem.id}
                         className="bg-gray-50 p-4 rounded-lg border border-gray-200 hover:border-purple-300 hover:shadow-md transition-all cursor-pointer"
                         onClick={() => navigateToEntity(problem, 'problem')}>
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <h5 className="font-medium text-gray-900 mb-2">{problem.title}</h5>
                          <p className="text-sm text-gray-600 line-clamp-2">{problem.description}</p>
                          {problem.source_url && (
                            <a 
                              href={problem.source_url} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 mt-2 text-xs text-blue-600 hover:text-blue-800 hover:underline"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                              </svg>
                              View Source
                            </a>
                          )}
                        </div>
                        <div className="ml-4 text-right">
                          {problem.impact && (
                            <div className={`text-sm font-medium px-2 py-1 rounded ${
                              problem.impact === 'high' ? 'bg-red-100 text-red-700' :
                              problem.impact === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                              'bg-green-100 text-green-700'
                            }`}>
                              {problem.impact}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 italic">No cluster problems found</p>
              )}
            </div>
          )}
        </div>
      );
    }
    return <div className="text-gray-500">No relationships to display</div>;
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen p-4">
        {/* Backdrop */}
        <div className="fixed inset-0 bg-black bg-opacity-50 transition-opacity" onClick={onClose}></div>

        {/* Modal */}
        <div className="relative bg-white rounded-xl shadow-2xl max-w-7xl w-full max-h-[95vh] overflow-hidden">
          {/* Header */}
          <div className="bg-gray-50 border-b px-6 py-4">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-4">
                {navigationHistory.length > 1 && (
                  <button
                    onClick={goBack}
                    className="p-2 hover:bg-gray-200 rounded-lg transition-colors text-gray-600"
                    title="Go back"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>
                )}
                <div>
                  <h2 className="text-xl font-bold text-gray-800">Study Mode</h2>
                  <p className="text-sm text-gray-600 mt-0.5">
                    {currentType === 'problem' ? 'Problem Analysis' : 
                     currentType === 'solution' ? 'Solution Analysis' : 
                     currentType === 'cluster' ? 'Cluster Analysis' :
                     currentType === 'solutionCluster' ? 'Solution Cluster Analysis' : 'Analysis'}
                  </p>
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

          {/* Breadcrumbs */}
          <div className="px-6 pt-4">
            {renderBreadcrumbs()}
          </div>

          {/* Tabs */}
          <div className="border-b border-gray-200 px-6">
            <nav className="flex gap-6">
              <button
                onClick={() => setActiveTab('overview')}
                className={`py-3 border-b-2 transition-colors ${
                  activeTab === 'overview'
                    ? 'border-blue-600 text-blue-600 font-medium'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                Overview
              </button>
              <button
                onClick={() => setActiveTab('relationships')}
                className={`py-3 border-b-2 transition-colors ${
                  activeTab === 'relationships'
                    ? 'border-blue-600 text-blue-600 font-medium'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                Relationships
              </button>
            </nav>
          </div>

          {/* Content */}
          <div className="px-8 py-6 overflow-y-auto" style={{ maxHeight: 'calc(95vh - 180px)' }}>
            {activeTab === 'overview' && renderOverviewTab()}
            {activeTab === 'relationships' && renderRelationshipsTab()}
          </div>
        </div>
      </div>
    </div>
  );
}

export default StudyModeModal;