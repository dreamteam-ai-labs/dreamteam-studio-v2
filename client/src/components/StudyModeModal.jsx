import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getProblems, getSolutions, getSolutionsByProblem, getSolutionsByCluster, getProblemsBySolution, getProblemsByCluster } from '../services/api';
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
            {item.type === 'problem' ? '❓' : '💡'} {item.entity.title || item.entity.identifier}
          </button>
        </React.Fragment>
      ))}
    </div>
  );

  const renderOverviewTab = () => {
    if (currentType === 'problem') {
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
    if (currentType === 'problem') {
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
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-6 py-4">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-4">
                {navigationHistory.length > 1 && (
                  <button
                    onClick={goBack}
                    className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                    title="Go back"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>
                )}
                <h2 className="text-xl font-bold">Study Mode</h2>
              </div>
              <button
                onClick={onClose}
                className="p-2 hover:bg-white/20 rounded-lg transition-colors"
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