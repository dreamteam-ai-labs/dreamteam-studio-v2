// Centralized table configuration for consistent styling across all tabs

// Column width presets by data type
export const COLUMN_WIDTHS = {
  // Text columns
  title: { default: '350px', min: '350px' },
  description: { default: '300px', min: '200px' },
  label: { default: '200px', min: '150px' },
  cluster_label: { default: '250px', min: '200px' },
  source_cluster: { default: '200px', min: '150px' },
  
  // Numeric columns
  count: { default: '100px', min: '80px' },
  percentage: { default: '120px', min: '100px' },
  score: { default: '120px', min: '100px' },
  similarity: { default: '120px', min: '100px' },
  
  // Status/Badge columns
  status: { default: '120px', min: '100px' },
  impact: { default: '100px', min: '80px' },
  
  // Link columns
  link: { default: '150px', min: '120px' },
  
  // Date columns
  date: { default: '120px', min: '100px' },
  
  // Business columns
  industry: { default: '150px', min: '120px' },
  business_size: { default: '120px', min: '100px' },
  
  // Financial columns
  revenue: { default: '100px', min: '80px' },
  ltv_cac: { default: '140px', min: '120px' },
};

// Map specific column keys to their types
export const COLUMN_TYPE_MAP = {
  // Problems tab
  title: 'title',
  description: 'description',
  cluster_label: 'cluster_label',
  impact: 'impact',
  industry: 'industry',
  business_size: 'business_size',
  solution_count: 'count',
  project_count: 'count',
  created_at: 'date',
  
  // Clusters tab
  problem_count: 'count',
  avg_similarity: 'similarity',
  
  // Solutions tab
  overall_viability: 'percentage',
  candidate_score: 'score',
  ltv_cac: 'ltv_cac',
  revenue: 'revenue',
  recurring_revenue_potential: 'revenue',
  source_cluster: 'source_cluster',
  status: 'status',
  project: 'link',
  
  // Projects tab
  name: 'title',
  github: 'link',
  linear: 'link',
  viability: 'percentage',
  created: 'date',
};

// Get column width configuration
export const getColumnWidth = (columnKey) => {
  const columnType = COLUMN_TYPE_MAP[columnKey];
  if (!columnType) {
    // Default for unknown columns
    return { default: '150px', min: '100px' };
  }
  return COLUMN_WIDTHS[columnType];
};

// Text alignment by column type
export const getColumnAlignment = (columnKey) => {
  const columnType = COLUMN_TYPE_MAP[columnKey];
  
  // Center align these types
  const centerAligned = ['count', 'percentage', 'score', 'similarity', 'impact', 'status', 'link', 'date', 'business_size', 'revenue'];
  
  if (centerAligned.includes(columnType)) {
    return 'center';
  }
  
  return 'left';
};

// Get header class names
export const getHeaderClassName = (columnKey, sortable = false, sortBy = null, sortOrder = null) => {
  const alignment = getColumnAlignment(columnKey);
  const alignClass = alignment === 'center' ? 'text-center' : 'text-left';
  
  let className = `px-4 py-2 ${alignClass} text-xs font-medium text-gray-500 uppercase resizable-header`;
  
  if (sortable) {
    className += ' cursor-pointer hover:bg-gray-100';
  }
  
  return className;
};

// Get cell class names
export const getCellClassName = (columnKey) => {
  const alignment = getColumnAlignment(columnKey);
  const alignClass = alignment === 'center' ? 'text-center' : 'text-left';
  
  return `px-4 py-3 text-sm text-gray-900 ${alignClass}`;
};

// Get column style
export const getColumnStyle = (columnKey, customWidth = null) => {
  const widthConfig = getColumnWidth(columnKey);
  
  // If customWidth is a number, add 'px'
  const width = customWidth 
    ? (typeof customWidth === 'number' ? `${customWidth}px` : customWidth)
    : widthConfig.default;
  
  const style = {
    width: width,
  };
  
  // Only add minWidth if no custom width is provided (not during resizing)
  if (!customWidth) {
    const columnType = COLUMN_TYPE_MAP[columnKey];
    if (columnType === 'title' || columnType === 'description' || columnType === 'label' || columnType === 'cluster_label') {
      style.minWidth = widthConfig.min;
    }
  }
  
  return style;
};

