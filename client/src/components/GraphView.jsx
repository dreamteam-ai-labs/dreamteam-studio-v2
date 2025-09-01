import { useCallback, useEffect, useState, useMemo } from 'react';
import ReactFlow, {
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  MarkerType,
  ReactFlowProvider,
  useReactFlow,
} from 'reactflow';
import { useQuery } from '@tanstack/react-query';
import { 
  getProblems, 
  getClusters, 
  getSolutions, 
  getProjects,
  getProblemsByCluster,
  getSolutionsByProblem,
  getProblemsBySolution 
} from '../services/api';

// Import React Flow styles
import 'reactflow/dist/style.css';

// Custom node component for better styling
import { Handle, Position } from 'reactflow';

function CustomNode({ data }) {
  const getNodeStyle = () => {
    const baseStyle = "px-4 py-3 shadow-lg rounded-lg border-2 cursor-pointer transition-all hover:shadow-xl";
    
    switch (data.type) {
      case 'problem':
        return `${baseStyle} bg-blue-50 border-blue-400 text-blue-900 hover:bg-blue-100`;
      case 'cluster':
        return `${baseStyle} bg-purple-50 border-purple-400 text-purple-900 hover:bg-purple-100`;
      case 'solution':
        return `${baseStyle} bg-green-50 border-green-400 text-green-900 hover:bg-green-100`;
      case 'project':
        return `${baseStyle} bg-yellow-50 border-yellow-400 text-yellow-900 hover:bg-yellow-100`;
      default:
        return `${baseStyle} bg-gray-50 border-gray-400 text-gray-900 hover:bg-gray-100`;
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
    <div className={getNodeStyle()}>
      <Handle type="target" position={Position.Left} className="opacity-0" />
      <div className="flex flex-col items-center max-w-xs">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xl">{getIcon()}</span>
          <span className="text-xs font-semibold uppercase tracking-wide opacity-60">
            {data.type}
          </span>
        </div>
        <div className="text-sm font-medium text-center">
          {data.label}
        </div>
        {data.subtitle && (
          <div className="text-xs opacity-75 mt-1 text-center">
            {data.subtitle}
          </div>
        )}
      </div>
      <Handle type="source" position={Position.Right} className="opacity-0" />
    </div>
  );
}

const nodeTypes = {
  custom: CustomNode,
};

function GraphViewContent() {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState('all');
  const [selectedEntity, setSelectedEntity] = useState(null);
  const [focusedNodeId, setFocusedNodeId] = useState(null);
  const [showOrphaned, setShowOrphaned] = useState(true); // Toggle for orphaned problems
  const [solutionProblems, setSolutionProblems] = useState({}); // Cache for solution problems
  const { fitView } = useReactFlow(); // Get fitView function from React Flow

  // Fetch all data
  const { data: problems } = useQuery({
    queryKey: ['graph-problems'],
    queryFn: () => getProblems({}),
  });

  const { data: clusters } = useQuery({
    queryKey: ['graph-clusters'],
    queryFn: () => getClusters({}),
  });

  const { data: solutions } = useQuery({
    queryKey: ['graph-solutions'],
    queryFn: () => getSolutions({}),
  });

  const { data: projects } = useQuery({
    queryKey: ['graph-projects'],
    queryFn: getProjects,
  });

  // Create searchable items list
  const searchableItems = useMemo(() => {
    const items = [];
    
    if (selectedType === 'all' || selectedType === 'problem') {
      problems?.forEach(p => {
        // Check if cluster actually exists
        const hasActiveCluster = p.cluster_id && clusters?.some(c => (c.cluster_id || c.id) === p.cluster_id);
        
        // Check if problem is directly mapped to any solution
        const isDirectlyMapped = solutions?.some(s => {
          if (s.problem_ids) {
            const ids = typeof s.problem_ids === 'string' 
              ? s.problem_ids.replace(/[{}]/g, '').split(',').map(id => id.trim())
              : s.problem_ids;
            return ids.includes(p.id);
          }
          return false;
        });
        
        const isOrphaned = !hasActiveCluster && p.cluster_label; // Has label but no active cluster
        const isUnclustered = !p.cluster_id && !p.cluster_label; // Never clustered at all
        
        // Skip orphaned/unclustered problems if filter is off (unless they're directly mapped to solutions)
        if ((isOrphaned || isUnclustered) && !showOrphaned && !isDirectlyMapped) {
          return;
        }
        
        items.push({
          id: `problem-${p.id}`,
          type: 'problem',
          label: p.title,
          entity: p,
          searchText: `${p.title} ${p.description}`.toLowerCase(),
          badges: [
            p.impact && { label: p.impact, color: p.impact === 'high' ? 'red' : p.impact === 'medium' ? 'yellow' : 'green' },
            hasActiveCluster && { label: 'clustered', color: 'purple' },
            isOrphaned && !isDirectlyMapped && { label: 'orphaned', color: 'gray' },
            isOrphaned && isDirectlyMapped && { label: 'preserved', color: 'blue' },
            isUnclustered && !isDirectlyMapped && { label: 'unclustered', color: 'orange' }
          ].filter(Boolean)
        });
      });
    }
    
    if (selectedType === 'all' || selectedType === 'cluster') {
      clusters?.forEach(c => items.push({
        id: `cluster-${c.cluster_id || c.id}`,
        type: 'cluster',
        label: c.cluster_label || c.label,
        entity: c,
        searchText: `${c.cluster_label || c.label}`.toLowerCase(),
        badges: [
          c.problem_count !== undefined && { label: `${c.problem_count}`, color: 'blue' },
          c.solution_count > 0 && { label: `${c.solution_count} sol`, color: 'green' }
        ].filter(Boolean)
      }));
    }
    
    if (selectedType === 'all' || selectedType === 'solution') {
      solutions?.forEach(s => items.push({
        id: `solution-${s.id}`,
        type: 'solution',
        label: s.title,
        entity: s,
        searchText: `${s.title} ${s.description}`.toLowerCase(),
        badges: [
          s.overall_viability && { label: `${s.overall_viability}%`, color: s.overall_viability >= 70 ? 'green' : s.overall_viability >= 50 ? 'yellow' : 'red' },
          s.status && { label: s.status, color: 'gray' }
        ].filter(Boolean)
      }));
    }
    
    if (selectedType === 'all' || selectedType === 'project') {
      projects?.forEach(p => items.push({
        id: `project-${p.id}`,
        type: 'project',
        label: p.name || p.solution_title || 'Unnamed Project',
        entity: p,
        searchText: `${p.name || p.solution_title || ''}`.toLowerCase(),
        badges: [
          p.linear_project_id && { label: 'active', color: 'green' },
          !p.linear_project_id && { label: 'planned', color: 'gray' }
        ].filter(Boolean)
      }));
    }
    
    return items;
  }, [problems, clusters, solutions, projects, selectedType, showOrphaned]);

  // Filter items based on search
  const filteredItems = useMemo(() => {
    if (!searchTerm) return searchableItems;
    const term = searchTerm.toLowerCase();
    return searchableItems.filter(item => item.searchText.includes(term));
  }, [searchableItems, searchTerm]);

  // Build focused graph around selected entity
  useEffect(() => {
    if (!focusedNodeId) {
      // No entity selected - show nothing or a prompt
      setNodes([{
        id: 'prompt',
        type: 'custom',
        position: { x: 400, y: 300 },
        data: {
          type: 'prompt',
          label: 'Select an entity from the search panel',
          subtitle: 'The graph will show all its relationships'
        }
      }]);
      setEdges([]);
      return;
    }

    const newNodes = [];
    const newEdges = [];
    const nodeMap = new Map();
    
    // Parse the focused node ID
    const [entityType, entityId] = focusedNodeId.split('-');
    const focusedItem = searchableItems.find(item => item.id === focusedNodeId);
    
    if (!focusedItem) return;

    // Add the focused node at the center
    const centerNode = {
      id: focusedNodeId,
      type: 'custom',
      position: { x: 400, y: 300 },
      data: {
        type: entityType,
        label: focusedItem.label,
        subtitle: `${entityType === 'solution' && focusedItem.entity.overall_viability ? 
          `Viability: ${focusedItem.entity.overall_viability}%` : 
          entityType === 'cluster' && focusedItem.entity.problem_count !== undefined ? 
          `${focusedItem.entity.problem_count} problems` : 
          ''}`
      }
    };
    newNodes.push(centerNode);
    nodeMap.set(focusedNodeId, centerNode);

    // Improved layout calculation
    const calculateNodePositions = (nodeCount, baseRadius = 350) => {
      const positions = [];
      const minSpacing = 150; // Minimum pixels between nodes for better spacing
      
      if (nodeCount === 0) {
        return positions;
      } else if (nodeCount === 1) {
        // Single node - place to the right
        positions.push({ x: 400 + baseRadius, y: 300 });
      } else if (nodeCount === 2) {
        // Two nodes - place left and right
        positions.push({ x: 400 - baseRadius * 0.8, y: 300 });
        positions.push({ x: 400 + baseRadius * 0.8, y: 300 });
      } else if (nodeCount === 3) {
        // Three nodes - triangle formation
        positions.push({ x: 400, y: 300 - baseRadius * 0.7 }); // Top
        positions.push({ x: 400 - baseRadius * 0.6, y: 300 + baseRadius * 0.4 }); // Bottom left
        positions.push({ x: 400 + baseRadius * 0.6, y: 300 + baseRadius * 0.4 }); // Bottom right
      } else {
        // Multiple nodes - distribute in circle with dynamic radius
        const actualRadius = Math.max(baseRadius, (nodeCount * minSpacing) / (2 * Math.PI));
        const angleStep = (2 * Math.PI) / nodeCount;
        const startAngle = -Math.PI / 2; // Start at top
        
        for (let i = 0; i < nodeCount; i++) {
          const angle = startAngle + i * angleStep;
          positions.push({
            x: 400 + actualRadius * Math.cos(angle),
            y: 300 + actualRadius * Math.sin(angle)
          });
        }
      }
      return positions;
    };

    // Build relationships based on entity type
    if (entityType === 'problem') {
      const problem = focusedItem.entity;
      const relatedNodes = [];
      
      // Collect all related nodes first
      
      // Add current cluster if exists
      if (problem.cluster_id) {
        const cluster = clusters?.find(c => (c.cluster_id || c.id) === problem.cluster_id);
        if (cluster) {
          relatedNodes.push({
            id: `cluster-${problem.cluster_id}`,
            type: 'cluster',
            data: {
              type: 'cluster',
              label: cluster.cluster_label || cluster.label,
              subtitle: `${cluster.problem_count || 0} problems`
            },
            edgeStyle: { stroke: '#9333ea', strokeWidth: 2 },
            edgeDirection: 'from-center' // problem -> cluster
          });
        }
      }
      
      // Check for historical clusters (orphaned problem case)
      if (!problem.cluster_id && problem.cluster_label) {
        // This is an orphaned problem - show the historical cluster label
        relatedNodes.push({
          id: `cluster-historical-${problem.id}`,
          type: 'cluster',
          data: {
            type: 'cluster',
            label: problem.cluster_label + ' (Historical)',
            subtitle: 'Cluster no longer exists'
          },
          edgeStyle: { stroke: '#9333ea', strokeWidth: 1, strokeDasharray: '5,5' },
          edgeDirection: 'from-center'
        });
      }

      // Add solutions that address this problem
      const problemSolutions = solutions?.filter(s => {
        if (s.problem_ids) {
          const ids = typeof s.problem_ids === 'string' 
            ? s.problem_ids.replace(/[{}]/g, '').split(',').map(id => id.trim())
            : s.problem_ids;
          return ids.includes(problem.id);
        }
        return false;
      });

      problemSolutions?.forEach(solution => {
        relatedNodes.push({
          id: `solution-${solution.id}`,
          type: 'solution',
          data: {
            type: 'solution',
            label: solution.title,
            subtitle: `Viability: ${solution.overall_viability}%`
          },
          edgeStyle: { stroke: '#10b981', strokeWidth: 2 },
          edgeDirection: 'from-center' // problem -> solution
        });
      });

      // Calculate positions for all related nodes with proper spacing
      const positions = calculateNodePositions(relatedNodes.length, 350);
      
      // Add nodes with calculated positions
      relatedNodes.forEach((node, index) => {
        newNodes.push({
          id: node.id,
          type: 'custom',
          position: positions[index],
          data: node.data
        });

        // Add edge based on direction
        if (node.edgeDirection === 'from-center') {
          newEdges.push({
            id: `edge-${focusedNodeId}-${node.id}`,
            source: focusedNodeId,
            target: node.id,
            type: 'smoothstep',
            style: node.edgeStyle,
            markerEnd: { 
              type: MarkerType.ArrowClosed, 
              color: node.edgeStyle.stroke
            }
          });
        } else {
          newEdges.push({
            id: `edge-${node.id}-${focusedNodeId}`,
            source: node.id,
            target: focusedNodeId,
            type: 'smoothstep',
            style: node.edgeStyle,
            markerEnd: { 
              type: MarkerType.ArrowClosed, 
              color: node.edgeStyle.stroke
            }
          });
        }
      });
    }

    else if (entityType === 'cluster') {
      const cluster = focusedItem.entity;
      const clusterId = cluster.cluster_id || cluster.id;
      
      // Get problems and solutions
      const clusterProblems = problems?.filter(p => p.cluster_id === clusterId).slice(0, 12);
      const clusterSolutions = solutions?.filter(s => s.source_cluster_id === clusterId);
      
      // Calculate positions with better spacing
      const problemPositions = calculateNodePositions(clusterProblems.length, 350);
      const solutionPositions = clusterSolutions.length <= 2 
        ? [{ x: 750, y: 250 }, { x: 750, y: 350 }].slice(0, clusterSolutions.length)
        : calculateNodePositions(clusterSolutions.length, 300);
      
      // Add problems
      clusterProblems.forEach((problem, idx) => {
        const problemId = `problem-${problem.id}`;
        const position = problemPositions[idx] || { x: 150, y: 300 + idx * 100 };
        
        newNodes.push({
          id: problemId,
          type: 'custom',
          position,
          data: {
            type: 'problem',
            label: problem.title,
            subtitle: problem.impact ? `Impact: ${problem.impact}` : ''
          }
        });
        
        newEdges.push({
          id: `edge-${problemId}-${focusedNodeId}`,
          source: problemId,
          target: focusedNodeId,
          type: 'smoothstep',
          style: { stroke: '#3b82f6', strokeWidth: 1 },
          markerEnd: { type: MarkerType.ArrowClosed, color: '#3b82f6' }
        });
      });

      // Add solutions
      clusterSolutions?.forEach((solution, idx) => {
        const solutionId = `solution-${solution.id}`;
        const position = solutionPositions[idx] || { x: 650, y: 200 + idx * 120 };
        
        newNodes.push({
          id: solutionId,
          type: 'custom',
          position,
          data: {
            type: 'solution',
            label: solution.title,
            subtitle: `Viability: ${solution.overall_viability}%`
          }
        });
        
        newEdges.push({
          id: `edge-${focusedNodeId}-${solutionId}`,
          source: focusedNodeId,
          target: solutionId,
          type: 'smoothstep',
          style: { stroke: '#10b981', strokeWidth: 2 },
          markerEnd: { type: MarkerType.ArrowClosed, color: '#10b981' }
        });
      });
    }

    else if (entityType === 'solution') {
      const solution = focusedItem.entity;
      const relatedNodes = [];
      
      console.log('Building graph for solution:', solution.id);
      console.log('Cached problems for this solution:', solutionProblems[solution.id]);
      
      // Collect all related nodes first
      
      // Add source cluster
      if (solution.source_cluster_id) {
        const cluster = clusters?.find(c => (c.cluster_id || c.id) === solution.source_cluster_id);
        if (cluster) {
          relatedNodes.push({
            id: `cluster-${solution.source_cluster_id}`,
            type: 'cluster',
            data: {
              type: 'cluster',
              label: cluster.cluster_label || cluster.label || solution.source_cluster_label,
              subtitle: `${cluster.problem_count || 0} problems`
            },
            edgeStyle: { stroke: '#9333ea', strokeWidth: 2 },
            edgeDirection: 'to-center' // cluster -> solution
          });
        }
      }

      // Add directly mapped problems from cache if available
      const cachedProblems = solutionProblems[solution.id];
      console.log('Using cached problems:', cachedProblems);
      if (cachedProblems && cachedProblems.length > 0) {
        cachedProblems.slice(0, 10).forEach(problem => {
          relatedNodes.push({
            id: `problem-${problem.id}`,
            type: 'problem',
            data: {
              type: 'problem',
              label: problem.title,
              subtitle: problem.impact ? `Impact: ${problem.impact}` : ''
            },
            edgeStyle: { stroke: '#3b82f6', strokeWidth: 1, strokeDasharray: '5,5' },
            edgeDirection: 'to-center' // problem -> solution
          });
        });
      }

      // Add project if exists
      const project = projects?.find(p => p.solution_id === solution.id);
      if (project) {
        relatedNodes.push({
          id: `project-${project.id}`,
          type: 'project',
          data: {
            type: 'project',
            label: project.name || project.solution_title || 'Project',
            subtitle: project.linear_project_id ? 'Active' : 'Planned'
          },
          edgeStyle: { stroke: '#eab308', strokeWidth: 2 },
          edgeDirection: 'from-center' // solution -> project
        });
      }

      // Calculate positions for all related nodes
      const positions = calculateNodePositions(relatedNodes.length, 350);
      
      // Add nodes with calculated positions
      relatedNodes.forEach((node, index) => {
        newNodes.push({
          id: node.id,
          type: 'custom',
          position: positions[index],
          data: node.data
        });

        // Add edge based on direction
        if (node.edgeDirection === 'to-center') {
          newEdges.push({
            id: `edge-${node.id}-${focusedNodeId}`,
            source: node.id,
            target: focusedNodeId,
            type: 'smoothstep',
            style: node.edgeStyle,
            markerEnd: { 
              type: MarkerType.ArrowClosed, 
              color: node.edgeStyle.stroke 
            }
          });
        } else {
          newEdges.push({
            id: `edge-${focusedNodeId}-${node.id}`,
            source: focusedNodeId,
            target: node.id,
            type: 'smoothstep',
            style: node.edgeStyle,
            markerEnd: { 
              type: MarkerType.ArrowClosed, 
              color: node.edgeStyle.stroke 
            }
          });
        }
      });
    }

    else if (entityType === 'project') {
      const project = focusedItem.entity;
      const relatedNodes = [];
      
      // Get solution and its related entities
      if (project.solution_id) {
        const solution = solutions?.find(s => s.id === project.solution_id);
        if (solution) {
          // Add solution node
          relatedNodes.push({
            id: `solution-${solution.id}`,
            type: 'solution',
            data: {
              type: 'solution',
              label: solution.title,
              subtitle: `Viability: ${solution.overall_viability}%`
            },
            edgeStyle: { stroke: '#eab308', strokeWidth: 2 },
            edgeDirection: 'to-center' // solution -> project
          });
          
          // Add solution's source cluster
          if (solution.source_cluster_id) {
            const cluster = clusters?.find(c => (c.cluster_id || c.id) === solution.source_cluster_id);
            if (cluster) {
              relatedNodes.push({
                id: `cluster-${solution.source_cluster_id}`,
                type: 'cluster',
                data: {
                  type: 'cluster',
                  label: cluster.cluster_label || cluster.label || solution.source_cluster_label,
                  subtitle: `${cluster.problem_count || 0} problems`
                },
                edgeStyle: { stroke: '#9333ea', strokeWidth: 1, strokeDasharray: '5,5' },
                edgeDirection: 'indirect' // cluster related but not directly connected to project
              });
            }
          }
          
          // Add solution's directly mapped problems from cache
          const cachedProblems = solutionProblems[solution.id];
          if (cachedProblems && cachedProblems.length > 0) {
            cachedProblems.slice(0, 5).forEach(problem => {
              relatedNodes.push({
                id: `problem-${problem.id}`,
                type: 'problem',
                data: {
                  type: 'problem',
                  label: problem.title,
                  subtitle: problem.impact ? `Impact: ${problem.impact}` : ''
                },
                edgeStyle: { stroke: '#3b82f6', strokeWidth: 1, strokeDasharray: '5,5' },
                edgeDirection: 'indirect' // problems related but not directly connected to project
              });
            });
          }
        }
      }

      // Calculate positions for all related nodes
      const positions = calculateNodePositions(relatedNodes.length, 350);
      
      // Add nodes with calculated positions
      relatedNodes.forEach((node, index) => {
        newNodes.push({
          id: node.id,
          type: 'custom',
          position: positions[index],
          data: node.data
        });

        // Add edges based on relationship type
        if (node.edgeDirection === 'to-center') {
          // Direct connection to project
          newEdges.push({
            id: `edge-${node.id}-${focusedNodeId}`,
            source: node.id,
            target: focusedNodeId,
            type: 'smoothstep',
            style: node.edgeStyle,
            markerEnd: { 
              type: MarkerType.ArrowClosed, 
              color: node.edgeStyle.stroke 
            }
          });
        } else if (node.edgeDirection === 'indirect' && node.type === 'cluster') {
          // Indirect connection: cluster -> solution
          const solutionNodeId = relatedNodes.find(n => n.type === 'solution')?.id;
          if (solutionNodeId) {
            newEdges.push({
              id: `edge-${node.id}-${solutionNodeId}`,
              source: node.id,
              target: solutionNodeId,
              type: 'smoothstep',
              style: node.edgeStyle,
              markerEnd: { 
                type: MarkerType.ArrowClosed, 
                color: node.edgeStyle.stroke 
              }
            });
          }
        } else if (node.edgeDirection === 'indirect' && node.type === 'problem') {
          // Indirect connection: problem -> solution
          const solutionNodeId = relatedNodes.find(n => n.type === 'solution')?.id;
          if (solutionNodeId) {
            newEdges.push({
              id: `edge-${node.id}-${solutionNodeId}`,
              source: node.id,
              target: solutionNodeId,
              type: 'smoothstep',
              style: node.edgeStyle,
              markerEnd: { 
                type: MarkerType.ArrowClosed, 
                color: node.edgeStyle.stroke 
              }
            });
          }
        }
      });
    }

    setNodes(newNodes);
    setEdges(newEdges);
    
    // Auto-fit view when graph changes (if there are nodes to display)
    if (newNodes.length > 0 && focusedNodeId) {
      setTimeout(() => {
        fitView({ 
          padding: 0.2, 
          duration: 800,
          maxZoom: 1.5,
          minZoom: 0.3
        });
      }, 100);
    }
  }, [focusedNodeId, problems, clusters, solutions, projects, searchableItems, solutionProblems, fitView]);

  // Create a complete list of all items for node clicks (unfiltered)
  const allItems = useMemo(() => {
    const items = [];
    
    // Add all problems
    problems?.forEach(p => {
      items.push({
        id: `problem-${p.id}`,
        type: 'problem',
        entity: p
      });
    });
    
    // Add all clusters
    clusters?.forEach(c => {
      items.push({
        id: `cluster-${c.cluster_id || c.id}`,
        type: 'cluster',
        entity: c
      });
    });
    
    // Add all solutions
    solutions?.forEach(s => {
      items.push({
        id: `solution-${s.id}`,
        type: 'solution',
        entity: s
      });
    });
    
    // Add all projects
    projects?.forEach(p => {
      items.push({
        id: `project-${p.id}`,
        type: 'project',
        entity: p
      });
    });
    
    return items;
  }, [problems, clusters, solutions, projects]);

  const onNodeClick = useCallback((event, node) => {
    if (node.id !== 'prompt') {
      setFocusedNodeId(node.id);
      // Use allItems instead of searchableItems to find any clicked node
      const item = allItems.find(i => i.id === node.id);
      if (item) {
        setSelectedEntity(item.entity);
      }
    }
  }, [allItems]);

  const handleItemSelect = (item) => {
    setFocusedNodeId(item.id);
    setSelectedEntity(item.entity);
    
    // Auto-fit view after a short delay to allow nodes to be positioned
    setTimeout(() => {
      fitView({ 
        padding: 0.2, 
        duration: 800,
        maxZoom: 1.5,
        minZoom: 0.3
      });
    }, 100);
  };

  // Fetch problems for selected solution or project's solution
  useEffect(() => {
    let solutionIdToFetch = null;
    
    if (selectedEntity && focusedNodeId?.startsWith('solution-')) {
      solutionIdToFetch = selectedEntity.id;
    } else if (selectedEntity && focusedNodeId?.startsWith('project-')) {
      // For projects, fetch problems for the associated solution
      const project = selectedEntity;
      if (project.solution_id) {
        solutionIdToFetch = project.solution_id;
      }
    }
    
    if (solutionIdToFetch && !solutionProblems[solutionIdToFetch]) {
      console.log('Fetching problems for solution:', solutionIdToFetch);
      getProblemsBySolution(solutionIdToFetch).then(response => {
        // API returns array directly, or wrapped in response.data
        const problemsData = Array.isArray(response) ? response : (response.data || []);
        console.log('Problems fetched for solution:', solutionIdToFetch, problemsData);
        setSolutionProblems(prev => ({
          ...prev,
          [solutionIdToFetch]: problemsData
        }));
      }).catch(error => {
        console.error('Error fetching problems for solution:', error);
        setSolutionProblems(prev => ({
          ...prev,
          [solutionIdToFetch]: []
        }));
      });
    }
  }, [selectedEntity, focusedNodeId]);

  const getBadgeColor = (color) => {
    const colorMap = {
      red: 'bg-red-100 text-red-700',
      yellow: 'bg-yellow-100 text-yellow-700',
      green: 'bg-green-100 text-green-700',
      blue: 'bg-blue-100 text-blue-700',
      purple: 'bg-purple-100 text-purple-700',
      gray: 'bg-gray-100 text-gray-700'
    };
    return colorMap[color] || 'bg-gray-100 text-gray-700';
  };

  return (
    <div className="flex h-[800px] gap-4">
      {/* Left Panel - Search, Selection and Details */}
      <div className="w-96 flex flex-col gap-4">
        {/* Entity Explorer */}
        <div className="bg-white rounded-lg shadow p-4 flex-1 overflow-hidden flex flex-col">
          <h3 className="text-lg font-semibold mb-4">Entity Explorer</h3>
          
          {/* Search Input */}
          <input
            type="text"
            placeholder="Search entities..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-3 py-2 border rounded-lg mb-3 text-sm"
          />
          
          {/* Type Filter */}
          <div className="flex gap-1 mb-2">
            {['all', 'problem', 'cluster', 'solution', 'project'].map(type => (
              <button
                key={type}
                onClick={() => setSelectedType(type)}
                className={`px-2 py-1 text-xs rounded capitalize ${
                  selectedType === type
                    ? 'bg-primary-600 text-white'
                    : 'bg-gray-100 hover:bg-gray-200'
                }`}
              >
                {type}
              </button>
            ))}
          </div>
          
          {/* Orphaned Filter */}
          {(selectedType === 'all' || selectedType === 'problem') && (
            <div className="flex items-center gap-2 mb-4 p-2 bg-gray-50 rounded">
              <input
                type="checkbox"
                id="show-orphaned"
                checked={showOrphaned}
                onChange={(e) => setShowOrphaned(e.target.checked)}
                className="rounded"
              />
              <label htmlFor="show-orphaned" className="text-xs text-gray-700">
                Show orphaned/unclustered
              </label>
              <span className="text-xs text-gray-500" title="Problems that are either orphaned (cluster deleted) or never clustered. Preserved problems (mapped to solutions) always show.">
                ⓘ
              </span>
            </div>
          )}
          
          {/* Entity List */}
          <div className="space-y-2 overflow-y-auto flex-1">
            {filteredItems.slice(0, 50).map(item => (
              <div
                key={item.id}
                onClick={() => handleItemSelect(item)}
                className={`p-2 rounded cursor-pointer transition-all ${
                  focusedNodeId === item.id
                    ? 'bg-primary-100 border-primary-500 border'
                    : 'hover:bg-gray-50 border border-transparent'
                }`}
              >
                <div className="flex items-start gap-2">
                  <span className="text-sm mt-0.5">
                    {item.type === 'problem' && '⚠️'}
                    {item.type === 'cluster' && '📊'}
                    {item.type === 'solution' && '💡'}
                    {item.type === 'project' && '🚀'}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-gray-500 uppercase">{item.type}</div>
                    <div className="text-sm font-medium truncate">{item.label}</div>
                    {item.badges && item.badges.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {item.badges.map((badge, idx) => (
                          <span
                            key={idx}
                            className={`inline-flex px-1.5 py-0.5 text-xs rounded ${getBadgeColor(badge.color)}`}
                          >
                            {badge.label}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
            {filteredItems.length > 50 && (
              <div className="text-xs text-gray-500 text-center py-2">
                Showing first 50 of {filteredItems.length} results
              </div>
            )}
          </div>
        </div>

        {/* Details Panel */}
        {selectedEntity && (
          <div className="bg-white rounded-lg shadow p-4 max-h-80 overflow-y-auto">
            <h3 className="text-sm font-semibold mb-3">Entity Details</h3>
            <div className="space-y-3 text-sm">
              {/* Basic Info */}
              {selectedEntity.title && (
                <div>
                  <div className="text-xs text-gray-500 uppercase">Title</div>
                  <div className="font-medium">{selectedEntity.title}</div>
                </div>
              )}
              {selectedEntity.name && (
                <div>
                  <div className="text-xs text-gray-500 uppercase">Name</div>
                  <div className="font-medium">{selectedEntity.name}</div>
                </div>
              )}
              {selectedEntity.identifier && (
                <div>
                  <div className="text-xs text-gray-500 uppercase">Identifier</div>
                  <div className="font-mono text-xs bg-gray-100 px-1 py-0.5 rounded inline-block">
                    {selectedEntity.identifier}
                  </div>
                </div>
              )}
              
              {/* Relationships */}
              {selectedEntity.cluster_label && (
                <div>
                  <div className="text-xs text-gray-500 uppercase">Cluster</div>
                  <div className="font-medium">{selectedEntity.cluster_label}</div>
                </div>
              )}
              {selectedEntity.source_cluster_label && (
                <div>
                  <div className="text-xs text-gray-500 uppercase">Source Cluster</div>
                  <div className="font-medium">{selectedEntity.source_cluster_label}</div>
                </div>
              )}
              
              {/* Description */}
              {selectedEntity.description && (
                <div>
                  <div className="text-xs text-gray-500 uppercase">Description</div>
                  <div className="text-gray-700 text-xs line-clamp-4">{selectedEntity.description}</div>
                </div>
              )}
              {selectedEntity.value_proposition && (
                <div>
                  <div className="text-xs text-gray-500 uppercase">Value Proposition</div>
                  <div className="text-gray-700 text-xs line-clamp-3">{selectedEntity.value_proposition}</div>
                </div>
              )}
              
              {/* Metrics */}
              {selectedEntity.overall_viability !== undefined && (
                <div>
                  <div className="text-xs text-gray-500 uppercase">Viability Score</div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{selectedEntity.overall_viability}%</span>
                    <div className="flex-1 bg-gray-200 rounded-full h-2 max-w-[100px]">
                      <div 
                        className="bg-green-500 h-2 rounded-full" 
                        style={{width: `${selectedEntity.overall_viability}%`}}
                      />
                    </div>
                  </div>
                </div>
              )}
              {selectedEntity.problem_count !== undefined && (
                <div>
                  <div className="text-xs text-gray-500 uppercase">Problems</div>
                  <div className="font-medium">{selectedEntity.problem_count}</div>
                </div>
              )}
              {selectedEntity.impact && (
                <div>
                  <div className="text-xs text-gray-500 uppercase">Impact</div>
                  <div className="inline-block">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                      selectedEntity.impact === 'high' ? 'bg-red-100 text-red-700' :
                      selectedEntity.impact === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                      'bg-blue-100 text-blue-700'
                    }`}>
                      {selectedEntity.impact.toUpperCase()}
                    </span>
                  </div>
                </div>
              )}
              
              {/* Status */}
              {selectedEntity.status && (
                <div>
                  <div className="text-xs text-gray-500 uppercase">Status</div>
                  <div className="inline-block">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                      selectedEntity.status === 'active' ? 'bg-green-100 text-green-700' :
                      selectedEntity.status === 'planned' ? 'bg-blue-100 text-blue-700' :
                      'bg-gray-100 text-gray-700'
                    }`}>
                      {selectedEntity.status.toUpperCase()}
                    </span>
                  </div>
                </div>
              )}
              
              {/* External Links */}
              {(selectedEntity.linear_project_id || selectedEntity.github_repo_url || selectedEntity.linear_issue_id) && (
                <div className="pt-2 border-t border-gray-200">
                  <div className="text-xs text-gray-500 uppercase mb-2">External Links</div>
                  <div className="flex flex-col gap-2">
                    {selectedEntity.linear_project_id && (
                      <a 
                        href={`https://linear.app/dreamteam-ai-labs/project/${selectedEntity.linear_project_id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 text-xs text-blue-600 hover:text-blue-800 hover:bg-blue-50 px-2 py-1 rounded transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                        View Linear Project
                      </a>
                    )}
                    {selectedEntity.linear_issue_id && (
                      <a 
                        href={`https://linear.app/dreamteam-ai-labs/issue/${selectedEntity.linear_issue_id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 text-xs text-blue-600 hover:text-blue-800 hover:bg-blue-50 px-2 py-1 rounded transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002 2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                        View Linear Issue
                      </a>
                    )}
                    {selectedEntity.github_repo_url && (
                      <a 
                        href={selectedEntity.github_repo_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 text-xs text-blue-600 hover:text-blue-800 hover:bg-blue-50 px-2 py-1 rounded transition-colors"
                      >
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                        </svg>
                        View GitHub Repository
                      </a>
                    )}
                  </div>
                </div>
              )}
              
              {/* Timestamps */}
              {selectedEntity.created_at && (
                <div className="pt-2 border-t border-gray-200">
                  <div className="text-xs text-gray-500 uppercase">Created</div>
                  <div className="text-xs text-gray-600">
                    {new Date(selectedEntity.created_at).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Right Panel - Graph */}
      <div className="flex-1 bg-white rounded-lg shadow">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={onNodeClick}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.2 }}
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
    </div>
  );
}

function GraphView() {
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-white p-4 rounded-lg shadow">
        <h2 className="text-lg font-semibold">Relationship Explorer</h2>
        <p className="text-sm text-gray-600 mt-1">
          Search and select any entity to explore its relationships
        </p>
      </div>

      {/* Graph Container */}
      <ReactFlowProvider>
        <GraphViewContent />
      </ReactFlowProvider>
    </div>
  );
}

export default GraphView;