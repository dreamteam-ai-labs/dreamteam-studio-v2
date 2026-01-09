import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor for auth (future use)
api.interceptors.request.use(
  (config) => {
    // Add auth token if available
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    console.error('API Error:', error);
    return Promise.reject(error);
  }
);

// === API Methods ===

// Problems
export const getProblems = (filters = {}) => api.get('/problems', { params: filters });
export const getProblemById = (id) => api.get(`/problems/${id}`);
export const getProblemsFilterOptions = () => api.get('/problems/filter-options');

// Clusters
export const getClusters = (filters = {}, entityType = 'problem') => {
  const endpoint = entityType === 'solution' ? '/solution-clusters' : '/clusters';
  return api.get(endpoint, { params: filters });
};
export const getClusterById = (clusterId) => api.get(`/clusters/${clusterId}`);
export const getProblemsByCluster = (clusterId) => api.get(`/clusters/${clusterId}/problems`);
export const getClustersFilterOptions = () => api.get('/clusters/filter-options');
export const getSolutionClustersFilterOptions = () => api.get('/solution-clusters/filter-options');

// Solutions
export const getSolutions = (filters = {}) => api.get('/solutions', { params: filters });
export const getProblemsBySolution = (solutionId) => api.get(`/solutions/${solutionId}/problems`);
export const getSolutionsFilterOptions = () => api.get('/solutions/filter-options');
export const getSolutionsByCluster = (clusterId) => api.get('/solutions', { params: { cluster_id: clusterId } });
export const getSolutionsBySolutionCluster = (clusterId) => api.get(`/solution-clusters/${clusterId}/solutions`);
export const getSolutionsByProblem = (problemId) => api.get(`/problems/${problemId}/solutions`);
export const getBestSolutionCandidate = () => api.get('/solutions/best-candidate');
export const createProductFromSolution = (solutionId) => api.post(`/solutions/${solutionId}/create-product`);

// Solution CRUD
export const createSolution = (data) => api.post('/solutions', data);
export const updateSolution = (id, data) => api.put(`/solutions/${id}`, data);
export const deleteSolutions = (ids) => api.delete('/solutions', { data: { ids } });

// Solution AI helpers
export const getCloneSuggestion = (excludeUrls = []) => {
  const params = excludeUrls.length > 0 ? { exclude: excludeUrls.join(',') } : {};
  return api.get('/solutions/clone-suggestion', { params });
};
export const analyzeUrl = (url) => api.post('/solutions/analyze-url', { url });

// Projects
export const getProjects = () => api.get('/projects');
export const createCodespace = (projectId) => api.post(`/projects/${projectId}/create-codespace`);
export const getCodespaceStatus = (projectId) => api.get(`/projects/${projectId}/codespace-status`);
export const deleteCodespace = (projectId, codespaceId) => api.delete(`/projects/${projectId}/codespace`, { data: { codespaceId } });

// Product CRUD
export const deleteProducts = (ids) => api.delete('/products', { data: { ids } });

// Pipeline
export const getPipelineStats = () => api.get('/pipeline/stats');
export const getPipelineStatus = () => api.get('/pipeline/status');

// Workflow Triggers
export const triggerF1 = (sourceUrl) => api.post('/workflows/f1/trigger', { source_url: sourceUrl });
export const triggerF2 = (options = {}) => api.post('/workflows/f2/trigger', options);
export const triggerF3 = (clusterId) => api.post('/workflows/f3/trigger', { cluster_id: clusterId });
export const triggerF4 = (solutionId) => api.post('/workflows/f4/trigger', { solution_id: solutionId });

// Health Check
export const checkHealth = () => api.get('/health');

// API Balances
export const getApiBalances = () => api.get('/api-balances');

// Clustering Scenarios
export const getClusteringConfig = (entityType) => api.get(`/clustering-config/${entityType}`);
export const createClusteringScenario = (data) => api.post('/clustering-scenarios', data);
export const getClusteringScenarios = (entityType, status) => {
  const params = {};
  if (entityType) params.entityType = entityType;
  if (status) params.status = status;
  return api.get('/clustering-scenarios', { params });
};
export const getClusteringScenarioDetails = (id) => api.get(`/clustering-scenarios/${id}`);
export const deleteClusteringScenario = (id) => api.delete(`/clustering-scenarios/${id}`);
export const applyScenarioToProduction = (id) => api.post(`/clustering-scenarios/${id}/apply`);

export default api;