import { useCallback, useEffect, useState } from 'react';
import ReactFlow, {
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  MarkerType,
} from 'reactflow';
import { useQuery } from '@tanstack/react-query';
import { getProblems, getClusters, getSolutions, getProjects } from '../services/api';

// Import React Flow styles
import 'reactflow/dist/style.css';

// Custom node component for better styling
import { Handle, Position } from 'reactflow';

function CustomNode({ data }) {
  const getNodeStyle = () => {
    switch (data.type) {
      case 'problem':
        return 'bg-blue-100 border-blue-300 text-blue-900';
      case 'cluster':
        return 'bg-purple-100 border-purple-300 text-purple-900';
      case 'solution':
        return 'bg-green-100 border-green-300 text-green-900';
      case 'project':
        return 'bg-yellow-100 border-yellow-300 text-yellow-900';
      default:
        return 'bg-gray-100 border-gray-300 text-gray-900';
    }
  };

  const getIcon = () => {
    switch (data.type) {
      case 'problem':
        return '⚠️';
      case 'cluster':
        return '📊';
      case 'solution':
        return '💡';
      case 'project':
        return '🚀';
      default:
        return '📄';
    }
  };

  return (
    <div className={`px-4 py-2 shadow-md rounded-md border-2 ${getNodeStyle()}`}>
      <Handle type="target" position={Position.Left} />
      <div className="flex items-center">
        <span className="mr-2 text-lg">{getIcon()}</span>
        <div className="text-sm font-medium max-w-xs">
          {data.label}
          {data.count !== undefined && (
            <span className="ml-2 text-xs opacity-75">({data.count})</span>
          )}
        </div>
      </div>
      <Handle type="source" position={Position.Right} />
    </div>
  );
}

const nodeTypes = {
  custom: CustomNode,
};

