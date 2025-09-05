import { Router } from 'express';
import databaseService from '../services/database.service.js';
import n8nService from '../services/n8n.service.js';

const router = Router();

// === PROBLEMS ===
router.get('/problems', async (req, res) => {
  try {
    const filters = {
      cluster_id: req.query.cluster_id,
      cluster_label: req.query.cluster_label,
      impact: req.query.impact,
      industry: req.query.industry,
      business_size: req.query.business_size,
      search: req.query.search,
      has_solutions: req.query.has_solutions,
      sortBy: req.query.sortBy,
      sortOrder: req.query.sortOrder
    };
    const problems = await databaseService.getProblems(filters);
    res.json(problems);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/problems/filter-options', async (req, res) => {
  try {
    const options = await databaseService.getProblemsFilterOptions();
    res.json(options);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/problems/:id', async (req, res) => {
  try {
    const problem = await databaseService.getProblemById(req.params.id);
    if (!problem) {
      return res.status(404).json({ error: 'Problem not found' });
    }
    res.json(problem);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/problems/:id/solutions', async (req, res) => {
  try {
    const solutions = await databaseService.getSolutionsByProblem(req.params.id);
    res.json(solutions);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// === CLUSTERS ===
router.get('/clusters', async (req, res) => {
  try {
    const filters = {
      version: req.query.version,
      has_solutions: req.query.has_solutions,
      min_problems: req.query.min_problems,
      search: req.query.search,
      sortBy: req.query.sortBy,
      sortOrder: req.query.sortOrder
    };
    const clusters = await databaseService.getClusters(filters);
    res.json(clusters);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/clusters/filter-options', async (req, res) => {
  try {
    const options = await databaseService.getClustersFilterOptions();
    res.json(options);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/clusters/:id/problems', async (req, res) => {
  try {
    console.log(`Fetching problems for cluster ID: ${req.params.id}`);
    
    // First check if the cluster exists
    const clusterCheck = await databaseService.checkClusterExists(req.params.id);
    
    if (!clusterCheck.exists) {
      console.log(`Cluster ${req.params.id} not found in database`);
      // Return empty array instead of error for missing clusters
      return res.json([]);
    }
    
    const problems = await databaseService.getProblemsByClusterId(req.params.id);
    console.log(`Found ${problems.length} problems for cluster ${req.params.id}`);
    res.json(problems);
  } catch (error) {
    console.error(`Error fetching problems for cluster ${req.params.id}:`, error);
    res.status(500).json({ error: error.message });
  }
});

// === SOLUTION CLUSTERS ===
router.get('/solution-clusters', async (req, res) => {
  try {
    const filters = {
      version: req.query.version,
      has_solutions: req.query.has_solutions,
      min_solutions: req.query.min_solutions,
      search: req.query.search,
      sortBy: req.query.sortBy,
      sortOrder: req.query.sortOrder
    };
    const clusters = await databaseService.getSolutionClusters(filters);
    res.json(clusters);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/solution-clusters/:id/solutions', async (req, res) => {
  try {
    const solutions = await databaseService.getSolutionsByClusterId(req.params.id);
    res.json(solutions);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// === SOLUTIONS ===
router.get('/solutions/best-candidate', async (req, res) => {
  try {
    const bestCandidate = await databaseService.getBestSolutionCandidate();
    res.json(bestCandidate);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/solutions', async (req, res) => {
  try {
    const filters = {
      cluster_id: req.query.cluster_id,
      status: req.query.status,
      min_viability: req.query.min_viability,
      has_project: req.query.has_project,
      search: req.query.search,
      sortBy: req.query.sortBy,
      sortOrder: req.query.sortOrder
    };
    const solutions = await databaseService.getSolutions(filters);
    res.json(solutions);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/solutions/filter-options', async (req, res) => {
  try {
    const options = await databaseService.getSolutionsFilterOptions();
    res.json(options);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/solutions/:id/problems', async (req, res) => {
  try {
    const problems = await databaseService.getProblemsBySolutionId(req.params.id);
    res.json(problems);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// === DEBUG ===
router.get('/debug/orphaned-clusters', async (req, res) => {
  try {
    const result = await databaseService.getOrphanedClusterReferences();
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/debug/cluster/:id', async (req, res) => {
  try {
    const result = await databaseService.debugCluster(req.params.id);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// === PROJECTS ===
router.get('/projects', async (req, res) => {
  try {
    const projects = await databaseService.getProjects();
    res.json(projects);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// === PIPELINE ===
router.get('/pipeline/stats', async (req, res) => {
  try {
    const stats = await databaseService.getPipelineStats();
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/pipeline/status', async (req, res) => {
  try {
    const status = await n8nService.getPipelineStatus();
    res.json(status);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// === WORKFLOW TRIGGERS ===
router.post('/workflows/f1/trigger', async (req, res) => {
  try {
    const { source_url } = req.body;
    if (!source_url) {
      return res.status(400).json({ error: 'source_url is required' });
    }
    const result = await n8nService.triggerProblemIngestion(source_url);
    res.json({ success: true, result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/workflows/f2/trigger', async (req, res) => {
  try {
    const result = await n8nService.triggerClustering(req.body);
    res.json({ success: true, result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/workflows/f3/trigger', async (req, res) => {
  try {
    const { cluster_id } = req.body;
    if (!cluster_id) {
      return res.status(400).json({ error: 'cluster_id is required' });
    }
    const result = await n8nService.triggerSolutionGeneration(cluster_id);
    res.json({ success: true, result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/workflows/f4/trigger', async (req, res) => {
  try {
    const { solution_id } = req.body;
    if (!solution_id) {
      return res.status(400).json({ error: 'solution_id is required' });
    }
    const result = await n8nService.triggerProjectBirth(solution_id);
    res.json({ success: true, result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// === HEALTH CHECK ===
router.get('/health', async (req, res) => {
  try {
    // Test database connection
    await databaseService.executeQuery('SELECT 1');
    
    // Test n8n connection
    const n8nConnected = await n8nService.testConnection();
    
    res.json({
      status: 'healthy',
      database: 'connected',
      n8n: n8nConnected ? 'connected' : 'unavailable'
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      error: error.message
    });
  }
});

// === API BALANCES ===
router.get('/api-balances', async (req, res) => {
  try {
    // Try to use the real service if available
    try {
      const apiBalancesService = await import('../services/apiBalances.service.js');
      const balances = await apiBalancesService.default.getBalances();
      res.json(balances);
    } catch (serviceError) {
      // Fallback to mock data if service not available
      console.log('Using mock data for API balances');
      const balances = {
        openai: { 
          balance: 25.50, 
          usage: 74.50, 
          lastChecked: new Date().toISOString()
        },
        perplexity: { 
          balance: 8.00, 
          usage: 42.00, 
          lastChecked: new Date().toISOString()
        },
        neon: { 
          balance: 50.00, 
          usage: 0, 
          lastChecked: new Date().toISOString()
        },
        render: { 
          balance: 15.00, 
          usage: 35.00, 
          lastChecked: new Date().toISOString()
        },
        lastUpdated: new Date().toISOString()
      };
      
      res.json(balances);
    }
  } catch (error) {
    console.error('Error fetching API balances:', error);
    res.status(500).json({ error: 'Failed to fetch API balances' });
  }
});

export default router;