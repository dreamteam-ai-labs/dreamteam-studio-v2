import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getProjects, getSolutions, getProblemsBySolution, getProblemsByCluster } from '../services/api';

// Project row component with full journey view
function ProjectRow({ project, solution }) {
  const [isExpanded, setIsExpanded] = useState(false);
  
  // Fetch problems directly linked to solution
  const { data: directProblems } = useQuery({
    queryKey: ['project-solution-problems', solution?.id],
    queryFn: () => getProblemsBySolution(solution?.id),
    enabled: isExpanded && !!solution?.id,
  });
  
  // Fetch problems from the cluster
  const { data: clusterProblems } = useQuery({
    queryKey: ['project-cluster-problems', solution?.source_cluster_id],
    queryFn: () => getProblemsByCluster(solution?.source_cluster_id),
    enabled: isExpanded && !!solution?.source_cluster_id,
  });

  return (
    <>
      <tr className="hover:bg-gray-50">
        <td className="px-4 py-3">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-left w-full"
          >
            <div className="flex items-start gap-2">
              <span className="text-gray-400 mt-0.5">
                {isExpanded ? '▼' : '▶'}
              </span>
              <div>
                <p className="text-sm font-medium text-gray-900">
                  {project.name || project.solution_title || 'Unnamed Project'}
                </p>
                <div className="flex gap-2 mt-1">
                  {project.github_repo_url && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-900 text-white">
                      <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                      </svg>
                      GitHub
                    </span>
                  )}
                  {project.linear_project_id && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800">
                      📋 Linear
                    </span>
                  )}
                  {solution?.source_cluster_label && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                      📊 {solution.source_cluster_label}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </button>
        </td>
        <td className="px-4 py-3">
          {project.github_repo_url ? (
            <a
              href={project.github_repo_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-primary-600 hover:text-primary-700 font-medium inline-flex items-center gap-1"
            >
              Open Repository
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
          ) : (
            <span className="text-sm text-gray-400">No repo yet</span>
          )}
        </td>
        <td className="px-4 py-3">
          {project.linear_project_id ? (
            <a
              href={`https://linear.app/dreamteam-ai-labs/project/${project.linear_project_id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-primary-600 hover:text-primary-700 font-medium inline-flex items-center gap-1"
            >
              View Project
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
          ) : (
            <span className="text-sm text-gray-400">No Linear project</span>
          )}
        </td>
        <td className="px-4 py-3">
          {project.overall_viability ? (
            <div className="flex items-center gap-2">
              <div className={`text-sm font-bold ${
                project.overall_viability >= 80 ? 'text-green-600' :
                project.overall_viability >= 60 ? 'text-yellow-600' :
                'text-red-600'
              }`}>
                {project.overall_viability}%
              </div>
              <div className="w-16 bg-gray-200 rounded-full h-1.5">
                <div 
                  className={`h-1.5 rounded-full ${
                    project.overall_viability >= 80 ? 'bg-green-500' :
                    project.overall_viability >= 60 ? 'bg-yellow-500' :
                    'bg-red-500'
                  }`}
                  style={{width: `${project.overall_viability}%`}}
                />
              </div>
            </div>
          ) : (
            <span className="text-sm text-gray-400">-</span>
          )}
        </td>
        <td className="px-4 py-3">
          <span className={`inline-flex px-2 py-1 text-xs rounded-full ${
            project.status === 'active' ? 'bg-green-100 text-green-800' :
            project.status === 'development' ? 'bg-blue-100 text-blue-800' :
            project.status === 'maintenance' ? 'bg-yellow-100 text-yellow-800' :
            project.status === 'archived' ? 'bg-gray-100 text-gray-800' :
            'bg-purple-100 text-purple-800'
          }`}>
            {project.status || 'launched'}
          </span>
        </td>
        <td className="px-4 py-3 text-sm text-gray-500">
          {new Date(project.created_at).toLocaleDateString()}
        </td>
      </tr>
      
      {/* Expanded Details with Full Journey */}
      {isExpanded && (
        <tr>
          <td colSpan={6} className="px-6 py-0">
            <div className="bg-gradient-to-r from-green-50 to-emerald-50 p-4 mb-4 rounded">
              <div className="space-y-4">
                {/* Solution Details */}
                <div>
                  <h4 className="text-sm font-semibold text-gray-700 mb-2">Solution Details</h4>
                  <div className="bg-white p-3 rounded border border-gray-200">
                    <div className="text-sm font-medium text-gray-900">{solution?.title || project.solution_title}</div>
                    {solution?.value_proposition && (
                      <p className="text-xs text-gray-600 mt-1">{solution.value_proposition}</p>
                    )}
                    <div className="grid grid-cols-3 gap-4 mt-3 text-xs">
                      <div>
                        <span className="text-gray-500">Tech Stack:</span>
                        <span className="ml-1 text-gray-700">{solution?.tech_stack || 'Not specified'}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">MVP Timeline:</span>
                        <span className="ml-1 text-gray-700">{solution?.mvp_timeline || 'Not specified'}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Revenue Potential:</span>
                        <span className="ml-1 text-gray-700">
                          {solution?.recurring_revenue_potential ? 
                            `£${(solution.recurring_revenue_potential / 1000000).toFixed(1)}M` : 
                            'Not specified'
                          }
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* Complete Journey View - Side by Side */}
                <div>
                  <h4 className="text-sm font-semibold text-gray-700 mb-3">Complete Product Journey</h4>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Left: Cluster & Cluster Problems */}
                    <div>
                      <div className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                        📊 Source Cluster
                      </div>
                      {solution?.source_cluster_label ? (
                        <>
                          <div className="bg-white p-2 rounded border border-purple-200 mb-2">
                            <span className="text-sm font-medium text-gray-900">{solution.source_cluster_label}</span>
                          </div>
                          <div className="text-xs font-medium text-gray-600 mb-2 ml-1">
                            Problems in this cluster ({clusterProblems?.length || 0}):
                          </div>
                          <div className="space-y-2 max-h-64 overflow-y-auto">
                            {clusterProblems?.map((problem) => (
                              <div key={problem.id} className="bg-white p-2 rounded border border-gray-200 text-xs">
                                <div className="font-medium text-gray-900">{problem.title}</div>
                                <div className="text-gray-500 mt-1 line-clamp-1">{problem.description}</div>
                                {problem.impact && (
                                  <span className={`inline-flex mt-1 px-1.5 py-0.5 text-xs rounded ${
                                    problem.impact === 'high' ? 'bg-red-100 text-red-700' :
                                    problem.impact === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                                    'bg-green-100 text-green-700'
                                  }`}>
                                    {problem.impact}
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                        </>
                      ) : (
                        <div className="text-sm text-gray-500 italic">No source cluster</div>
                      )}
                    </div>
                    
                    {/* Right: Directly Addressed Problems */}
                    <div>
                      <div className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                        🎯 Directly Addressed Problems
                      </div>
                      {directProblems?.length > 0 ? (
                        <div className="space-y-2 max-h-64 overflow-y-auto">
                          {directProblems.map((problem) => (
                            <div key={problem.id} className="bg-white p-2 rounded border border-blue-200 text-xs">
                              <div className="font-medium text-gray-900">{problem.title}</div>
                              <div className="text-gray-500 mt-1 line-clamp-1">{problem.description}</div>
                              {problem.impact && (
                                <span className={`inline-flex mt-1 px-1.5 py-0.5 text-xs rounded ${
                                  problem.impact === 'high' ? 'bg-red-100 text-red-700' :
                                  problem.impact === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                                  'bg-green-100 text-green-700'
                                }`}>
                                  {problem.impact}
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-sm text-gray-500 italic">No directly mapped problems</div>
                      )}
                    </div>
                  </div>
                </div>
                
                {/* Quick Links */}
                <div>
                  <h4 className="text-sm font-semibold text-gray-700 mb-2">Quick Links</h4>
                  <div className="flex gap-3">
                    {project.github_repo_url && (
                      <a
                        href={project.github_repo_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-md hover:bg-gray-800 transition-colors text-sm font-medium"
                      >
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                        </svg>
                        Open GitHub Repository
                      </a>
                    )}
                    {project.linear_project_id && (
                      <a
                        href={`https://linear.app/dreamteam-ai-labs/project/${project.linear_project_id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors text-sm font-medium"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                        </svg>
                        View Linear Project
                      </a>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function ProjectsTable() {
  // Fetch projects
  const { data: projects, isLoading: projectsLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: getProjects,
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Fetch all solutions to get more details
  const { data: solutions } = useQuery({
    queryKey: ['all-solutions'],
    queryFn: () => getSolutions({}),
  });

  if (projectsLoading) {
    return <div className="text-center py-4">Loading projects...</div>;
  }

  // Get solution details for each project
  const projectsWithDetails = projects?.map(project => {
    const solution = solutions?.find(s => s.id === project.solution_id);
    return {
      ...project,
      solution_details: solution
    };
  });

  return (
    <div>
      {/* Header */}
      <div className="bg-white p-4 rounded-lg shadow mb-4">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-lg font-semibold">
              Products Launched ({projects?.length || 0})
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              Successfully launched products from the DreamTeam pipeline
            </p>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                Product Name
              </th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                GitHub Repository
              </th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                Linear Project
              </th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                Viability Score
              </th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                Status
              </th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                Created
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {projectsWithDetails?.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                  <div className="flex flex-col items-center">
                    <span className="text-4xl mb-2">🚀</span>
                    <p className="text-lg font-medium">No products launched yet</p>
                    <p className="text-sm mt-1">Products will appear here once solutions are converted to projects</p>
                  </div>
                </td>
              </tr>
            ) : (
              projectsWithDetails?.map((project) => (
                <ProjectRow 
                  key={project.id} 
                  project={project} 
                  solution={project.solution_details}
                />
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default ProjectsTable;