// Sort icon component helper
export const getSortIcon = (field, currentSortBy, currentSortOrder) => {
  if (currentSortBy !== field) {
    return ' ⇅';
  }
  return currentSortOrder === 'DESC' ? ' ↓' : ' ↑';
};

// Centralized column definitions for each tab
export const TAB_COLUMNS = {
  problems: [
    { key: 'title', label: 'Title', required: true, sortable: true },
    { key: 'description', label: 'Description', required: false, sortable: false },
    { key: 'cluster_label', label: 'Cluster', required: false, sortable: true },
    { key: 'impact', label: 'Impact', required: false, sortable: true },
    { key: 'industry', label: 'Industry', required: false, sortable: true },
    { key: 'business_size', label: 'Business Size', required: false, sortable: true },
    { key: 'solution_count', label: 'Solutions', required: false, sortable: true },
    { key: 'project_count', label: 'Projects', required: false, sortable: true },
    { key: 'created_at', label: 'Created', required: false, sortable: true },
  ],
  
  clusters: [
    { key: 'cluster_label', label: 'Cluster Label', required: true, sortable: true },
    { key: 'primary_industry', label: 'Industry', required: false, sortable: true },
    { key: 'problem_count', label: 'Problems', required: false, sortable: true },
    { key: 'solution_count', label: 'Solutions', required: false, sortable: true },
    { key: 'avg_similarity', label: 'Avg Similarity', required: false, sortable: true },
    { key: 'status', label: 'Status', required: false, sortable: false },
    { key: 'created_at', label: 'Created', required: false, sortable: true },
  ],
  
  solutions: [
    { key: 'title', label: 'Title & Feature', required: true, sortable: true },
    { key: 'industry', label: 'Industry', required: false, sortable: true },
    { key: 'overall_viability', label: 'Viability', required: false, sortable: true },
    { key: 'candidate_score', label: 'Score', required: false, sortable: true },
    { key: 'ltv_cac', label: 'LTV/CAC', required: false, sortable: true },
    { key: 'revenue', label: 'Revenue', required: false, sortable: true },
    { key: 'source_cluster', label: 'Source Cluster', required: false, sortable: false },
    { key: 'problem_count', label: 'Problems', required: false, sortable: true },
    { key: 'status', label: 'Status', required: false, sortable: true },
    { key: 'project', label: 'Project', required: false, sortable: false },
    { key: 'created_at', label: 'Created', required: false, sortable: true },
  ],
  
  projects: [
    { key: 'name', label: 'Project Name', required: true, sortable: false },
    { key: 'github', label: 'GitHub Repository', required: false, sortable: false },
    { key: 'linear', label: 'Linear Project', required: false, sortable: false },
    { key: 'codespace', label: 'Codespaces', required: false, sortable: false },
    { key: 'viability', label: 'Viability Score', required: false, sortable: false },
    { key: 'status', label: 'Status', required: false, sortable: false },
    { key: 'created', label: 'Created', required: false, sortable: true },
  ],
};

// Default visible columns for each tab
export const DEFAULT_VISIBLE_COLUMNS = {
  problems: ['title', 'cluster_label', 'impact', 'solution_count', 'created_at'],
  clusters: ['cluster_label', 'primary_industry', 'problem_count', 'solution_count', 'avg_similarity', 'created_at'],
  solutions: ['title', 'industry', 'overall_viability', 'candidate_score', 'revenue', 'status', 'created_at'],
  projects: ['name', 'github', 'linear', 'viability', 'status', 'created'],
};

// Get initial column widths for a tab
export const getInitialColumnWidths = (tabName) => {
  const columns = TAB_COLUMNS[tabName];
  if (!columns) return {};
  
  const widths = {};
  columns.forEach(column => {
    const widthConfig = getColumnWidth(column.key);
    // Parse the pixel value to a number
    const width = parseInt(widthConfig.default.replace('px', ''));
    widths[column.key] = width;
  });
  
  return widths;
};