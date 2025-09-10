import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { getPipelineStats, getProblems, getClusters, getSolutions, getBestSolutionCandidate } from '../services/api';
import { usePinnedEntities } from '../hooks/usePinnedEntities';
import { ExternalLink } from 'lucide-react';
import StudyModeModal from './StudyModeModal';
import BestCandidateExplainer from './BestCandidateExplainer';
import { formatNumber } from '../utils/numberUtils';

function Dashboard() {
  const navigate = useNavigate();
  const [pinnedProblems, setPinnedProblems] = useState([]);
  const [pinnedSolutions, setPinnedSolutions] = useState([]);
  const [studyModeEntity, setStudyModeEntity] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // Initialize pinning hooks
  const problemPins = usePinnedEntities('pinned-problems');
  const solutionPins = usePinnedEntities('pinned-solutions');
  
  // Fetch pipeline statistics
  const { data: stats, isLoading: statsLoading, refetch: refetchStats } = useQuery({
    queryKey: ['pipelineStats'],
    queryFn: getPipelineStats,
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Fetch best solution candidate
  const { data: bestCandidate, refetch: refetchBestCandidate } = useQuery({
    queryKey: ['bestSolutionCandidate'],
    queryFn: getBestSolutionCandidate,
    refetchInterval: 60000, // Refresh every minute
  });

  // Fetch data for insights and pinned entities
  const { data: problems, refetch: refetchProblems } = useQuery({
    queryKey: ['problemsOverview'],
    queryFn: () => getProblems({ limit: 500 }),
  });

  const { data: clusters, refetch: refetchClusters } = useQuery({
    queryKey: ['clustersOverview'],
    queryFn: () => getClusters({ limit: 100 }),
  });

  const { data: solutions, refetch: refetchSolutions } = useQuery({
    queryKey: ['solutionsOverview'],
    queryFn: () => getSolutions({ limit: 500 }),
  });

  // Handle refresh all data
  const handleRefreshAll = async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([
        refetchStats(),
        refetchBestCandidate(),
        refetchProblems(),
        refetchClusters(),
        refetchSolutions()
      ]);
    } finally {
      setTimeout(() => setIsRefreshing(false), 500); // Keep spinning for at least 500ms
    }
  };

  // Update pinned entities when data changes
  useEffect(() => {
    if (problems) {
      const pinned = problems.filter(p => problemPins.isPinned(p.id)).slice(0, 3);
      setPinnedProblems(pinned);
    }
  }, [problems, problemPins.pinnedIds]);

  useEffect(() => {
    if (solutions) {
      const pinned = solutions.filter(s => solutionPins.isPinned(s.id)).slice(0, 3);
      setPinnedSolutions(pinned);
    }
  }, [solutions, solutionPins.pinnedIds]);

  if (statsLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading dashboard...</div>
      </div>
    );
  }

  // Calculate insights
  const unclusteredCount = stats?.unclustered_problems || 0;
  const totalProblems = stats?.total_problems || 0;
  const clustersWithoutSolutions = clusters?.filter(c => c.solution_count === 0).length || 0;
  const highViabilitySolutions = solutions?.filter(s => s.overall_viability >= 80).length || 0;
  const solutionsWithProjects = solutions?.filter(s => s.linear_project_id).length || 0;
  
  // Get recent entities (last 5 created)
  const recentProblems = problems?.slice(0, 5) || [];
  const recentSolutions = solutions?.slice(0, 5) || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">DreamTeam Studio V2</h1>
        <button
          onClick={handleRefreshAll}
          disabled={isRefreshing}
          className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
          title="Refresh all data"
        >
          <svg 
            className={`w-5 h-5 ${isRefreshing ? 'animate-spin' : ''}`} 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          {isRefreshing ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>
      <div>
        <p className="mt-2 text-gray-600">Transform problems into software solutions</p>
      </div>

      {/* Best Solution Candidate with Explainer */}
      {bestCandidate && (
        <div className="space-y-4">
          <BestCandidateExplainer solution={bestCandidate} />
          
          {/* Solution Details Card */}
          <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-6">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="space-y-2">
                  <p className="text-gray-800 font-medium text-lg">{bestCandidate.solution_name || bestCandidate.title}</p>
                  <p className="text-gray-600 text-sm">{bestCandidate.description}</p>
                  {bestCandidate.value_proposition && (
                    <div className="mt-3 p-3 bg-blue-50 rounded-lg">
                      <p className="text-sm font-medium text-blue-900">Value Proposition:</p>
                      <p className="text-sm text-blue-700 mt-1">{bestCandidate.value_proposition}</p>
                    </div>
                  )}
                </div>
              </div>
              <div className="ml-4 flex flex-col gap-2">
                <button
                  onClick={() => {
                    console.log('Opening study mode for best candidate:', bestCandidate);
                    setStudyModeEntity({ type: 'solution', data: bestCandidate });
                  }}
                  className="p-2 rounded-lg transition-all transform hover:scale-110 text-purple-500 hover:text-purple-700 hover:bg-purple-100"
                  title="Study this solution"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/>
                  </svg>
                </button>
                <button
                  onClick={() => navigate('/solutions')}
                  className="p-2 rounded-lg transition-all text-gray-500 hover:text-gray-700 hover:bg-gray-100"
                  title="View all solutions"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Key Metrics Grid with Integrated Pipeline Health */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Problem Pipeline"
          metric={totalProblems}
          label="Total Problems"
          submetric={`${unclusteredCount} unclustered`}
          color="blue"
          onClick={() => navigate('/problems')}
          trend={unclusteredCount > 0 ? 'action' : 'good'}
          progress={totalProblems > 0 ? ((totalProblems - unclusteredCount) / totalProblems) * 100 : 0}
          progressLabel="Coverage"
        />
        <MetricCard
          title="Cluster Health"
          metric={stats?.total_clusters || 0}
          label="Active Clusters"
          submetric={`${clustersWithoutSolutions} need solutions`}
          color="purple"
          onClick={() => navigate('/problems', { state: { viewMode: 'cluster' } })}
          trend={clustersWithoutSolutions > 0 ? 'action' : 'good'}
          progress={stats?.total_clusters > 0 ? ((stats.total_clusters - clustersWithoutSolutions) / stats.total_clusters) * 100 : 0}
          progressLabel="Utilization"
        />
        <MetricCard
          title="Solution Quality"
          metric={highViabilitySolutions}
          label="High Viability"
          submetric={`of ${stats?.total_solutions || 0} total`}
          color="green"
          onClick={() => navigate('/solutions')}
          trend="good"
          progress={stats?.total_solutions > 0 ? (highViabilitySolutions / stats.total_solutions) * 100 : 0}
          progressLabel="Quality"
        />
        <MetricCard
          title="Active Projects"
          metric={stats?.active_projects || 0}
          label="In Development"
          submetric={`${solutionsWithProjects} total created`}
          color="yellow"
          onClick={() => navigate('/projects')}
          trend="neutral"
          progress={highViabilitySolutions > 0 ? (solutionsWithProjects / highViabilitySolutions) * 100 : 0}
          progressLabel="Conversion"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Pinned & Recent Problems */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">📌 Problems Focus</h2>
            <button
              onClick={() => navigate('/problems')}
              className="text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              View All →
            </button>
          </div>
          
          {pinnedProblems.length > 0 && (
            <div className="mb-3">
              <h3 className="text-sm font-medium text-gray-500 mb-2">Pinned Problems</h3>
              <div className="space-y-2">
                {pinnedProblems.map(problem => (
                  <div
                    key={problem.id}
                    className="p-3 bg-blue-50 rounded-lg cursor-pointer hover:bg-blue-100 transition-colors"
                    onClick={() => navigate('/problems')}
                  >
                    <div className="font-medium text-gray-900 line-clamp-3">{problem.problem_statement || problem.title}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {pinnedProblems.length > 0 && (
            <div className="border-t pt-3 mt-3"></div>
          )}
          
          <h3 className="text-sm font-medium text-gray-500 mb-2">
            {pinnedProblems.length > 0 ? 'Recent Problems' : 'Recent Problems'}
          </h3>
          <div className="space-y-2">
            {recentProblems.map(problem => (
              <div
                key={problem.id}
                className="p-3 bg-gray-50 rounded-lg hover:bg-gray-100 cursor-pointer transition-colors border border-gray-200"
                onClick={() => navigate('/problems')}
              >
                <div className="text-sm text-gray-700 line-clamp-2">
                  {problem.problem_statement || problem.title}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Pinned & Recent Solutions */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">💡 Solutions Focus</h2>
            <button
              onClick={() => navigate('/solutions')}
              className="text-sm text-green-600 hover:text-green-700 font-medium"
            >
              View All →
            </button>
          </div>
          
          {pinnedSolutions.length > 0 && (
            <div className="mb-3">
              <h3 className="text-sm font-medium text-gray-500 mb-2">Pinned Solutions</h3>
              <div className="space-y-2">
                {pinnedSolutions.map(solution => (
                  <div
                    key={solution.id}
                    className="p-3 bg-green-50 rounded-lg cursor-pointer hover:bg-green-100 transition-colors"
                    onClick={() => navigate('/solutions')}
                  >
                    <div className="font-medium text-gray-900 line-clamp-3">{solution.solution_name || solution.title}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {pinnedSolutions.length > 0 && (
            <div className="border-t pt-3 mt-3"></div>
          )}
          
          <h3 className="text-sm font-medium text-gray-500 mb-2">
            {pinnedSolutions.length > 0 ? 'Recent Solutions' : 'Recent Solutions'}
          </h3>
          <div className="space-y-2">
            {recentSolutions.map(solution => (
              <div
                key={solution.id}
                className="p-3 bg-gray-50 rounded-lg hover:bg-gray-100 cursor-pointer transition-colors border border-gray-200"
                onClick={() => navigate('/solutions')}
              >
                <div className="text-sm text-gray-700 line-clamp-2">
                  {solution.solution_name || solution.title}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* API Provider Billing Links */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">💳 API Billing</h2>
          </div>
          <div className="space-y-2">
            <BillingLink 
              name="OpenAI" 
              url="https://platform.openai.com/settings/organization/billing/overview" 
              color="green"
              description="GPT Models"
            />
            <BillingLink 
              name="Anthropic" 
              url="https://console.anthropic.com/settings/billing" 
              color="purple"
              description="Claude API"
            />
            <BillingLink 
              name="Perplexity" 
              url="https://www.perplexity.ai/account/api/billing" 
              color="blue"
              description="Search API"
            />
            <BillingLink 
              name="Neon" 
              url="https://console.neon.tech/app/billing" 
              color="orange"
              description="PostgreSQL"
            />
            <BillingLink 
              name="Render" 
              url="https://dashboard.render.com/billing" 
              color="pink"
              description="App Hosting"
            />
            <BillingLink 
              name="Linear" 
              url="https://linear.app/settings/billing" 
              color="indigo"
              description="Project Mgmt"
            />
          </div>
        </div>
      </div>
      
      {/* Study Mode Modal */}
      {studyModeEntity && (
        <StudyModeModal
          isOpen={!!studyModeEntity}
          entityType={studyModeEntity.type}
          initialEntity={studyModeEntity.data}
          onClose={() => setStudyModeEntity(null)}
        />
      )}
    </div>
  );
}

function MetricCard({ title, metric, label, submetric, color, onClick, trend, progress, progressLabel }) {
  const colorClasses = {
    blue: 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100',
    purple: 'bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100',
    green: 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100',
    yellow: 'bg-yellow-50 text-yellow-700 border-yellow-200 hover:bg-yellow-100',
  };

  const progressBarClasses = {
    blue: 'bg-blue-500',
    purple: 'bg-purple-500',
    green: 'bg-green-500',
    yellow: 'bg-yellow-500',
  };

  const trendIcons = {
    good: '✅',
    action: '⚠️',
    neutral: '➡️'
  };

  return (
    <div
      className={`${colorClasses[color]} border rounded-lg p-4 cursor-pointer transition-all transform hover:scale-105`}
      onClick={onClick}
    >
      <div className="flex items-start justify-between mb-2">
        <h3 className="text-sm font-medium opacity-90">{title}</h3>
        <span className="text-lg">{trendIcons[trend]}</span>
      </div>
      <div className="space-y-1">
        <div className="text-3xl font-bold">{typeof metric === 'number' ? formatNumber(metric) : metric}</div>
        <div className="text-sm font-medium opacity-80">{label}</div>
        <div className="text-xs opacity-70">{submetric}</div>
        
        {/* Mini Progress Bar */}
        {progress !== undefined && (
          <div className="mt-2 pt-2 border-t border-opacity-30">
            <div className="flex justify-between items-center mb-1">
              <span className="text-xs font-medium opacity-80">{progressLabel}</span>
              <span className="text-xs opacity-70">{Math.round(progress)}%</span>
            </div>
            <div className="w-full bg-white bg-opacity-50 rounded-full h-1.5">
              <div
                className={`${progressBarClasses[color]} h-1.5 rounded-full transition-all duration-500`}
                style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function BillingLink({ name, url, color, description }) {
  const colorClasses = {
    green: 'bg-green-500',
    purple: 'bg-purple-500',
    blue: 'bg-blue-500',
    orange: 'bg-orange-500',
    pink: 'bg-pink-500',
    indigo: 'bg-indigo-500',
  };

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex items-center justify-between p-3 bg-gray-50 hover:bg-gray-100 rounded-lg transition-all"
    >
      <div className="flex items-center gap-3">
        <div className={`w-2 h-2 rounded-full ${colorClasses[color]}`} />
        <div>
          <div className="text-sm font-medium text-gray-900 group-hover:text-blue-600">
            {name}
          </div>
          <div className="text-xs text-gray-500">{description}</div>
        </div>
      </div>
      <ExternalLink className="w-4 h-4 text-gray-400 group-hover:text-gray-600" />
    </a>
  );
}

export default Dashboard;