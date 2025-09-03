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

function GraphViewContent({ globalFilters, initialEntityType }) {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [localSearchTerm, setLocalSearchTerm] = useState('');
  const [selectedEntity, setSelectedEntity] = useState(null);
  const [focusedNodeId, setFocusedNodeId] = useState(null);
  const [solutionProblems, setSolutionProblems] = useState({}); // Cache for solution problems
  const { fitView } = useReactFlow(); // Get fitView function from React Flow
  
  // Use search term from filters if available, otherwise use local search
  const searchTerm = globalFilters.searchTerm !== undefined ? globalFilters.searchTerm : localSearchTerm;

  // Fetch all data
  const { data: problems } = useQuery({
    queryKey: ['graph-problems'],
    queryFn: () => getProblems({}),
  });

  const { data: clusters } = useQuery({
    queryKey: ['graph-clusters', initialEntityType],
    queryFn: () => getClusters({}, initialEntityType === 'solutionCluster' ? 'solution' : 'problem'),
  });

  const { data: solutions, refetch: refetchSolutions } = useQuery({
    queryKey: ['graph-solutions'],
    queryFn: async () => {
      const response = await getSolutions({});
      console.log('Solutions API Response:', response?.slice(0, 2)); // Log first 2 solutions
      return response;
    },
    staleTime: 0, // Always fetch fresh data
    refetchOnWindowFocus: true,
  });

  const { data: projects } = useQuery({
    queryKey: ['graph-projects'],
    queryFn: getProjects,
  });

  // Refetch solutions when viewing solution clusters to ensure we have solution_cluster_id
  useEffect(() => {
    if (initialEntityType === 'solutionCluster') {
      refetchSolutions();
    }
  }, [initialEntityType, refetchSolutions]);

  // Create searchable items list
  const searchableItems = useMemo(() => {
    const items = [];
    
    if (initialEntityType === 'problem') {
      problems?.forEach(p => {
        // Apply search filter
        if (globalFilters.searchTerm) {
          const term = globalFilters.searchTerm.toLowerCase();
          if (!p.title?.toLowerCase().includes(term) &&
              !p.description?.toLowerCase().includes(term) &&
              !p.cluster_label?.toLowerCase().includes(term)) {
            return;
          }
        }
        
        // Apply title filter
        if (globalFilters.title) {
          if (!p.title?.toLowerCase().includes(globalFilters.title.toLowerCase())) {
            return;
          }
        }
        
        // Apply description filter  
        if (globalFilters.description) {
          if (!p.description?.toLowerCase().includes(globalFilters.description.toLowerCase())) {
            return;
          }
        }
        
        // Apply cluster label filter
        if (globalFilters.cluster_label) {
          if (!p.cluster_label?.toLowerCase().includes(globalFilters.cluster_label.toLowerCase())) {
            return;
          }
        }
        
        // Apply impact filter
        if (globalFilters.impact && globalFilters.impact.length > 0 && !globalFilters.impact.includes(p.impact)) {
          return;
        }
        
        // Apply industry filter
        if (globalFilters.industry && globalFilters.industry.length > 0 && !globalFilters.industry.includes(p.industry)) {
          return;
        }
        
        // Apply business size filter
        if (globalFilters.businessSize && globalFilters.businessSize.length > 0 && !globalFilters.businessSize.includes(p.business_size)) {
          return;
        }
        
        // Apply solution count filter
        if (globalFilters.solution_count !== null && globalFilters.solution_count !== undefined) {
          if ((p.solution_count || 0) < globalFilters.solution_count) {
            return;
          }
        }
        
        // Apply project count filter
        if (globalFilters.project_count !== null && globalFilters.project_count !== undefined) {
          if ((p.project_count || 0) < globalFilters.project_count) {
            return;
          }
        }
        
        // Apply created date filter
        if (globalFilters.created_at) {
          const filterDate = new Date(globalFilters.created_at);
          const problemDate = new Date(p.created_at);
          if (problemDate < filterDate) {
            return;
          }
        }
        
        // Check if cluster actually exists
        const hasActiveCluster = p.cluster_id && clusters?.some(c => (c.cluster_id || c.id) === p.cluster_id);
        
        // Apply hasCluster filter
        if (globalFilters.hasCluster === true && !hasActiveCluster) {
          return;
        }
        
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
        if ((isOrphaned || isUnclustered) && !globalFilters.showOrphaned && !isDirectlyMapped) {
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
    
    if (initialEntityType === 'cluster' || initialEntityType === 'solutionCluster') {
      // Debug clusters data
      if (initialEntityType === 'solutionCluster' && clusters?.length > 0) {
        console.log('Solution Clusters Data:', clusters[0]);
      }
      clusters?.forEach(c => {
        // Apply search filter
        if (globalFilters.searchTerm) {
          const term = globalFilters.searchTerm.toLowerCase();
          if (!(c.cluster_label || c.label || '').toLowerCase().includes(term)) {
            return;
          }
        }
        
        // Apply cluster label filter
        if (globalFilters.cluster_label) {
          if (!(c.cluster_label || c.label || '').toLowerCase().includes(globalFilters.cluster_label.toLowerCase())) {
            return;
          }
        }
        
        // Apply problem count filter
        if (globalFilters.problem_count !== null && globalFilters.problem_count !== undefined) {
          if ((c.problem_count || 0) < globalFilters.problem_count) {
            return;
          }
        }
        
        // Apply solution count filter
        if (globalFilters.solution_count !== null && globalFilters.solution_count !== undefined) {
          if ((c.solution_count || 0) < globalFilters.solution_count) {
            return;
          }
        }
        
        // Apply avg similarity filter
        if (globalFilters.avg_similarity !== null && globalFilters.avg_similarity !== undefined) {
          if ((parseFloat(c.avg_similarity) || 0) < globalFilters.avg_similarity) {
            return;
          }
        }
        
        // Apply status filter
        if (globalFilters.status && globalFilters.status.length > 0) {
          const status = c.solution_count > 0 ? 'has-solutions' : 'no-solutions';
          if (!globalFilters.status.includes(status)) {
            return;
          }
        }
        
        items.push({
          id: `cluster-${c.cluster_id || c.id}`,
          type: 'cluster',
          label: c.cluster_label || c.label,
          entity: c,
          searchText: `${c.cluster_label || c.label}`.toLowerCase(),
          badges: [
            c.problem_count !== undefined && { label: `${c.problem_count}`, color: 'blue' },
            c.solution_count > 0 && { label: `${c.solution_count} sol`, color: 'green' }
          ].filter(Boolean)
        });
      });
    }
    
    if (initialEntityType === 'solution') {
      solutions?.forEach(s => {
        // Apply search filter
        if (globalFilters.searchTerm) {
          const term = globalFilters.searchTerm.toLowerCase();
          if (!s.title?.toLowerCase().includes(term) &&
              !s.description?.toLowerCase().includes(term) &&
              !s.identifier?.toLowerCase().includes(term)) {
            return;
          }
        }
        
        // Apply title filter
        if (globalFilters.title) {
          if (!s.title?.toLowerCase().includes(globalFilters.title.toLowerCase())) {
            return;
          }
        }
        
        // Apply status filter
        if (globalFilters.status && globalFilters.status.length > 0 && !globalFilters.status.includes(s.status)) {
          return;
        }
        
        // Apply viability filter (use default range if not provided)
        const viabilityRange = globalFilters.viabilityRange || globalFilters.overall_viability || [0, 100];
        if (s.overall_viability !== undefined) {
          if (s.overall_viability < viabilityRange[0] || 
              s.overall_viability > viabilityRange[1]) {
            return;
          }
        }
        
        // Apply LTV/CAC ratio filter
        if (globalFilters.ltv_cac !== null && globalFilters.ltv_cac !== undefined) {
          if (s.ltv_estimate && s.cac_estimate && s.cac_estimate > 0) {
            const ratio = s.ltv_estimate / s.cac_estimate;
            if (ratio < globalFilters.ltv_cac) {
              return;
            }
          } else {
            return; // Exclude solutions without LTV/CAC data
          }
        }
        
        // Apply revenue filter
        if (globalFilters.revenue !== null && globalFilters.revenue !== undefined) {
          if ((s.recurring_revenue_potential || 0) < globalFilters.revenue) {
            return;
          }
        }
        
        // Apply source cluster filter
        if (globalFilters.source_cluster) {
          if (!s.source_cluster_label?.toLowerCase().includes(globalFilters.source_cluster.toLowerCase())) {
            return;
          }
        }
        
        // Apply problem count filter
        if (globalFilters.problem_count !== null && globalFilters.problem_count !== undefined) {
          if ((s.problem_count || 0) < globalFilters.problem_count) {
            return;
          }
        }
        
        // Apply hasProject filter
        if (globalFilters.hasProject === true) {
          const hasProject = projects?.some(p => p.solution_id === s.id);
          if (!hasProject) return;
        } else if (globalFilters.hasProject === false) {
          const hasProject = projects?.some(p => p.solution_id === s.id);
          if (hasProject) return;
        }
        
        items.push({
        id: `solution-${s.id}`,
        type: 'solution',
        label: s.title,
        entity: s,
        searchText: `${s.title} ${s.description}`.toLowerCase(),
        badges: [
          s.overall_viability && { label: `${s.overall_viability}%`, color: s.overall_viability >= 70 ? 'green' : s.overall_viability >= 50 ? 'yellow' : 'red' },
          s.status && { label: s.status, color: 'gray' }
        ].filter(Boolean)
      });
    });
    }
    
    if (initialEntityType === 'project') {
      projects?.forEach(p => {
        // Apply search filter
        if (globalFilters.searchTerm) {
          const term = globalFilters.searchTerm.toLowerCase();
          if (!p.name?.toLowerCase().includes(term) &&
              !p.solution_title?.toLowerCase().includes(term) &&
              !p.description?.toLowerCase().includes(term) &&
              !p.github_repo_url?.toLowerCase().includes(term) &&
              !p.linear_project_id?.toLowerCase().includes(term)) {
            return;
          }
        }
        
        // Apply name filter
        if (globalFilters.name) {
          if (!p.name?.toLowerCase().includes(globalFilters.name.toLowerCase()) &&
              !p.solution_title?.toLowerCase().includes(globalFilters.name.toLowerCase())) {
            return;
          }
        }
        
        // Apply github filter
        if (globalFilters.github) {
          if (!p.github_repo_url?.toLowerCase().includes(globalFilters.github.toLowerCase())) {
            return;
          }
        }
        
        // Apply linear filter
        if (globalFilters.linear) {
          if (!p.linear_project_id?.toLowerCase().includes(globalFilters.linear.toLowerCase())) {
            return;
          }
        }
        
        // Apply viability filter
        if (globalFilters.viability !== null && globalFilters.viability !== undefined) {
          // Get viability from the solution if available
          const solution = solutions?.find(s => s.id === p.solution_id);
          const viability = solution?.overall_viability || 0;
          if (viability < globalFilters.viability) {
            return;
          }
        }
        
        // Apply status filter
        if (globalFilters.status && globalFilters.status.length > 0) {
          const status = p.status || 'active';
          if (!globalFilters.status.includes(status)) {
            return;
          }
        }
        
        // Apply created date filter
        if (globalFilters.created_at) {
          const filterDate = new Date(globalFilters.created_at);
          const projectDate = new Date(p.created_at);
          if (projectDate < filterDate) {
            return;
          }
        }
        
        items.push({
        id: `project-${p.id}`,
        type: 'project',
        label: p.name || p.solution_title || 'Unnamed Project',
        entity: p,
        searchText: `${p.name || p.solution_title || ''}`.toLowerCase(),
        badges: [
          p.linear_project_id && { label: 'active', color: 'green' },
          !p.linear_project_id && { label: 'planned', color: 'gray' }
        ].filter(Boolean)
      });
    });
    }
    
    return items;
  }, [problems, clusters, solutions, projects, globalFilters, initialEntityType]);

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
    
    // Debug logging for solution clusters
    if (initialEntityType === 'solutionCluster' && entityType === 'cluster') {
      console.log('Processing solution cluster view:', {
        focusedNodeId,
        entityType,
        entityId,
        focusedItem,
        initialEntityType
      });
    }

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
          entityType === 'cluster' ? 
          (initialEntityType === 'solutionCluster' ? 
            `${focusedItem.entity.solution_count || 0} solutions` : 
            `${focusedItem.entity.problem_count || 0} problems`) : 
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
      const isSolutionCluster = initialEntityType === 'solutionCluster';
      
      // Debug cluster data
      if (isSolutionCluster) {
        console.log('Solution Cluster Entity:', cluster);
        console.log('Using Cluster ID:', clusterId);
      }
      
      // Get problems and solutions based on cluster type
      const clusterProblems = isSolutionCluster 
        ? [] // Solution clusters don't have problems
        : problems?.filter(p => p.cluster_id === clusterId).slice(0, 12);
      
      const clusterSolutions = isSolutionCluster
        ? solutions?.filter(s => {
            // More detailed debug logging
            const matches = s.solution_cluster_id === clusterId;
            if (matches || s.solution_cluster_id) {
              console.log('Checking solution:', {
                title: s.title,
                solution_cluster_id: s.solution_cluster_id,
                clusterId: clusterId,
                matches: matches,
                typeOfSolutionClusterId: typeof s.solution_cluster_id,
                typeOfClusterId: typeof clusterId
              });
            }
            return matches;
          }).slice(0, 20) // Get solutions in this solution cluster
        : solutions?.filter(s => s.source_cluster_id === clusterId); // Get solutions generated from this problem cluster
      
      // Debug log
      if (isSolutionCluster) {
        console.log('Solution Cluster Graph Debug:');
        console.log('Cluster ID:', clusterId);
        console.log('All solutions:', solutions?.length);
        console.log('Filtered solutions:', clusterSolutions?.length);
        console.log('First solution example:', solutions?.[0]);
        console.log('Looking for solutions with solution_cluster_id:', clusterId);
        // Show which solutions have solution_cluster_id set
        const solutionsWithClusterId = solutions?.filter(s => s.solution_cluster_id);
        console.log('Solutions with solution_cluster_id:', solutionsWithClusterId?.length);
        console.log('Sample solution_cluster_ids:', solutionsWithClusterId?.slice(0, 3).map(s => ({
          title: s.title,
          solution_cluster_id: s.solution_cluster_id
        })));
      }
      
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
          
          {/* Search Input - only show if we're using local search */}
          {globalFilters.searchTerm === undefined && (
            <input
              type="text"
              placeholder="Search entities..."
              value={localSearchTerm}
              onChange={(e) => setLocalSearchTerm(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg mb-3 text-sm"
            />
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

function GraphView({ initialEntityType = 'problem', filters: externalFilters, hideFilters = false }) {
  // Use external filters if provided, otherwise use internal state
  const [internalFilters, setInternalFilters] = useState({
    entityType: initialEntityType,
    impact: [],
    status: [],
    viabilityRange: [0, 100],
    hasProject: null,
    hasCluster: null,
    showOrphaned: true
  });
  
  // Use external filters if provided, otherwise use internal filters
  const globalFilters = externalFilters || internalFilters;
  const setGlobalFilters = externalFilters ? () => {} : setInternalFilters;

  return (
    <div className="space-y-4">
      {/* Advanced Filtering Header - only show if not hidden */}
      {!hideFilters && (
        <div className="bg-white rounded-lg shadow">
          <div className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold">Filters</h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Refine the {globalFilters.entityType}s shown in the graph
                </p>
              </div>
              
              {/* Reset All button */}
              <button
                onClick={() => setGlobalFilters({
                  entityType: initialEntityType,
                  impact: [],
                  status: [],
                  viabilityRange: [0, 100],
                  hasProject: null,
                  hasCluster: null,
                  showOrphaned: true
                })}
                className="px-3 py-1.5 text-xs bg-gray-100 hover:bg-gray-200 rounded transition-colors"
              >
                Reset Filters
              </button>
            </div>
          </div>
          
          {/* Filter Controls based on selected tab */}
          <div className="p-4 pt-3 border-t bg-gray-50">
            <div className="flex flex-wrap items-center gap-3">
            {/* Problems Filters */}
            {initialEntityType === 'problem' && (
              <>
                <div className="flex flex-col">
                  <label className="text-xs text-gray-500 mb-1">Impact</label>
                  <div className="flex gap-1">
                    {['high', 'medium', 'low'].map(impact => (
                    <label key={impact} className="flex items-center">
                      <input
                        type="checkbox"
                        checked={globalFilters.impact.includes(impact)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setGlobalFilters(prev => ({
                              ...prev,
                              impact: [...prev.impact, impact]
                            }));
                          } else {
                            setGlobalFilters(prev => ({
                              ...prev,
                              impact: prev.impact.filter(i => i !== impact)
                            }));
                          }
                        }}
                        className="sr-only"
                      />
                      <span className={`px-2 py-1 text-xs rounded cursor-pointer transition-colors ${
                        globalFilters.impact.includes(impact)
                          ? impact === 'high' ? 'bg-red-100 text-red-700 ring-1 ring-red-400' 
                          : impact === 'medium' ? 'bg-yellow-100 text-yellow-700 ring-1 ring-yellow-400'
                          : 'bg-blue-100 text-blue-700 ring-1 ring-blue-400'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}>
                        {impact}
                      </span>
                    </label>
                    ))}
                  </div>
                </div>

                <div className="flex flex-col">
                  <label className="text-xs text-gray-500 mb-1">Clustering</label>
                  <div className="flex gap-2">
                    <label className="flex items-center gap-1">
                      <input
                        type="checkbox"
                        checked={globalFilters.hasCluster === true}
                        onChange={(e) => setGlobalFilters(prev => ({
                          ...prev,
                          hasCluster: e.target.checked ? true : null
                        }))}
                        className="rounded text-xs"
                      />
                      <span className="text-xs">Clustered</span>
                    </label>
                    <label className="flex items-center gap-1">
                      <input
                        type="checkbox"
                        checked={globalFilters.showOrphaned}
                        onChange={(e) => setGlobalFilters(prev => ({
                          ...prev,
                          showOrphaned: e.target.checked
                        }))}
                        className="rounded text-xs"
                      />
                      <span className="text-xs">Show Orphaned</span>
                    </label>
                  </div>
                </div>
              </>
            )}

            {/* Clusters Filters */}
            {(initialEntityType === 'cluster' || initialEntityType === 'solutionCluster') && (
              <>
                <div className="flex flex-col">
                  <label className="text-xs text-gray-500 mb-1">Status</label>
                  <div className="flex gap-1">
                    {['active', 'inactive'].map(status => (
                      <label key={status} className="flex items-center">
                        <input
                          type="checkbox"
                          checked={globalFilters.status.includes(status)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setGlobalFilters(prev => ({
                                ...prev,
                                status: [...prev.status, status]
                              }));
                            } else {
                              setGlobalFilters(prev => ({
                                ...prev,
                                status: prev.status.filter(s => s !== status)
                              }));
                            }
                          }}
                          className="sr-only"
                        />
                        <span className={`px-2 py-1 text-xs rounded cursor-pointer transition-colors ${
                          globalFilters.status.includes(status)
                            ? status === 'active' ? 'bg-green-100 text-green-700 ring-1 ring-green-400' 
                            : 'bg-gray-100 text-gray-700 ring-1 ring-gray-400'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}>
                          {status}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* Solutions Filters */}
            {initialEntityType === 'solution' && (
              <>
                <div className="flex flex-col">
                <label className="text-xs text-gray-500 mb-1">Status</label>
                <div className="flex gap-1">
                  {['active', 'planned', 'inactive'].map(status => (
                    <label key={status} className="flex items-center">
                      <input
                        type="checkbox"
                        checked={globalFilters.status.includes(status)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setGlobalFilters(prev => ({
                              ...prev,
                              status: [...prev.status, status]
                            }));
                          } else {
                            setGlobalFilters(prev => ({
                              ...prev,
                              status: prev.status.filter(s => s !== status)
                            }));
                          }
                        }}
                        className="sr-only"
                      />
                      <span className={`px-2 py-1 text-xs rounded cursor-pointer transition-colors ${
                        globalFilters.status.includes(status)
                          ? status === 'active' ? 'bg-green-100 text-green-700 ring-1 ring-green-400' 
                          : status === 'planned' ? 'bg-blue-100 text-blue-700 ring-1 ring-blue-400'
                          : 'bg-gray-100 text-gray-700 ring-1 ring-gray-400'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}>
                        {status}
                      </span>
                    </label>
                  ))}
                </div>
                </div>

                <div className="flex flex-col">
                  <label className="text-xs text-gray-500 mb-1">
                    Viability: {globalFilters.viabilityRange[0]}-{globalFilters.viabilityRange[1]}%
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={globalFilters.viabilityRange[0]}
                      onChange={(e) => setGlobalFilters(prev => ({
                        ...prev,
                        viabilityRange: [parseInt(e.target.value), prev.viabilityRange[1]]
                      }))}
                      className="w-20"
                    />
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={globalFilters.viabilityRange[1]}
                      onChange={(e) => setGlobalFilters(prev => ({
                        ...prev,
                        viabilityRange: [prev.viabilityRange[0], parseInt(e.target.value)]
                      }))}
                      className="w-20"
                    />
                  </div>
                </div>

                <div className="flex flex-col">
                  <label className="text-xs text-gray-500 mb-1">Relationships</label>
                  <div className="flex gap-2">
                    <label className="flex items-center gap-1">
                      <input
                        type="checkbox"
                        checked={globalFilters.hasProject === true}
                        onChange={(e) => setGlobalFilters(prev => ({
                          ...prev,
                          hasProject: e.target.checked ? true : null
                        }))}
                        className="rounded text-xs"
                      />
                      <span className="text-xs">Has Project</span>
                    </label>
                  </div>
                </div>
              </>
            )}

            {/* Projects Filters */}
            {initialEntityType === 'project' && (
              <>
                <div className="flex flex-col">
                  <label className="text-xs text-gray-500 mb-1">Status</label>
                  <div className="flex gap-1">
                    {['active', 'planned'].map(status => (
                      <label key={status} className="flex items-center">
                        <input
                          type="checkbox"
                          checked={globalFilters.status.includes(status)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setGlobalFilters(prev => ({
                                ...prev,
                                status: [...prev.status, status]
                              }));
                            } else {
                              setGlobalFilters(prev => ({
                                ...prev,
                                status: prev.status.filter(s => s !== status)
                              }));
                            }
                          }}
                          className="sr-only"
                        />
                        <span className={`px-2 py-1 text-xs rounded cursor-pointer transition-colors ${
                          globalFilters.status.includes(status)
                            ? status === 'active' ? 'bg-green-100 text-green-700 ring-1 ring-green-400' 
                            : 'bg-blue-100 text-blue-700 ring-1 ring-blue-400'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}>
                          {status}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              </>
            )}

            </div>
          </div>
        </div>
      )}

      {/* Graph Container */}
      <ReactFlowProvider>
        <GraphViewContent globalFilters={globalFilters} initialEntityType={initialEntityType} />
      </ReactFlowProvider>
    </div>
  );
}

export default GraphView;