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
    const problems = await databaseService.getProblemsByClusterId(req.params.id);
    res.json(problems);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// === SOLUTIONS ===
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

export default router;