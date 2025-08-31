import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { getPipelineStats, getPipelineStatus, getProblems, getClusters, getSolutions } from '../services/api';

function Dashboard() {
  const navigate = useNavigate();
  
  // Fetch pipeline statistics
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['pipelineStats'],
    queryFn: getPipelineStats,
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Fetch pipeline status
  const { data: status, isLoading: statusLoading } = useQuery({
    queryKey: ['pipelineStatus'],
    queryFn: getPipelineStatus,
    refetchInterval: 10000, // Refresh every 10 seconds
  });

  // Fetch data for insights
  const { data: problems } = useQuery({
    queryKey: ['problemsOverview'],
    queryFn: () => getProblems({ limit: 100 }),
  });

  const { data: clusters } = useQuery({
    queryKey: ['clustersOverview'],
    queryFn: () => getClusters({ limit: 100 }),
  });

  const { data: solutions } = useQuery({
    queryKey: ['solutionsOverview'],
    queryFn: () => getSolutions({ limit: 100 }),
  });

  if (statsLoading || statusLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading pipeline data...</div>
      </div>
    );
  }

  // Calculate insights
  const unclusteredPercentage = stats?.total_problems > 0 
    ? Math.round((stats?.unclustered_problems / stats?.total_problems) * 100)
    : 0;
  
  const clustersWithoutSolutions = clusters?.filter(c => c.solution_count === 0).length || 0;
  const highViabilitySolutions = solutions?.filter(s => s.overall_viability >= 80).length || 0;
  const solutionsWithProjects = solutions?.filter(s => s.linear_project_id).length || 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">DreamTeam Pipeline</h1>
        <p className="mt-2 text-gray-600">Monitor and control your virtual software house</p>
      </div>

      {/* Stats Grid - Clickable */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Problems"
          value={stats?.total_problems || 0}
          subtitle={`${stats?.unclustered_problems || 0} unclustered`}
          color="blue"
          onClick={() => navigate('/problems')}
        />
        <StatCard
          title="Clusters"
          value={stats?.total_clusters || 0}
          subtitle={`${clustersWithoutSolutions} need solutions`}
          color="purple"
          onClick={() => navigate('/clusters')}
        />
        <StatCard
          title="Solutions"
          value={stats?.total_solutions || 0}
          subtitle={`${stats?.active_projects || 0} active projects`}
          color="green"
          onClick={() => navigate('/solutions')}
        />
        <StatCard
          title="Coverage"
          value={`${Math.round((stats?.problems_with_solutions / stats?.total_problems) * 100) || 0}%`}
          subtitle="Problems with solutions"
          color="yellow"
          onClick={() => navigate('/solutions')}
        />
      </div>

      {/* Pipeline Status */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">Pipeline Functions</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <FunctionStatus
            name="F1: Ingestion"
            status={status?.f1?.status || 'idle'}
            lastRun={status?.f1?.last_run}
            description="Capture problems from sources"
          />
          <FunctionStatus
            name="F2: Clustering"
            status={status?.f2?.status || 'idle'}
            lastRun={status?.f2?.last_run}
            description="Group similar problems"
          />
          <FunctionStatus
            name="F3: Solutions"
            status={status?.f3?.status || 'idle'}
            lastRun={status?.f3?.last_run}
            description="Generate solution candidates"
          />
          <FunctionStatus
            name="F4: Birth"
            status={status?.f4?.status || 'idle'}
            lastRun={status?.f4?.last_run}
            description="Create product teams"
          />
        </div>
      </div>

      {/* Action Required Section */}
      <div className="bg-gradient-to-r from-orange-50 to-red-50 rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold text-gray-800 mb-4">⚠️ Action Required</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {unclusteredPercentage > 20 && (
            <ActionItem
              title="High Unclustered Problems"
              description={`${unclusteredPercentage}% of problems need clustering`}
              action="Review Problems"
              onClick={() => navigate('/problems')}
              urgency="high"
            />
          )}
          {clustersWithoutSolutions > 0 && (
            <ActionItem
              title="Clusters Need Solutions"
              description={`${clustersWithoutSolutions} clusters have no solutions`}
              action="Generate Solutions"
              onClick={() => navigate('/clusters')}
              urgency="medium"
            />
          )}
          {highViabilitySolutions > solutionsWithProjects && (
            <ActionItem
              title="Viable Solutions Ready"
              description={`${highViabilitySolutions - solutionsWithProjects} high-viability solutions need projects`}
              action="Create Projects"
              onClick={() => navigate('/solutions')}
              urgency="medium"
            />
          )}
        </div>
        {unclusteredPercentage <= 20 && clustersWithoutSolutions === 0 && highViabilitySolutions <= solutionsWithProjects && (
          <div className="text-sm text-gray-600 italic">
            ✅ No immediate actions required - pipeline is healthy
          </div>
        )}
      </div>

      {/* Pipeline Health Metrics */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">Pipeline Health</h2>
        <div className="space-y-4">
          <HealthMetric
            label="Problem Clustering"
            value={100 - unclusteredPercentage}
            target={80}
            unit="%"
          />
          <HealthMetric
            label="Cluster Coverage"
            value={stats?.total_clusters > 0 ? Math.round(((stats?.total_clusters - clustersWithoutSolutions) / stats?.total_clusters) * 100) : 0}
            target={70}
            unit="%"
          />
          <HealthMetric
            label="Solution Quality"
            value={solutions?.length > 0 ? Math.round((highViabilitySolutions / solutions.length) * 100) : 0}
            target={30}
            unit="%"
          />
          <HealthMetric
            label="Project Conversion"
            value={highViabilitySolutions > 0 ? Math.round((solutionsWithProjects / highViabilitySolutions) * 100) : 0}
            target={50}
            unit="%"
          />
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, subtitle, color, onClick }) {
  const colorClasses = {
    blue: 'bg-blue-50 text-blue-900 hover:bg-blue-100 border-blue-200',
    purple: 'bg-purple-50 text-purple-900 hover:bg-purple-100 border-purple-200',
    green: 'bg-green-50 text-green-900 hover:bg-green-100 border-green-200',
    yellow: 'bg-yellow-50 text-yellow-900 hover:bg-yellow-100 border-yellow-200',
  };

  return (
    <div 
      className={`p-4 rounded-lg border-2 ${colorClasses[color]} cursor-pointer transition-all hover:shadow-lg transform hover:-translate-y-0.5`}
      onClick={onClick}
    >
      <div className="text-sm font-medium opacity-75">{title}</div>
      <div className="text-3xl font-bold mt-2">{value}</div>
      <div className="text-xs mt-1 opacity-75">{subtitle}</div>
    </div>
  );
}

function FunctionStatus({ name, status, lastRun, description }) {
  const statusColors = {
    idle: 'bg-gray-200',
    running: 'bg-yellow-400 animate-pulse',
    success: 'bg-green-400',
    error: 'bg-red-400',
    unavailable: 'bg-gray-300',
  };

  return (
    <div className="border rounded-lg p-4 hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between mb-2">
        <span className="font-medium text-sm">{name}</span>
        <div className={`w-3 h-3 rounded-full ${statusColors[status]}`} />
      </div>
      <div className="text-xs text-gray-600 mb-1">{description}</div>
      <div className="text-xs text-gray-500">
        {lastRun ? `Last run: ${new Date(lastRun).toLocaleTimeString()}` : 'Never run'}
      </div>
    </div>
  );
}

function ActionItem({ title, description, action, onClick, urgency }) {
  const urgencyColors = {
    high: 'border-red-300 bg-red-50',
    medium: 'border-orange-300 bg-orange-50',
    low: 'border-yellow-300 bg-yellow-50',
  };

  return (
    <div className={`p-4 rounded-lg border-2 ${urgencyColors[urgency]}`}>
      <h3 className="font-semibold text-gray-800">{title}</h3>
      <p className="text-sm text-gray-600 mt-1">{description}</p>
      <button
        onClick={onClick}
        className="mt-3 px-4 py-2 bg-white text-gray-800 font-medium rounded-md shadow hover:shadow-md transition-shadow text-sm"
      >
        {action} →
      </button>
    </div>
  );
}

function HealthMetric({ label, value, target, unit }) {
  const isHealthy = value >= target;
  const percentage = Math.min(100, value);
  
  return (
    <div className="flex items-center justify-between">
      <div className="flex-1">
        <div className="flex justify-between items-center mb-1">
          <span className="text-sm font-medium text-gray-700">{label}</span>
          <span className={`text-sm font-semibold ${isHealthy ? 'text-green-600' : 'text-orange-600'}`}>
            {value}{unit} {isHealthy ? '✓' : `(target: ${target}${unit})`}
          </span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div 
            className={`h-2 rounded-full transition-all ${
              isHealthy ? 'bg-green-500' : 'bg-orange-500'
            }`}
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>
    </div>
  );
}

export default Dashboard;