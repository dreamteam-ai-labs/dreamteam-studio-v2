import React, { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLocation } from 'react-router-dom';
import ProblemsTableMultiLevel from './ProblemsTableMultiLevel';
import ClustersTable from './ClustersTable';
import SolutionsTable from './SolutionsTable';
import ProjectsTable from './ProjectsTable';
import GraphView from './GraphView';
import { getProblemsFilterOptions, getClustersFilterOptions, getSolutionsFilterOptions } from '../services/api';

function EntityView({ entityType }) {
  const location = useLocation();
  const [viewMode, setViewMode] = useState('table');
  const [dataMode, setDataMode] = useState(() => {
    // Check if we're navigating from Dashboard with cluster view
    if (location.state?.viewMode === 'cluster' && entityType === 'problem') {
      return 'clusters';
    }
    return 'individual';
  }); // 'individual' or 'clusters'
  const [filteredData, setFilteredData] = useState([]); // Store filtered data from tables
  const [isFiltersCollapsed, setIsFiltersCollapsed] = useState(() => {
    const saved = localStorage.getItem('entityview-filters-collapsed');
    return saved === 'true';
  });
  
  // Unified filters state - these affect both table and graph views
  const [filters, setFilters] = useState({
    // Common filters
    searchTerm: '',
    
    // Problem-specific filters (matching all 9 columns)
    title: '',
    description: '',
    cluster_label: '',
    impact: [],
    industry: [],
    businessSize: [],
    solution_count: null,
    project_count: null,
    created_at: null,
    
    // Cluster-specific filters (matching all 5 columns)
    problem_count: null,
    avg_similarity: null,
    
    // Solution-specific filters (matching all 8 columns)
    overall_viability: [0, 100],
    ltv_cac: null,
    revenue: null,
    source_cluster: '',
    
    // Project-specific filters (matching all 6 columns)
    name: '',
    github: '',
    linear: '',
    viability: null,
    
    // Shared filters
    status: [],
    hasCluster: null,
    showOrphaned: true,
    hasProject: null,
    
    // Pagination
    currentPage: 1,
    itemsPerPage: 20,
  });

  // Calculate dynamic filter options from filtered data
  const dynamicFilterOptions = useMemo(() => {
    if (!filteredData || filteredData.length === 0) {
      return {
        clusters: [],
        industries: [],
        businessSizes: [],
        impacts: ['high', 'medium', 'low'],
        statuses: [],
        sourceClusters: []
      };
    }

    const options = {
      clusters: [],
      industries: [],
      businessSizes: [],
      impacts: [],
      statuses: [],
      sourceClusters: []
    };

    // Extract unique values based on entity type
    if (entityType === 'problem') {
      const clusterSet = new Set();
      const industrySet = new Set();
      const businessSizeSet = new Set();
      const impactSet = new Set();
      
      filteredData.forEach(item => {
        if (item.cluster_label) clusterSet.add(item.cluster_label);
        if (item.industry) industrySet.add(item.industry);
        if (item.business_size) businessSizeSet.add(item.business_size);
        if (item.impact) impactSet.add(item.impact);
      });
      
      options.clusters = Array.from(clusterSet).sort();
      options.industries = Array.from(industrySet).sort();
      options.businessSizes = Array.from(businessSizeSet).sort();
      options.impacts = Array.from(impactSet).sort((a, b) => {
        const order = { high: 1, medium: 2, low: 3 };
        return (order[a] || 99) - (order[b] || 99);
      });
    } else if (dataMode === 'clusters' && (entityType === 'problem' || entityType === 'solution')) {
      const statusSet = new Set();
      filteredData.forEach(item => {
        // Determine status based on solution count
        const status = item.solution_count > 0 ? 'has-solutions' : 'no-solutions';
        statusSet.add(status);
      });
      options.statuses = Array.from(statusSet).sort();
    } else if (entityType === 'solution') {
      const statusSet = new Set();
      const sourceClusterSet = new Set();
      
      filteredData.forEach(item => {
        if (item.status) statusSet.add(item.status);
        if (item.source_cluster_label) sourceClusterSet.add(item.source_cluster_label);
      });
      
      options.statuses = Array.from(statusSet).sort();
      options.sourceClusters = Array.from(sourceClusterSet).sort();
    } else if (entityType === 'project') {
      const statusSet = new Set();
      filteredData.forEach(item => {
        statusSet.add(item.status || 'active');
      });
      options.statuses = Array.from(statusSet).sort();
    }

    return options;
  }, [filteredData, entityType]);

  // Fetch filter options based on entity type and data mode
  const { data: filterOptions } = useQuery({
    queryKey: [`${entityType}-${dataMode}-filter-options`],
    queryFn: () => {
      // If in clusters mode, get cluster filter options
      if (dataMode === 'clusters' && (entityType === 'problem' || entityType === 'solution')) {
        return getClustersFilterOptions();
      }
      // Otherwise get individual item filter options
      switch (entityType) {
        case 'problem':
          return getProblemsFilterOptions();
        case 'solution':
          return getSolutionsFilterOptions();
        default:
          return Promise.resolve({});
      }
    },
    enabled: ['problem', 'solution'].includes(entityType),
  });

  // Reset filters when entity type changes
  useEffect(() => {
    setFilters({
      searchTerm: '',
      title: '',
      description: '',
      cluster_label: '',
      impact: [],
      industry: [],
      businessSize: [],
      solution_count: null,
      project_count: null,
      created_at: null,
      problem_count: null,
      avg_similarity: null,
      overall_viability: [0, 100],
      ltv_cac: null,
      revenue: null,
      source_cluster: '',
      name: '',
      github: '',
      linear: '',
      viability: null,
      status: [],
      hasCluster: null,
      showOrphaned: true,
      hasProject: null,
      currentPage: 1,
      itemsPerPage: 20,
    });
    setFilteredData([]);
  }, [entityType]);

  // Get the appropriate table component based on entity type and data mode
  const getTableComponent = () => {
    // If in clusters mode, show clusters table
    if (dataMode === 'clusters' && (entityType === 'problem' || entityType === 'solution')) {
      return <ClustersTable 
        filters={filters} 
        onFiltersChange={setFilters} 
        onDataFiltered={setFilteredData} 
        entityType={entityType} 
      />;
    }
    
    // Otherwise show individual items table
    switch (entityType) {
      case 'problem':
        return <ProblemsTableMultiLevel filters={filters} onFiltersChange={setFilters} onDataFiltered={setFilteredData} />;
      case 'solution':
        return <SolutionsTable filters={filters} onFiltersChange={setFilters} onDataFiltered={setFilteredData} />;
      case 'project':
        return <ProjectsTable filters={filters} onFiltersChange={setFilters} onDataFiltered={setFilteredData} />;
      default:
        return <ProblemsTableMultiLevel filters={filters} onFiltersChange={setFilters} onDataFiltered={setFilteredData} />;
    }
  };

  const handleResetFilters = () => {
    setFilters({
      searchTerm: '',
      title: '',
      description: '',
      cluster_label: '',
      impact: [],
      industry: [],
      businessSize: [],
      solution_count: null,
      project_count: null,
      created_at: null,
      problem_count: null,
      avg_similarity: null,
      overall_viability: [0, 100],
      ltv_cac: null,
      revenue: null,
      source_cluster: '',
      name: '',
      github: '',
      linear: '',
      viability: null,
      status: [],
      hasCluster: null,
      showOrphaned: true,
      hasProject: null,
      currentPage: 1,
      itemsPerPage: 20,
    });
  };

  return (
    <div className="space-y-4">
      {/* Header with View Toggle */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold capitalize">
              {dataMode === 'clusters' ? `${entityType} Clusters` : `${entityType}s`}
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              {viewMode === 'table' ? 'Tabular data view' : 'Interactive relationship explorer'}
            </p>
          </div>
          
          <div className="flex items-center gap-4">
            {/* Cluster View Toggle - Only show for problems and solutions */}
            {(entityType === 'problem' || entityType === 'solution') && (
              <>
                <label className="flex items-center gap-2 cursor-pointer">
                  <span className="text-sm text-gray-700">Cluster View</span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={dataMode === 'clusters'}
                    onClick={() => setDataMode(dataMode === 'clusters' ? 'individual' : 'clusters')}
                    className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 ${
                      dataMode === 'clusters' ? 'bg-primary-600' : 'bg-gray-200'
                    }`}
                  >
                    <span
                      aria-hidden="true"
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                        dataMode === 'clusters' ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </label>
                <div className="h-6 w-px bg-gray-300" /> {/* Divider */}
              </>
            )}
            
            <span className="text-sm text-gray-500">View:</span>
            <div className="bg-gray-100 rounded-lg p-1 flex">
              <button
                onClick={() => setViewMode('table')}
                className={`px-3 py-1.5 text-sm rounded transition-all ${
                  viewMode === 'table'
                    ? 'bg-white text-gray-900 shadow-sm font-medium'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <span className="flex items-center gap-1.5">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                      d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  Table
                </span>
              </button>
              <button
                onClick={() => setViewMode('graph')}
                className={`px-3 py-1.5 text-sm rounded transition-all ${
                  viewMode === 'graph'
                    ? 'bg-white text-gray-900 shadow-sm font-medium'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <span className="flex items-center gap-1.5">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                      d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  Graph
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Unified Filters Section */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-sm font-semibold">Filters</h3>
              <p className="text-xs text-gray-500 mt-0.5">
                Applied to both table and graph views - showing options from current data
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  const newState = !isFiltersCollapsed;
                  setIsFiltersCollapsed(newState);
                  localStorage.setItem('entityview-filters-collapsed', newState.toString());
                }}
                className="px-3 py-1.5 text-xs bg-blue-100 hover:bg-blue-200 text-blue-700 rounded transition-colors flex items-center gap-1"
                title={isFiltersCollapsed ? "Show advanced filters" : "Hide advanced filters"}
              >
                <span>{isFiltersCollapsed ? 'Show Advanced' : 'Hide Advanced'}</span>
                <svg 
                  className={`w-3 h-3 transition-transform ${isFiltersCollapsed ? 'rotate-180' : ''}`}
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              <button
                onClick={handleResetFilters}
                className="px-3 py-1.5 text-xs bg-gray-100 hover:bg-gray-200 rounded transition-colors"
              >
                Reset Filters
              </button>
            </div>
          </div>

          {/* Search Bar - Always visible */}
          <div className="mb-3">
            <input
              type="text"
              placeholder={`Search all ${entityType} fields...`}
              value={filters.searchTerm}
              onChange={(e) => setFilters(prev => ({ ...prev, searchTerm: e.target.value }))}
              className="w-full px-3 py-2 border rounded-lg text-sm"
            />
          </div>

          {/* Entity-specific filters */}
          {!isFiltersCollapsed && (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 pt-3 border-t border-gray-200">
            {/* Problem Filters - 9 columns */}
            {entityType === 'problem' && dataMode === 'individual' && (
              <>
                {/* Title Filter */}
                <div className="flex flex-col">
                  <label className="text-xs text-gray-500 mb-1">Title</label>
                  <input
                    type="text"
                    value={filters.title}
                    onChange={(e) => setFilters(prev => ({ ...prev, title: e.target.value }))}
                    placeholder="Filter by title"
                    className="text-sm border rounded px-2 py-1"
                  />
                </div>

                {/* Description Filter */}
                <div className="flex flex-col">
                  <label className="text-xs text-gray-500 mb-1">Description</label>
                  <input
                    type="text"
                    value={filters.description}
                    onChange={(e) => setFilters(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Filter by description"
                    className="text-sm border rounded px-2 py-1"
                  />
                </div>

                {/* Cluster Filter - Now a dropdown */}
                <div className="flex flex-col">
                  <label className="text-xs text-gray-500 mb-1">Cluster</label>
                  <select
                    value={filters.cluster_label}
                    onChange={(e) => setFilters(prev => ({ ...prev, cluster_label: e.target.value }))}
                    className="text-sm border rounded px-2 py-1"
                  >
                    <option value="">All Clusters</option>
                    {dynamicFilterOptions.clusters.map(cluster => (
                      <option key={cluster} value={cluster}>{cluster}</option>
                    ))}
                  </select>
                </div>

                {/* Impact Filter */}
                <div className="flex flex-col">
                  <label className="text-xs text-gray-500 mb-1">Impact</label>
                  <div className="flex gap-1">
                    {dynamicFilterOptions.impacts.map(impact => (
                      <label key={impact} className="flex items-center">
                        <input
                          type="checkbox"
                          checked={filters.impact.includes(impact)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setFilters(prev => ({
                                ...prev,
                                impact: [...prev.impact, impact]
                              }));
                            } else {
                              setFilters(prev => ({
                                ...prev,
                                impact: prev.impact.filter(i => i !== impact)
                              }));
                            }
                          }}
                          className="sr-only"
                        />
                        <span className={`px-2 py-1 text-xs rounded cursor-pointer transition-colors ${
                          filters.impact.includes(impact)
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

                {/* Industry Filter - Dynamic dropdown */}
                <div className="flex flex-col">
                  <label className="text-xs text-gray-500 mb-1">Industry</label>
                  <select
                    value={filters.industry[0] || ''}
                    onChange={(e) => setFilters(prev => ({
                      ...prev,
                      industry: e.target.value ? [e.target.value] : []
                    }))}
                    className="text-sm border rounded px-2 py-1"
                  >
                    <option value="">All Industries</option>
                    {dynamicFilterOptions.industries.map(ind => (
                      <option key={ind} value={ind}>{ind}</option>
                    ))}
                  </select>
                </div>

                {/* Business Size Filter - Dynamic dropdown */}
                <div className="flex flex-col">
                  <label className="text-xs text-gray-500 mb-1">Business Size</label>
                  <select
                    value={filters.businessSize[0] || ''}
                    onChange={(e) => setFilters(prev => ({
                      ...prev,
                      businessSize: e.target.value ? [e.target.value] : []
                    }))}
                    className="text-sm border rounded px-2 py-1"
                  >
                    <option value="">All Sizes</option>
                    {dynamicFilterOptions.businessSizes.map(size => (
                      <option key={size} value={size}>{size}</option>
                    ))}
                  </select>
                </div>

                {/* Solution Count Filter */}
                <div className="flex flex-col">
                  <label className="text-xs text-gray-500 mb-1">Solutions</label>
                  <input
                    type="number"
                    value={filters.solution_count || ''}
                    onChange={(e) => setFilters(prev => ({ 
                      ...prev, 
                      solution_count: e.target.value ? parseInt(e.target.value) : null 
                    }))}
                    placeholder="Min solutions"
                    min="0"
                    className="text-sm border rounded px-2 py-1"
                  />
                </div>

                {/* Project Count Filter */}
                <div className="flex flex-col">
                  <label className="text-xs text-gray-500 mb-1">Projects</label>
                  <input
                    type="number"
                    value={filters.project_count || ''}
                    onChange={(e) => setFilters(prev => ({ 
                      ...prev, 
                      project_count: e.target.value ? parseInt(e.target.value) : null 
                    }))}
                    placeholder="Min projects"
                    min="0"
                    className="text-sm border rounded px-2 py-1"
                  />
                </div>

                {/* Created Date Filter */}
                <div className="flex flex-col">
                  <label className="text-xs text-gray-500 mb-1">Created</label>
                  <input
                    type="date"
                    value={filters.created_at || ''}
                    onChange={(e) => setFilters(prev => ({ ...prev, created_at: e.target.value }))}
                    className="text-sm text-gray-700 border rounded px-2 py-1"
                  />
                </div>
              </>
            )}

            {/* Cluster Filters - 5 columns */}
            {(dataMode === 'clusters' && (entityType === 'problem' || entityType === 'solution')) && (
              <>
                {/* Cluster Label Filter */}
                <div className="flex flex-col">
                  <label className="text-xs text-gray-500 mb-1">Cluster Label</label>
                  <input
                    type="text"
                    value={filters.cluster_label}
                    onChange={(e) => setFilters(prev => ({ ...prev, cluster_label: e.target.value }))}
                    placeholder="Filter by label"
                    className="text-sm border rounded px-2 py-1"
                  />
                </div>

                {/* Problem Count Filter - Hide for solution clusters */}
                {entityType === 'cluster' && (
                <div className="flex flex-col">
                  <label className="text-xs text-gray-500 mb-1">Problems</label>
                  <input
                    type="number"
                    value={filters.problem_count || ''}
                    onChange={(e) => setFilters(prev => ({ 
                      ...prev, 
                      problem_count: e.target.value ? parseInt(e.target.value) : null 
                    }))}
                    placeholder="Min problems"
                    min="0"
                    className="text-sm border rounded px-2 py-1"
                  />
                </div>
                )}

                {/* Solution Count Filter */}
                <div className="flex flex-col">
                  <label className="text-xs text-gray-500 mb-1">Solutions</label>
                  <input
                    type="number"
                    value={filters.solution_count || ''}
                    onChange={(e) => setFilters(prev => ({ 
                      ...prev, 
                      solution_count: e.target.value ? parseInt(e.target.value) : null 
                    }))}
                    placeholder="Min solutions"
                    min="0"
                    className="text-sm border rounded px-2 py-1"
                  />
                </div>

                {/* Avg Similarity Filter */}
                <div className="flex flex-col">
                  <label className="text-xs text-gray-500 mb-1">Avg Similarity</label>
                  <input
                    type="number"
                    value={filters.avg_similarity || ''}
                    onChange={(e) => setFilters(prev => ({ 
                      ...prev, 
                      avg_similarity: e.target.value ? parseFloat(e.target.value) : null 
                    }))}
                    placeholder="Min similarity"
                    min="0"
                    max="1"
                    step="0.01"
                    className="text-sm border rounded px-2 py-1"
                  />
                </div>

                {/* Status Filter - Dynamic based on data */}
                <div className="flex flex-col">
                  <label className="text-xs text-gray-500 mb-1">Status</label>
                  <div className="flex gap-1">
                    {(dynamicFilterOptions.statuses.length > 0 ? dynamicFilterOptions.statuses : ['has-solutions', 'no-solutions']).map(status => {
                      // Display user-friendly labels
                      const displayLabel = status === 'has-solutions' ? 'Has Solutions' : 
                                         status === 'no-solutions' ? 'No Solutions' : status;
                      const colorClass = status === 'has-solutions' || status === 'active' ? 'green' : 'gray';
                      
                      return (
                        <label key={status} className="flex items-center">
                          <input
                            type="checkbox"
                            checked={filters.status.includes(status)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setFilters(prev => ({
                                  ...prev,
                                  status: [...prev.status, status]
                                }));
                              } else {
                                setFilters(prev => ({
                                  ...prev,
                                  status: prev.status.filter(s => s !== status)
                                }));
                              }
                            }}
                            className="sr-only"
                          />
                          <span className={`px-2 py-1 text-xs rounded cursor-pointer transition-colors ${
                            filters.status.includes(status)
                              ? colorClass === 'green' ? 'bg-green-100 text-green-700 ring-1 ring-green-400' 
                              : 'bg-gray-100 text-gray-700 ring-1 ring-gray-400'
                              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                          }`}>
                            {displayLabel}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              </>
            )}

            {/* Solution Filters - 8 columns */}
            {entityType === 'solution' && dataMode === 'individual' && (
              <>
                {/* Title Filter */}
                <div className="flex flex-col">
                  <label className="text-xs text-gray-500 mb-1">Title & Feature</label>
                  <input
                    type="text"
                    value={filters.title}
                    onChange={(e) => setFilters(prev => ({ ...prev, title: e.target.value }))}
                    placeholder="Filter by title"
                    className="text-sm border rounded px-2 py-1"
                  />
                </div>

                {/* Viability Filter */}
                <div className="flex flex-col">
                  <label className="text-xs text-gray-500 mb-1">
                    Viability: {filters.overall_viability[0]}-{filters.overall_viability[1]}%
                  </label>
                  <div className="flex items-center gap-1">
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={filters.overall_viability[0]}
                      onChange={(e) => setFilters(prev => ({
                        ...prev,
                        overall_viability: [parseInt(e.target.value), prev.overall_viability[1]]
                      }))}
                      className="w-16 text-xs"
                    />
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={filters.overall_viability[1]}
                      onChange={(e) => setFilters(prev => ({
                        ...prev,
                        overall_viability: [prev.overall_viability[0], parseInt(e.target.value)]
                      }))}
                      className="w-16 text-xs"
                    />
                  </div>
                </div>

                {/* LTV/CAC Filter */}
                <div className="flex flex-col">
                  <label className="text-xs text-gray-500 mb-1">LTV/CAC Ratio</label>
                  <input
                    type="number"
                    value={filters.ltv_cac || ''}
                    onChange={(e) => setFilters(prev => ({ 
                      ...prev, 
                      ltv_cac: e.target.value ? parseFloat(e.target.value) : null 
                    }))}
                    placeholder="Min ratio (e.g. 3)"
                    min="0"
                    step="0.5"
                    className="text-sm border rounded px-2 py-1"
                  />
                </div>

                {/* Revenue Filter */}
                <div className="flex flex-col">
                  <label className="text-xs text-gray-500 mb-1">Revenue</label>
                  <input
                    type="number"
                    value={filters.revenue || ''}
                    onChange={(e) => setFilters(prev => ({ 
                      ...prev, 
                      revenue: e.target.value ? parseInt(e.target.value) : null 
                    }))}
                    placeholder="Min revenue"
                    min="0"
                    className="text-sm border rounded px-2 py-1"
                  />
                </div>

                {/* Source Cluster Filter - Dynamic dropdown */}
                <div className="flex flex-col">
                  <label className="text-xs text-gray-500 mb-1">Source Cluster</label>
                  <select
                    value={filters.source_cluster}
                    onChange={(e) => setFilters(prev => ({ ...prev, source_cluster: e.target.value }))}
                    className="text-sm border rounded px-2 py-1"
                  >
                    <option value="">All Clusters</option>
                    {dynamicFilterOptions.sourceClusters.map(cluster => (
                      <option key={cluster} value={cluster}>{cluster}</option>
                    ))}
                  </select>
                </div>

                {/* Problem Count Filter */}
                <div className="flex flex-col">
                  <label className="text-xs text-gray-500 mb-1">Problems</label>
                  <input
                    type="number"
                    value={filters.problem_count || ''}
                    onChange={(e) => setFilters(prev => ({ 
                      ...prev, 
                      problem_count: e.target.value ? parseInt(e.target.value) : null 
                    }))}
                    placeholder="Min problems"
                    min="0"
                    className="text-sm border rounded px-2 py-1"
                  />
                </div>

                {/* Status Filter - Dynamic based on data */}
                <div className="flex flex-col">
                  <label className="text-xs text-gray-500 mb-1">Status</label>
                  <div className="flex gap-1">
                    {(dynamicFilterOptions.statuses.length > 0 ? dynamicFilterOptions.statuses : ['active', 'planned', 'inactive']).map(status => (
                      <label key={status} className="flex items-center">
                        <input
                          type="checkbox"
                          checked={filters.status.includes(status)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setFilters(prev => ({
                                ...prev,
                                status: [...prev.status, status]
                              }));
                            } else {
                              setFilters(prev => ({
                                ...prev,
                                status: prev.status.filter(s => s !== status)
                              }));
                            }
                          }}
                          className="sr-only"
                        />
                        <span className={`px-1.5 py-0.5 text-xs rounded cursor-pointer transition-colors ${
                          filters.status.includes(status)
                            ? status === 'active' ? 'bg-green-100 text-green-700 ring-1 ring-green-400' 
                            : status === 'planned' ? 'bg-blue-100 text-blue-700 ring-1 ring-blue-400'
                            : 'bg-gray-100 text-gray-700 ring-1 ring-gray-400'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}>
                          {status[0].toUpperCase()}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Project Filter */}
                <div className="flex flex-col">
                  <label className="text-xs text-gray-500 mb-1">Project</label>
                  <select
                    value={filters.hasProject === true ? 'yes' : filters.hasProject === false ? 'no' : ''}
                    onChange={(e) => setFilters(prev => ({
                      ...prev,
                      hasProject: e.target.value === 'yes' ? true : e.target.value === 'no' ? false : null
                    }))}
                    className="text-sm border rounded px-2 py-1"
                  >
                    <option value="">All</option>
                    <option value="yes">Has Project</option>
                    <option value="no">No Project</option>
                  </select>
                </div>
              </>
            )}

            {/* Project Filters - 6 columns */}
            {entityType === 'project' && (
              <>
                {/* Name Filter */}
                <div className="flex flex-col">
                  <label className="text-xs text-gray-500 mb-1">Project Name</label>
                  <input
                    type="text"
                    value={filters.name}
                    onChange={(e) => setFilters(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Filter by name"
                    className="text-sm border rounded px-2 py-1"
                  />
                </div>

                {/* GitHub Filter */}
                <div className="flex flex-col">
                  <label className="text-xs text-gray-500 mb-1">GitHub Repo</label>
                  <input
                    type="text"
                    value={filters.github}
                    onChange={(e) => setFilters(prev => ({ ...prev, github: e.target.value }))}
                    placeholder="Filter by repo"
                    className="text-sm border rounded px-2 py-1"
                  />
                </div>

                {/* Linear Filter */}
                <div className="flex flex-col">
                  <label className="text-xs text-gray-500 mb-1">Linear Project</label>
                  <input
                    type="text"
                    value={filters.linear}
                    onChange={(e) => setFilters(prev => ({ ...prev, linear: e.target.value }))}
                    placeholder="Filter by Linear"
                    className="text-sm border rounded px-2 py-1"
                  />
                </div>

                {/* Viability Filter */}
                <div className="flex flex-col">
                  <label className="text-xs text-gray-500 mb-1">Viability Score</label>
                  <input
                    type="number"
                    value={filters.viability || ''}
                    onChange={(e) => setFilters(prev => ({ 
                      ...prev, 
                      viability: e.target.value ? parseInt(e.target.value) : null 
                    }))}
                    placeholder="Min viability"
                    min="0"
                    max="100"
                    className="text-sm border rounded px-2 py-1"
                  />
                </div>

                {/* Status Filter - Dynamic based on data */}
                <div className="flex flex-col">
                  <label className="text-xs text-gray-500 mb-1">Status</label>
                  <div className="flex gap-1">
                    {(dynamicFilterOptions.statuses.length > 0 ? dynamicFilterOptions.statuses : ['active', 'planned']).map(status => (
                      <label key={status} className="flex items-center">
                        <input
                          type="checkbox"
                          checked={filters.status.includes(status)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setFilters(prev => ({
                                ...prev,
                                status: [...prev.status, status]
                              }));
                            } else {
                              setFilters(prev => ({
                                ...prev,
                                status: prev.status.filter(s => s !== status)
                              }));
                            }
                          }}
                          className="sr-only"
                        />
                        <span className={`px-2 py-1 text-xs rounded cursor-pointer transition-colors ${
                          filters.status.includes(status)
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

                {/* Created Date Filter */}
                <div className="flex flex-col">
                  <label className="text-xs text-gray-500 mb-1">Created</label>
                  <input
                    type="date"
                    value={filters.created_at || ''}
                    onChange={(e) => setFilters(prev => ({ ...prev, created_at: e.target.value }))}
                    className="text-sm text-gray-700 border rounded px-2 py-1"
                  />
                </div>
              </>
            )}
          </div>
          )}
        </div>
      </div>

      {/* Content Area */}
      {viewMode === 'table' ? (
        getTableComponent()
      ) : (
        <GraphView 
          initialEntityType={dataMode === 'clusters' && (entityType === 'problem' || entityType === 'solution') 
            ? (entityType === 'problem' ? 'cluster' : 'solutionCluster')
            : entityType} 
          filters={filters}
          hideFilters={true}
        />
      )}
    </div>
  );
}

export default EntityView;