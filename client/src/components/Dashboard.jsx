import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { getPipelineStats, getProblems, getClusters, getSolutions, getBestSolutionCandidate } from '../services/api';
import { usePinnedEntities } from '../hooks/usePinnedEntities';

function Dashboard() {
  const navigate = useNavigate();
  const [pinnedProblems, setPinnedProblems] = useState([]);
  const [pinnedSolutions, setPinnedSolutions] = useState([]);
  
  // Initialize pinning hooks
  const problemPins = usePinnedEntities('pinned-problems');
  const solutionPins = usePinnedEntities('pinned-solutions');
  
  // Fetch pipeline statistics
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['pipelineStats'],
    queryFn: getPipelineStats,
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Fetch best solution candidate
  const { data: bestCandidate } = useQuery({
    queryKey: ['bestSolutionCandidate'],
    queryFn: getBestSolutionCandidate,
    refetchInterval: 60000, // Refresh every minute
  });

  // Fetch data for insights and pinned entities
  const { data: problems } = useQuery({
    queryKey: ['problemsOverview'],
    queryFn: () => getProblems({ limit: 500 }),
  });

  const { data: clusters } = useQuery({
    queryKey: ['clustersOverview'],
    queryFn: () => getClusters({ limit: 100 }),
  });

  const { data: solutions } = useQuery({
    queryKey: ['solutionsOverview'],
    queryFn: () => getSolutions({ limit: 500 }),
  });

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
      <div>
        <h1 className="text-3xl font-bold text-gray-900">DreamTeam Studio V2</h1>
        <p className="mt-2 text-gray-600">Transform problems into software solutions</p>
      </div>

      {/* Best Solution Candidate Alert */}
      {bestCandidate && (
        <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg shadow-sm p-6">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <h3 className="text-lg font-semibold text-gray-900">🎯 Best Solution Candidate for Project Birth</h3>
              </div>
              <div className="space-y-2">
                <p className="text-gray-800 font-medium text-lg">{bestCandidate.solution_name || bestCandidate.title}</p>
                <div className="flex items-center gap-6 text-sm text-gray-600">
                  <span>Selection Score: <span className="font-semibold text-green-700">{bestCandidate.selection_score}/100</span></span>
                  <span>Viability: <span className="font-semibold">{bestCandidate.overall_viability}%</span></span>
                  <span>LTV/CAC: <span className="font-semibold">{bestCandidate.ltv_cac_ratio}x</span></span>
                  <span>Problems: <span className="font-semibold">{bestCandidate.problem_count}</span></span>
                </div>
                <p className="text-gray-600 text-sm mt-2">{bestCandidate.description}</p>
              </div>
            </div>
            <div className="ml-4 flex flex-col gap-2">
              <button
                onClick={() => navigate('/solutions')}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium"
              >
                View Solution
              </button>
              <button
                onClick={() => navigate('/graph')}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
              >
                Explore Graph
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Key Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Problem Pipeline"
          metric={totalProblems}
          label="Total Problems"
          submetric={`${unclusteredCount} unclustered`}
          color="blue"
          onClick={() => navigate('/problems')}
          trend={unclusteredCount > 0 ? 'action' : 'good'}
        />
        <MetricCard
          title="Cluster Health"
          metric={stats?.total_clusters || 0}
          label="Active Clusters"
          submetric={`${clustersWithoutSolutions} need solutions`}
          color="purple"
          onClick={() => navigate('/clusters')}
          trend={clustersWithoutSolutions > 0 ? 'action' : 'good'}
        />
        <MetricCard
          title="Solution Quality"
          metric={highViabilitySolutions}
          label="High Viability"
          submetric={`of ${stats?.total_solutions || 0} total`}
          color="green"
          onClick={() => navigate('/solutions')}
          trend="good"
        />
        <MetricCard
          title="Active Projects"
          metric={stats?.active_projects || 0}
          label="In Development"
          submetric={`${solutionsWithProjects} total created`}
          color="yellow"
          onClick={() => navigate('/projects')}
          trend="neutral"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
      </div>

      {/* Pipeline Health */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Pipeline Health Status</h2>
        <p className="text-sm text-gray-600 mb-4">Current state of your problem-to-solution pipeline</p>
        <div className="space-y-4">
          <ProgressBar
            label="Problem Coverage"
            value={totalProblems > 0 ? ((totalProblems - unclusteredCount) / totalProblems) * 100 : 0}
            color="blue"
            info={`${totalProblems - unclusteredCount} of ${totalProblems} problems clustered`}
          />
          <ProgressBar
            label="Cluster Utilization"
            value={stats?.total_clusters > 0 ? ((stats.total_clusters - clustersWithoutSolutions) / stats.total_clusters) * 100 : 0}
            color="purple"
            info={`${stats?.total_clusters - clustersWithoutSolutions} of ${stats?.total_clusters} clusters have solutions`}
          />
          <ProgressBar
            label="Solution Quality"
            value={stats?.total_solutions > 0 ? (highViabilitySolutions / stats.total_solutions) * 100 : 0}
            color="green"
            info={`${highViabilitySolutions} of ${stats?.total_solutions} solutions are high viability (≥80%)`}
          />
          <ProgressBar
            label="Project Conversion"
            value={highViabilitySolutions > 0 ? (solutionsWithProjects / highViabilitySolutions) * 100 : 0}
            color="yellow"
            info={`${solutionsWithProjects} of ${highViabilitySolutions} high-viability solutions have projects`}
          />
        </div>
      </div>
    </div>
  );
}

function MetricCard({ title, metric, label, submetric, color, onClick, trend }) {
  const colorClasses = {
    blue: 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100',
    purple: 'bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100',
    green: 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100',
    yellow: 'bg-yellow-50 text-yellow-700 border-yellow-200 hover:bg-yellow-100',
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
        <div className="text-3xl font-bold">{metric}</div>
        <div className="text-sm font-medium opacity-80">{label}</div>
        <div className="text-xs opacity-70">{submetric}</div>
      </div>
    </div>
  );
}

function ProgressBar({ label, value, color, info }) {
  const colorClasses = {
    blue: 'bg-blue-500',
    purple: 'bg-purple-500',
    green: 'bg-green-500',
    yellow: 'bg-yellow-500',
  };

  return (
    <div>
      <div className="flex justify-between mb-1">
        <span className="text-sm font-medium text-gray-700">{label}</span>
        <span className="text-sm text-gray-600">{Math.round(value)}%</span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div
          className={`${colorClasses[color]} h-2 rounded-full transition-all duration-500`}
          style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
        />
      </div>
      <div className="text-xs text-gray-500 mt-1">{info}</div>
    </div>
  );
}

export default Dashboard;