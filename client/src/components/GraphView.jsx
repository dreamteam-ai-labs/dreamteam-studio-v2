import React, { useCallback, useEffect, useState, useMemo, useRef } from 'react';
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
  const [activeTab, setActiveTab] = useState('entities'); // 'entities' or 'details'
  const [navigationHistory, setNavigationHistory] = useState([]); // Track entity navigation path
  const { fitView } = useReactFlow(); // Get fitView function from React Flow
  const entityListRef = useRef(null);
  const entityItemRefs = useRef({});
  
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
    queryFn: () => getSolutions({}),
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
    const [entityType, ...idParts] = focusedNodeId.split('-');
    const entityId = idParts.join('-');
    
    // Try to find in searchableItems first
    let focusedItem = searchableItems.find(item => item.id === focusedNodeId);
    
    // If not found, create it from the actual data
    if (!focusedItem) {
      let entity = null;
      
      if (entityType === 'problem') {
        entity = problems?.find(p => p.id === entityId);
      } else if (entityType === 'cluster') {
        entity = clusters?.find(c => (c.cluster_id || c.id) === entityId);
      } else if (entityType === 'solution') {
        entity = solutions?.find(s => s.id === entityId);
      } else if (entityType === 'project') {
        entity = projects?.find(p => p.id === entityId);
      }
      
      if (entity) {
        focusedItem = {
          id: focusedNodeId,
          type: entityType,
          entity: entity,
          label: entity.title || entity.name || entity.cluster_label || entity.label
        };
      }
    }
    
    if (!focusedItem) {
      return;
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
      
      // Get problems and solutions based on cluster type
      const clusterProblems = isSolutionCluster 
        ? [] // Solution clusters don't have problems
        : problems?.filter(p => p.cluster_id === clusterId).slice(0, 12);
      
      const clusterSolutions = isSolutionCluster
        ? solutions?.filter(s => s.solution_cluster_id === clusterId).slice(0, 20) // Get solutions in this solution cluster
        : solutions?.filter(s => s.source_cluster_id === clusterId); // Get solutions generated from this problem cluster
      
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
      // Check if clicking on the already focused node - if so, just re-center
      if (node.id === focusedNodeId) {
        fitView({ 
          padding: 0.2, 
          duration: 800,
          maxZoom: 1.5,
          minZoom: 0.3
        });
        return;
      }
      
      // Parse the node ID to extract entity type and ID
      const [nodeType, ...idParts] = node.id.split('-');
      const entityId = idParts.join('-'); // Rejoin in case ID has hyphens
      
      // Try to find the entity directly from our data
      let entity = null;
      
      if (nodeType === 'problem') {
        entity = problems?.find(p => p.id === entityId);
      } else if (nodeType === 'cluster') {
        entity = clusters?.find(c => (c.cluster_id || c.id) === entityId);
      } else if (nodeType === 'solution') {
        entity = solutions?.find(s => s.id === entityId);
      } else if (nodeType === 'project') {
        entity = projects?.find(p => p.id === entityId);
      }
      
      if (entity) {
        // Refocus the graph on the clicked node
        setFocusedNodeId(node.id);
        setSelectedEntity(entity);
        setActiveTab('details'); // Switch to details tab when clicking a node
        
        // Update navigation history
        setNavigationHistory(prev => {
          const newHistory = [...prev, {
            id: node.id,
            title: entity.title || entity.name || entity.cluster_label || 'Unknown',
            type: nodeType
          }].slice(-10);
          return newHistory;
        });
        
        // Auto-fit view after a short delay to allow nodes to be repositioned
        setTimeout(() => {
          fitView({ 
            padding: 0.2, 
            duration: 800,
            maxZoom: 1.5,
            minZoom: 0.3
          });
        }, 100);
      }
    }
  }, [problems, clusters, solutions, projects, focusedNodeId, fitView]);

  const handleItemSelect = (item, isFromBreadcrumb = false) => {
    setFocusedNodeId(item.id);
    setSelectedEntity(item.entity);
    setActiveTab('details'); // Switch to details tab when selecting an entity
    
    // Update navigation history
    if (!isFromBreadcrumb) {
      // Add to history (max 10 items to prevent infinite growth)
      setNavigationHistory(prev => {
        const newHistory = [...prev, {
          id: item.id,
          title: item.title || item.entity?.title || item.entity?.name || item.entity?.cluster_label || 'Unknown',
          type: item.type
        }].slice(-10);
        return newHistory;
      });
    }
    
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
  
  // Scroll to selected entity when switching to entities tab
  useEffect(() => {
    if (activeTab === 'entities' && focusedNodeId && entityItemRefs.current[focusedNodeId]) {
      // Small delay to ensure the tab content is rendered
      setTimeout(() => {
        entityItemRefs.current[focusedNodeId]?.scrollIntoView({
          behavior: 'smooth',
          block: 'center'
        });
      }, 100);
    }
  }, [activeTab, focusedNodeId]);

  // Handle breadcrumb navigation
  const navigateToBreadcrumb = useCallback((index) => {
    const breadcrumbItem = navigationHistory[index];
    if (!breadcrumbItem) return;
    
    // Find the entity
    let entity = null;
    const [nodeType, ...idParts] = breadcrumbItem.id.split('-');
    const entityId = idParts.join('-');
    
    if (nodeType === 'problem') {
      entity = problems?.find(p => p.id === entityId);
    } else if (nodeType === 'cluster') {
      entity = clusters?.find(c => (c.cluster_id || c.id) === entityId);
    } else if (nodeType === 'solution') {
      entity = solutions?.find(s => s.id === entityId);
    } else if (nodeType === 'project') {
      entity = projects?.find(p => p.id === entityId);
    }
    
    if (entity) {
      // Update selection without adding to history
      setFocusedNodeId(breadcrumbItem.id);
      setSelectedEntity(entity);
      
      // Trim history to this point
      setNavigationHistory(prev => prev.slice(0, index + 1));
      
      // Re-center the graph
      setTimeout(() => {
        fitView({ 
          padding: 0.2, 
          duration: 800,
          maxZoom: 1.5,
          minZoom: 0.3
        });
      }, 100);
    }
  }, [navigationHistory, problems, clusters, solutions, projects, fitView]);

  // Navigation functions for Details tab
  const navigateEntity = useCallback((direction) => {
    if (!focusedNodeId || filteredItems.length === 0) return;
    
    const currentIndex = filteredItems.findIndex(item => item.id === focusedNodeId);
    if (currentIndex === -1) return;
    
    let newIndex;
    if (direction === 'prev') {
      newIndex = currentIndex > 0 ? currentIndex - 1 : filteredItems.length - 1;
    } else {
      newIndex = currentIndex < filteredItems.length - 1 ? currentIndex + 1 : 0;
    }
    
    const newItem = filteredItems[newIndex];
    if (newItem) {
      setFocusedNodeId(newItem.id);
      setSelectedEntity(newItem.entity);
      // Stay in details tab when navigating
      setTimeout(() => {
        fitView({ 
          padding: 0.2, 
          duration: 800,
          maxZoom: 1.5,
          minZoom: 0.3
        });
      }, 100);
    }
  }, [focusedNodeId, filteredItems, fitView]);
  
  // Keyboard shortcuts for navigation
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Only work when in details tab and not typing in an input
      if (activeTab !== 'details' || e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        navigateEntity('prev');
      } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault();
        navigateEntity('next');
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeTab, navigateEntity]);

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
      getProblemsBySolution(solutionIdToFetch).then(response => {
        // API returns array directly, or wrapped in response.data
        const problemsData = Array.isArray(response) ? response : (response.data || []);
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
        {/* Entity Explorer with Tabs */}
        <div className="bg-white rounded-lg shadow flex-1 overflow-hidden flex flex-col">
          {/* Tab Headers */}
          <div className="border-b border-gray-200">
            <div className="flex">
              <button
                onClick={() => setActiveTab('entities')}
                className={`px-6 py-3 text-sm font-medium transition-colors ${
                  activeTab === 'entities'
                    ? 'text-primary-600 border-b-2 border-primary-600 bg-gray-50'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                Entities
              </button>
              <button
                onClick={() => setActiveTab('details')}
                className={`px-6 py-3 text-sm font-medium transition-colors ${
                  activeTab === 'details'
                    ? 'text-primary-600 border-b-2 border-primary-600 bg-gray-50'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                Details
              </button>
            </div>
          </div>
          
          {/* Navigation Breadcrumb */}
          {navigationHistory.length > 0 && (
            <div className="px-4 py-2 bg-gray-50 border-b border-gray-200 flex items-center gap-1 overflow-x-auto">
              <span className="text-xs text-gray-500 mr-2">Path:</span>
              {navigationHistory.map((item, index) => {
                // Use same colors as graph nodes
                const getItemColors = () => {
                  if (index === navigationHistory.length - 1) {
                    // Current item - stronger colors (matching graph nodes)
                    switch(item.type) {
                      case 'problem': return 'bg-blue-100 text-blue-800 border-blue-300';
                      case 'cluster': return 'bg-purple-100 text-purple-800 border-purple-300';
                      case 'solution': return 'bg-green-100 text-green-800 border-green-300';
                      case 'project': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
                      default: return 'bg-gray-100 text-gray-800 border-gray-300';
                    }
                  } else {
                    // Previous items - lighter colors on hover (matching graph nodes)
                    switch(item.type) {
                      case 'problem': return 'bg-blue-50 text-blue-700 hover:bg-blue-100 border-blue-200';
                      case 'cluster': return 'bg-purple-50 text-purple-700 hover:bg-purple-100 border-purple-200';
                      case 'solution': return 'bg-green-50 text-green-700 hover:bg-green-100 border-green-200';
                      case 'project': return 'bg-yellow-50 text-yellow-700 hover:bg-yellow-100 border-yellow-200';
                      default: return 'bg-gray-50 text-gray-700 hover:bg-gray-100 border-gray-200';
                    }
                  }
                };
                
                return (
                  <React.Fragment key={index}>
                    {index > 0 && <span className="text-gray-400 mx-1">→</span>}
                    <button
                      onClick={() => navigateToBreadcrumb(index)}
                      className={`text-xs px-2 py-1 rounded border transition-all ${getItemColors()} ${
                        index === navigationHistory.length - 1 ? 'font-medium' : ''
                      }`}
                      title={item.title}
                    >
                      <span className="mr-1">
                        {item.type === 'problem' && '⚠️'}
                        {item.type === 'cluster' && '📊'}
                        {item.type === 'solution' && '💡'}
                        {item.type === 'project' && '🚀'}
                      </span>
                      <span className="max-w-[100px] truncate inline-block align-bottom">
                        {item.title.length > 20 ? item.title.substring(0, 20) + '...' : item.title}
                      </span>
                    </button>
                  </React.Fragment>
                );
              })}
              {navigationHistory.length > 0 && (
                <button
                  onClick={() => setNavigationHistory([])}
                  className="ml-2 text-xs text-gray-500 hover:text-gray-700 px-2 py-1"
                  title="Clear navigation history"
                >
                  ✕
                </button>
              )}
            </div>
          )}
          
          {/* Tab Content */}
          <div className="flex-1 overflow-hidden p-4">
            {/* Entities Tab */}
            {activeTab === 'entities' && (
              <div className="h-full flex flex-col">
                <h3 className="text-lg font-semibold mb-4">Browse Entities</h3>
                
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
                <div className="space-y-2 overflow-y-auto flex-1" ref={entityListRef}>
            {filteredItems.slice(0, 50).map(item => (
              <div
                key={item.id}
                ref={el => entityItemRefs.current[item.id] = el}
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
            )}
            
            {/* Details Tab */}
            {activeTab === 'details' && (
              <div className="h-full flex flex-col overflow-y-auto">
                {selectedEntity ? (
                  <>
                    <div className="flex items-start justify-between mb-4">
                      <h3 className="text-lg font-semibold flex-1 pr-2">
                        {selectedEntity.title || selectedEntity.name || selectedEntity.cluster_label || 'Entity Details'}
                      </h3>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => navigateEntity('prev')}
                          className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors"
                          title="Previous entity (←)"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                          </svg>
                        </button>
                        <span className="text-xs text-gray-500 px-1">
                          {filteredItems.findIndex(item => item.id === focusedNodeId) + 1} / {filteredItems.length}
                        </span>
                        <button
                          onClick={() => navigateEntity('next')}
                          className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors"
                          title="Next entity (→)"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </button>
                      </div>
                    </div>
                    <div className="space-y-3 text-sm">
                      {/* Dynamically render ALL fields from the entity */}
                      {(() => {
                        // Define field groups for better organization
                        const fieldGroups = {
                          primary: ['id', 'identifier', 'title', 'name', 'cluster_label'],
                          descriptions: ['description', 'value_proposition', 'problem_details', 'user_context', 'success_criteria', 'primary_feature'],
                          metrics: ['overall_viability', 'technical_feasibility', 'market_demand', 'competitive_advantage', 'ltv_estimate', 'cac_estimate', 'recurring_revenue_potential', 'problem_count', 'solution_count', 'avg_similarity'],
                          classifications: ['impact', 'industry', 'business_size', 'status', 'tech_stack', 'source'],
                          relationships: ['cluster_id', 'cluster_label', 'source_cluster_id', 'source_cluster_label', 'solution_cluster_id', 'solution_cluster_label', 'solution_id', 'problem_id'],
                          external: ['source_url', 'linear_project_id', 'linear_issue_id', 'github_repo_url'],
                          metadata: ['created_at', 'updated_at', 'last_problem_fetch', 'version', 'is_outlier_bucket', 'k_value', 'outlier_threshold'],
                          ignore: ['embedding', 'embedding_normalized', 'cluster_similarity', 'solution_cluster_similarity'] // Fields to skip
                        };
                        
                        const renderedFields = new Set();
                        const renderField = (key, value) => {
                          if (value === null || value === undefined || renderedFields.has(key)) return null;
                          renderedFields.add(key);
                          
                          // Format the field name
                          const fieldName = key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                          
                          // Special rendering for different types
                          if (key === 'source_url') {
                            return (
                              <div key={key}>
                                <div className="text-xs text-gray-500 uppercase">{fieldName}</div>
                                <a href={value} target="_blank" rel="noopener noreferrer" 
                                   className="text-xs text-blue-600 hover:text-blue-800 break-all">
                                  {value}
                                </a>
                              </div>
                            );
                          }
                          
                          if (key === 'linear_project_id') {
                            return (
                              <div key={key}>
                                <div className="text-xs text-gray-500 uppercase">Linear Project</div>
                                <a href={`https://linear.app/dreamteam-ai-labs/project/${value}`} 
                                   target="_blank" rel="noopener noreferrer"
                                   className="text-xs text-blue-600 hover:text-blue-800">
                                  View in Linear →
                                </a>
                              </div>
                            );
                          }
                          
                          if (key === 'linear_issue_id') {
                            return (
                              <div key={key}>
                                <div className="text-xs text-gray-500 uppercase">Linear Issue</div>
                                <a href={`https://linear.app/dreamteam-ai-labs/issue/${value}`} 
                                   target="_blank" rel="noopener noreferrer"
                                   className="text-xs text-blue-600 hover:text-blue-800">
                                  View in Linear →
                                </a>
                              </div>
                            );
                          }
                          
                          if (key === 'github_repo_url') {
                            return (
                              <div key={key}>
                                <div className="text-xs text-gray-500 uppercase">GitHub Repository</div>
                                <a href={value} target="_blank" rel="noopener noreferrer"
                                   className="text-xs text-blue-600 hover:text-blue-800">
                                  View on GitHub →
                                </a>
                              </div>
                            );
                          }
                          
                          if (key.includes('_at') || key === 'last_problem_fetch') {
                            return (
                              <div key={key}>
                                <div className="text-xs text-gray-500 uppercase">{fieldName}</div>
                                <div className="text-xs text-gray-600">
                                  {new Date(value).toLocaleDateString('en-US', {
                                    year: 'numeric', month: 'short', day: 'numeric',
                                    hour: '2-digit', minute: '2-digit'
                                  })}
                                </div>
                              </div>
                            );
                          }
                          
                          if (typeof value === 'boolean') {
                            return (
                              <div key={key}>
                                <div className="text-xs text-gray-500 uppercase">{fieldName}</div>
                                <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                                  value ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                                }`}>
                                  {value ? 'Yes' : 'No'}
                                </span>
                              </div>
                            );
                          }
                          
                          if (key === 'impact') {
                            return (
                              <div key={key}>
                                <div className="text-xs text-gray-500 uppercase">{fieldName}</div>
                                <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                                  value === 'high' ? 'bg-red-100 text-red-700' :
                                  value === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                                  'bg-blue-100 text-blue-700'
                                }`}>
                                  {value.toUpperCase()}
                                </span>
                              </div>
                            );
                          }
                          
                          if (key === 'status') {
                            return (
                              <div key={key}>
                                <div className="text-xs text-gray-500 uppercase">{fieldName}</div>
                                <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                                  value === 'active' ? 'bg-green-100 text-green-700' :
                                  value === 'planned' ? 'bg-blue-100 text-blue-700' :
                                  'bg-gray-100 text-gray-700'
                                }`}>
                                  {value.toUpperCase()}
                                </span>
                              </div>
                            );
                          }
                          
                          if (key.includes('viability') || key.includes('feasibility') || key.includes('demand') || key.includes('advantage')) {
                            return (
                              <div key={key}>
                                <div className="text-xs text-gray-500 uppercase">{fieldName}</div>
                                <div className="flex items-center gap-2">
                                  <span className="font-medium">{value}%</span>
                                  <div className="flex-1 bg-gray-200 rounded-full h-2 max-w-[100px]">
                                    <div className={`h-2 rounded-full ${
                                      value >= 70 ? 'bg-green-500' :
                                      value >= 50 ? 'bg-yellow-500' : 'bg-red-500'
                                    }`} style={{width: `${value}%`}} />
                                  </div>
                                </div>
                              </div>
                            );
                          }
                          
                          if (key === 'tech_stack' && Array.isArray(value)) {
                            return (
                              <div key={key}>
                                <div className="text-xs text-gray-500 uppercase">{fieldName}</div>
                                <div className="flex flex-wrap gap-1 mt-1">
                                  {value.map((tech, i) => (
                                    <span key={i} className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded text-xs">
                                      {tech}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            );
                          }
                          
                          // Long text fields
                          if (fieldGroups.descriptions.includes(key)) {
                            return (
                              <div key={key}>
                                <div className="text-xs text-gray-500 uppercase">{fieldName}</div>
                                <div className="text-xs text-gray-700 whitespace-pre-wrap">{value}</div>
                              </div>
                            );
                          }
                          
                          // Default rendering
                          return (
                            <div key={key}>
                              <div className="text-xs text-gray-500 uppercase">{fieldName}</div>
                              <div className="text-xs font-medium">{
                                typeof value === 'object' ? JSON.stringify(value, null, 2) : value
                              }</div>
                            </div>
                          );
                        };
                        
                        // Render all fields in groups
                        const sections = [];
                        
                        // Primary fields
                        const primaryFields = Object.entries(selectedEntity)
                          .filter(([k]) => fieldGroups.primary.includes(k))
                          .map(([k, v]) => renderField(k, v))
                          .filter(Boolean);
                        if (primaryFields.length > 0) {
                          sections.push(
                            <div key="primary" className="space-y-2 pb-3 border-b">
                              {primaryFields}
                            </div>
                          );
                        }
                        
                        // Description fields
                        const descFields = Object.entries(selectedEntity)
                          .filter(([k]) => fieldGroups.descriptions.includes(k))
                          .map(([k, v]) => renderField(k, v))
                          .filter(Boolean);
                        if (descFields.length > 0) {
                          sections.push(
                            <div key="descriptions" className="space-y-2 pb-3 border-b">
                              <div className="text-xs font-semibold text-gray-700 uppercase mb-1">Details</div>
                              {descFields}
                            </div>
                          );
                        }
                        
                        // Metrics
                        const metricFields = Object.entries(selectedEntity)
                          .filter(([k]) => fieldGroups.metrics.includes(k))
                          .map(([k, v]) => renderField(k, v))
                          .filter(Boolean);
                        if (metricFields.length > 0) {
                          sections.push(
                            <div key="metrics" className="space-y-2 pb-3 border-b">
                              <div className="text-xs font-semibold text-gray-700 uppercase mb-1">Metrics</div>
                              {metricFields}
                            </div>
                          );
                        }
                        
                        // Classifications
                        const classFields = Object.entries(selectedEntity)
                          .filter(([k]) => fieldGroups.classifications.includes(k))
                          .map(([k, v]) => renderField(k, v))
                          .filter(Boolean);
                        if (classFields.length > 0) {
                          sections.push(
                            <div key="classifications" className="space-y-2 pb-3 border-b">
                              <div className="text-xs font-semibold text-gray-700 uppercase mb-1">Classifications</div>
                              {classFields}
                            </div>
                          );
                        }
                        
                        // Relationships
                        const relFields = Object.entries(selectedEntity)
                          .filter(([k]) => fieldGroups.relationships.includes(k))
                          .map(([k, v]) => renderField(k, v))
                          .filter(Boolean);
                        if (relFields.length > 0) {
                          sections.push(
                            <div key="relationships" className="space-y-2 pb-3 border-b">
                              <div className="text-xs font-semibold text-gray-700 uppercase mb-1">Relationships</div>
                              {relFields}
                            </div>
                          );
                        }
                        
                        // External links
                        const extFields = Object.entries(selectedEntity)
                          .filter(([k]) => fieldGroups.external.includes(k))
                          .map(([k, v]) => renderField(k, v))
                          .filter(Boolean);
                        if (extFields.length > 0) {
                          sections.push(
                            <div key="external" className="space-y-2 pb-3 border-b">
                              <div className="text-xs font-semibold text-gray-700 uppercase mb-1">External Links</div>
                              {extFields}
                            </div>
                          );
                        }
                        
                        // Metadata
                        const metaFields = Object.entries(selectedEntity)
                          .filter(([k]) => fieldGroups.metadata.includes(k))
                          .map(([k, v]) => renderField(k, v))
                          .filter(Boolean);
                        if (metaFields.length > 0) {
                          sections.push(
                            <div key="metadata" className="space-y-2 pb-3 border-b">
                              <div className="text-xs font-semibold text-gray-700 uppercase mb-1">Metadata</div>
                              {metaFields}
                            </div>
                          );
                        }
                        
                        // Any remaining fields not in groups
                        const allGroupedFields = Object.values(fieldGroups).flat();
                        const otherFields = Object.entries(selectedEntity)
                          .filter(([k]) => !allGroupedFields.includes(k) && !fieldGroups.ignore.includes(k))
                          .map(([k, v]) => renderField(k, v))
                          .filter(Boolean);
                        if (otherFields.length > 0) {
                          sections.push(
                            <div key="other" className="space-y-2">
                              <div className="text-xs font-semibold text-gray-700 uppercase mb-1">Additional Fields</div>
                              {otherFields}
                            </div>
                          );
                        }
                        
                        return sections;
                      })()}
                    </div>
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-gray-400">
                    <svg className="w-16 h-16 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} 
                        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <p className="text-sm">No entity selected</p>
                    <p className="text-xs mt-1">Click an entity to view details</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
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