function GraphView() {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [viewMode, setViewMode] = useState('all'); // all, flow, hierarchy
  const [selectedEntity, setSelectedEntity] = useState(null);

  // Fetch all data
  const { data: problems, isLoading: problemsLoading } = useQuery({
    queryKey: ['graph-problems'],
    queryFn: () => getProblems({ limit: 200 }),
  });

  const { data: clusters, isLoading: clustersLoading } = useQuery({
    queryKey: ['graph-clusters'],
    queryFn: () => getClusters({ limit: 100 }),
  });

  const { data: solutions, isLoading: solutionsLoading } = useQuery({
    queryKey: ['graph-solutions'],
    queryFn: () => getSolutions({ limit: 100 }),
  });

  const { data: projects, isLoading: projectsLoading } = useQuery({
    queryKey: ['graph-projects'],
    queryFn: getProjects,
  });

  const onConnect = useCallback(
    (params) => setEdges((eds) => addEdge(params, eds)),
    [setEdges],
  );

  // Build the graph when data is loaded
  useEffect(() => {
    if (problemsLoading || clustersLoading || solutionsLoading || projectsLoading) return;

    const newNodes = [];
    const newEdges = [];
    const nodePositions = {};

    // Layout parameters
    const xSpacing = 250;
    const ySpacing = 100;
    const problemsPerRow = 5;
    const clustersPerRow = 4;
    const solutionsPerRow = 3;

    if (viewMode === 'flow' || viewMode === 'all') {
      // Debug: Log first few items to understand structure
      console.log('Sample problem:', problems?.[0]);
      console.log('Sample cluster:', clusters?.[0]);
      
      // Add problem nodes
      problems?.forEach((problem, index) => {
        const row = Math.floor(index / problemsPerRow);
        const col = index % problemsPerRow;
        const nodeId = `problem-${problem.id}`;
        
        newNodes.push({
          id: nodeId,
          type: 'custom',
          position: { x: col * xSpacing, y: row * ySpacing },
          data: { 
            label: problem.title,
            type: 'problem',
            impact: problem.impact,
            entity: problem
          },
        });
        nodePositions[nodeId] = { x: col * xSpacing, y: row * ySpacing };
      });

      // Add cluster nodes
      clusters?.forEach((cluster, index) => {
        const row = Math.floor(index / clustersPerRow);
        const col = index % clustersPerRow;
        const clusterId = cluster.cluster_id || cluster.id;
        const nodeId = `cluster-${clusterId}`;
        const xOffset = xSpacing * (problemsPerRow + 1);
        
        newNodes.push({
          id: nodeId,
          type: 'custom',
          position: { x: xOffset + col * xSpacing, y: row * ySpacing },
          data: { 
            label: cluster.cluster_label || cluster.label,
            type: 'cluster',
            count: cluster.problem_count,
            entity: cluster
          },
        });
        nodePositions[nodeId] = { x: xOffset + col * xSpacing, y: row * ySpacing };
      });

      // Add solution nodes
      solutions?.forEach((solution, index) => {
        const row = Math.floor(index / solutionsPerRow);
        const col = index % solutionsPerRow;
        const nodeId = `solution-${solution.id}`;
        const xOffset = xSpacing * (problemsPerRow + clustersPerRow + 2);
        
        newNodes.push({
          id: nodeId,
          type: 'custom',
          position: { x: xOffset + col * xSpacing, y: row * ySpacing },
          data: { 
            label: solution.title,
            type: 'solution',
            viability: solution.overall_viability,
            entity: solution
          },
        });
        nodePositions[nodeId] = { x: xOffset + col * xSpacing, y: row * ySpacing };
      });

      // Add project nodes
      projects?.forEach((project, index) => {
        const nodeId = `project-${project.id}`;
        const xOffset = xSpacing * (problemsPerRow + clustersPerRow + solutionsPerRow + 3);
        
        newNodes.push({
          id: nodeId,
          type: 'custom',
          position: { x: xOffset, y: index * ySpacing * 2 },
          data: { 
            label: project.name || project.solution_title || 'Unnamed Project',
            type: 'project',
            entity: project
          },
        });
        nodePositions[nodeId] = { x: xOffset, y: index * ySpacing * 2 };
      });

      // Add edges - problem to cluster
      problems?.forEach(problem => {
        if (problem.cluster_id) {
          const problemId = problem.id;
          const clusterId = problem.cluster_id;
          
          // Check if both nodes exist
          const sourceExists = newNodes.some(n => n.id === `problem-${problemId}`);
          const targetExists = newNodes.some(n => n.id === `cluster-${clusterId}`);
          
          if (sourceExists && targetExists) {
            newEdges.push({
              id: `edge-p${problemId}-c${clusterId}`,
              source: `problem-${problemId}`,
              target: `cluster-${clusterId}`,
              type: 'smoothstep',
              animated: false,
              style: { stroke: '#9333ea', strokeWidth: 1 },
              markerEnd: {
                type: MarkerType.ArrowClosed,
                width: 15,
                height: 15,
                color: '#9333ea',
              },
            });
          }
        }
      });

      // Add edges - cluster to solution
      solutions?.forEach(solution => {
        if (solution.source_cluster_id) {
          const solutionId = solution.id;
          const clusterId = solution.source_cluster_id;
          
          const sourceExists = newNodes.some(n => n.id === `cluster-${clusterId}`);
          const targetExists = newNodes.some(n => n.id === `solution-${solutionId}`);
          
          if (sourceExists && targetExists) {
            newEdges.push({
              id: `edge-c${clusterId}-s${solutionId}`,
              source: `cluster-${clusterId}`,
              target: `solution-${solutionId}`,
              type: 'smoothstep',
              animated: false,
              style: { stroke: '#10b981', strokeWidth: 2 },
              markerEnd: {
                type: MarkerType.ArrowClosed,
                width: 15,
                height: 15,
                color: '#10b981',
              },
            });
          }
        }

        // Direct problem to solution edges
        if (solution.problem_ids) {
          const problemIds = typeof solution.problem_ids === 'string' 
            ? solution.problem_ids.replace(/[{}]/g, '').split(',').map(id => id.trim())
            : solution.problem_ids;
          
          problemIds?.forEach(problemId => {
            if (problemId) {
              const sourceExists = newNodes.some(n => n.id === `problem-${problemId}`);
              const targetExists = newNodes.some(n => n.id === `solution-${solution.id}`);
              
              if (sourceExists && targetExists) {
                newEdges.push({
                  id: `edge-p${problemId}-s${solution.id}`,
                  source: `problem-${problemId}`,
                  target: `solution-${solution.id}`,
                  type: 'smoothstep',
                  animated: true,
                  style: { stroke: '#3b82f6', strokeWidth: 1, strokeDasharray: '5,5' },
                  markerEnd: {
                    type: MarkerType.ArrowClosed,
                    width: 15,
                    height: 15,
                    color: '#3b82f6',
                  },
                });
              }
            }
          });
        }
      });

      // Add edges - solution to project
      projects?.forEach(project => {
        if (project.solution_id) {
          const projectId = project.id;
          const solutionId = project.solution_id;
          
          const sourceExists = newNodes.some(n => n.id === `solution-${solutionId}`);
          const targetExists = newNodes.some(n => n.id === `project-${projectId}`);
          
          if (sourceExists && targetExists) {
            newEdges.push({
              id: `edge-s${solutionId}-p${projectId}`,
              source: `solution-${solutionId}`,
              target: `project-${projectId}`,
              type: 'smoothstep',
              animated: true,
              style: { stroke: '#eab308', strokeWidth: 2 },
              markerEnd: {
                type: MarkerType.ArrowClosed,
                width: 15,
                height: 15,
                color: '#eab308',
              },
            });
          }
        }
      });
    }

    setNodes(newNodes);
    setEdges(newEdges);
  }, [problems, clusters, solutions, projects, viewMode, problemsLoading, clustersLoading, solutionsLoading, projectsLoading, setNodes, setEdges]);

  const onNodeClick = useCallback((event, node) => {
    setSelectedEntity(node.data.entity);
  }, []);

  if (problemsLoading || clustersLoading || solutionsLoading || projectsLoading) {
    return (
      <div className="flex items-center justify-center h-[600px]">
        <div className="text-gray-500">Loading graph data...</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-white p-4 rounded-lg shadow">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-lg font-semibold">Pipeline Graph View</h2>
            <p className="text-sm text-gray-600 mt-1">
              Interactive visualization of problems → clusters → solutions → projects
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setViewMode('all')}
              className={`px-3 py-1 rounded text-sm font-medium ${
                viewMode === 'all' 
                  ? 'bg-primary-600 text-white' 
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              All Connections
            </button>
            <button
              onClick={() => setViewMode('flow')}
              className={`px-3 py-1 rounded text-sm font-medium ${
                viewMode === 'flow' 
                  ? 'bg-primary-600 text-white' 
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              Main Flow
            </button>
          </div>
        </div>
      </div>

      {/* Graph Container */}
      <div className="bg-white rounded-lg shadow" style={{ height: '600px' }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeClick={onNodeClick}
          nodeTypes={nodeTypes}
          fitView
          attributionPosition="bottom-left"
        >
          <Background variant="dots" gap={12} size={1} />
          <Controls />
          <MiniMap 
            nodeColor={(node) => {
              switch (node.data?.type) {
                case 'problem': return '#3b82f6';
                case 'cluster': return '#9333ea';
                case 'solution': return '#10b981';
                case 'project': return '#eab308';
                default: return '#6b7280';
              }
            }}
            style={{
              backgroundColor: '#f3f4f6',
              border: '1px solid #d1d5db',
            }}
          />
        </ReactFlow>
      </div>

      {/* Legend */}
      <div className="bg-white p-4 rounded-lg shadow">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Legend</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-blue-100 border-2 border-blue-300 rounded"></div>
            <span className="text-sm text-gray-600">Problems ({problems?.length || 0})</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-purple-100 border-2 border-purple-300 rounded"></div>
            <span className="text-sm text-gray-600">Clusters ({clusters?.length || 0})</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-green-100 border-2 border-green-300 rounded"></div>
            <span className="text-sm text-gray-600">Solutions ({solutions?.length || 0})</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-yellow-100 border-2 border-yellow-300 rounded"></div>
            <span className="text-sm text-gray-600">Projects ({projects?.length || 0})</span>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-3 pt-3 border-t">
          <div className="flex items-center gap-2">
            <div className="w-8 h-0.5 bg-purple-500"></div>
            <span className="text-sm text-gray-600">Problem → Cluster</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-0.5 bg-green-500"></div>
            <span className="text-sm text-gray-600">Cluster → Solution</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-0.5 bg-blue-500" style={{ borderStyle: 'dashed', borderWidth: '1px 0' }}></div>
            <span className="text-sm text-gray-600">Direct Problem → Solution</span>
          </div>
        </div>
      </div>

      {/* Selected Entity Details */}
      {selectedEntity && (
        <div className="bg-white p-4 rounded-lg shadow">
          <h3 className="text-sm font-semibold text-gray-700 mb-2">Selected Details</h3>
          <div className="text-sm text-gray-600">
            <pre className="bg-gray-50 p-3 rounded overflow-auto max-h-40">
              {JSON.stringify(selectedEntity, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}

export default GraphView;