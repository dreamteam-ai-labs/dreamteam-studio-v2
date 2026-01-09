import { Router } from 'express';
import fetch from 'node-fetch';
import databaseService from '../services/database.service.js';
import n8nService from '../services/n8n.service.js';
import codespaceService from '../services/codespace.service.js';
import githubService from '../services/github.service.js';
import gcpService from '../services/gcp.service.js';
import llmService from '../services/llm.service.js';

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

router.get('/clusters/:id', async (req, res) => {
  try {
    const cluster = await databaseService.getClusterById(req.params.id);
    if (!cluster) {
      return res.status(404).json({ error: 'Cluster not found' });
    }
    res.json(cluster);
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
router.get('/solution-clusters/filter-options', async (req, res) => {
  try {
    const options = await databaseService.getSolutionClustersFilterOptions();
    res.json(options);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/solution-clusters', async (req, res) => {
  try {
    const filters = {
      version: req.query.version,
      has_solutions: req.query.has_solutions,
      min_solutions: req.query.min_solutions,
      search: req.query.search,
      primary_industry: req.query.primary_industry,
      sortBy: req.query.sortBy,
      sortOrder: req.query.sortOrder
    };
    const clusters = await databaseService.getSolutionClusters(filters);
    res.json(clusters);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/solution-clusters/:id', async (req, res) => {
  try {
    const cluster = await databaseService.getSolutionClusterById(req.params.id);
    if (!cluster) {
      return res.status(404).json({ error: 'Solution cluster not found' });
    }
    res.json(cluster);
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
      industry: req.query.industry,
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

// Get a clone candidate suggestion from LLM
router.get('/solutions/clone-suggestion', async (req, res) => {
  try {
    // Parse excluded URLs from query param (comma-separated)
    const excludeUrls = req.query.exclude ? req.query.exclude.split(',') : [];
    const suggestion = await llmService.getCloneSuggestion(excludeUrls);
    res.json(suggestion);
  } catch (error) {
    console.error('Error getting clone suggestion:', error);
    res.status(500).json({ error: error.message });
  }
});

// Analyze a URL and extract product information
router.post('/solutions/analyze-url', async (req, res) => {
  try {
    const { url } = req.body;
    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }
    const analysis = await llmService.analyzeUrl(url);
    res.json(analysis);
  } catch (error) {
    console.error('Error analyzing URL:', error);
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

// Create a new solution - triggers F3 workflow
router.post('/solutions', async (req, res) => {
  try {
    const { source_url, title, description, value_proposition, target_audience,
            problem_statement, primary_feature, key_features, differentiators,
            tech_stack, revenue_model, pricing_strategy, target_industry } = req.body;

    // Require at least title or source_url
    if (!title && !source_url) {
      return res.status(400).json({ error: 'Either title or source_url is required' });
    }

    // Trigger F3 workflow - it handles URL research and/or preserves user fields
    const result = await n8nService.createSolution({
      source_url,
      title,
      description,
      value_proposition,
      target_audience,
      problem_statement,
      primary_feature,
      key_features,
      differentiators,
      tech_stack,
      revenue_model,
      pricing_strategy,
      target_industry
    });

    res.status(201).json({
      success: true,
      message: 'Solution creation triggered via F3 workflow',
      workflow_response: result
    });
  } catch (error) {
    console.error('Error creating solution:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update a solution
router.put('/solutions/:id', async (req, res) => {
  try {
    const solution = await databaseService.updateSolution(req.params.id, req.body);
    res.json(solution);
  } catch (error) {
    console.error('Error updating solution:', error);
    if (error.message === 'Solution not found') {
      return res.status(404).json({ error: error.message });
    }
    res.status(500).json({ error: error.message });
  }
});

// Delete multiple solutions (bulk)
router.delete('/solutions', async (req, res) => {
  try {
    const { ids } = req.body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'Array of solution IDs is required' });
    }

    const result = await databaseService.deleteSolutions(ids);
    res.json(result);
  } catch (error) {
    console.error('Error deleting solutions:', error);

    // Check for structured error (solutions with products)
    try {
      const errorData = JSON.parse(error.message);
      if (errorData.code === 'HAS_PRODUCTS') {
        return res.status(409).json(errorData);
      }
    } catch (e) {
      // Not a JSON error, continue with default handling
    }

    res.status(500).json({ error: error.message });
  }
});

// === PRODUCTS ===

// Delete multiple products (bulk) with GitHub repo and GCP tenant cascade
router.delete('/products', async (req, res) => {
  try {
    const { ids } = req.body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'Array of product IDs is required' });
    }

    // Delete products from database (returns GitHub repos and GCP tenants to delete)
    const result = await databaseService.deleteProducts(ids);

    // Delete GitHub repositories
    if (result.github_repos_to_delete && result.github_repos_to_delete.length > 0) {
      console.log(`Deleting ${result.github_repos_to_delete.length} GitHub repositories...`);
      const githubResult = await githubService.deleteRepositories(result.github_repos_to_delete);
      result.github_deletion = githubResult;
    }

    // Delete GCP Identity Platform tenants
    if (result.gcp_tenants_to_delete && result.gcp_tenants_to_delete.length > 0) {
      console.log(`Deleting ${result.gcp_tenants_to_delete.length} GCP tenants...`);
      const gcpResult = await gcpService.deleteTenants(result.gcp_tenants_to_delete);
      result.gcp_deletion = gcpResult;
    }

    res.json(result);
  } catch (error) {
    console.error('Error deleting products:', error);
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

// Create Codespace for a project
router.post('/projects/:id/create-codespace', async (req, res) => {

  try {
    const { id } = req.params;

    // Get project details
    const projects = await databaseService.getProjects();
    const project = projects.find(p => p.id === id);

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    if (!project.github_repo_url) {
      return res.status(400).json({ error: 'Project has no GitHub repository' });
    }

    if (project.codespace_url) {
      return res.status(400).json({ error: 'Codespace already exists for this project' });
    }

    // Extract repo name from URL
    const repoName = project.github_repo_url.replace('https://github.com/', '');

    // Create the Codespace
    const result = await codespaceService.createCodespace(id, repoName);
    res.json(result);
  } catch (error) {
    console.error('Error creating Codespace:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get Codespace status for a project
router.get('/projects/:id/codespace-status', async (req, res) => {

  try {
    const { id } = req.params;

    // Get project details
    const projects = await databaseService.getProjects();
    const project = projects.find(p => p.id === id);

    if (!project || !project.codespace_url) {
      return res.status(404).json({ error: 'No Codespace found for this project' });
    }

    // Extract Codespace ID from URL if needed
    const codespaceId = codespaceService.extractCodespaceId(project.codespace_url);
    if (!codespaceId) {
      return res.json({ state: 'unknown', url: project.codespace_url });
    }

    const status = await codespaceService.getCodespaceStatus(codespaceId);

    if (status.state === 'deleted') {
      await codespaceService.updateProjectCodespace(id, null, null);
      return res.status(404).json({ error: 'Codespace not found', state: 'deleted' });
    }

    if (status.url && status.url !== project.codespace_url) {
      await codespaceService.updateProjectCodespace(id, status.url, status.state);
    }

    res.json(status);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete Codespace for a project
router.delete('/projects/:id/codespace', async (req, res) => {

  try {
    const { id } = req.params;
    const { codespaceId } = req.body;

    if (!codespaceId) {
      return res.status(400).json({ error: 'Codespace ID required' });
    }

    const result = await codespaceService.deleteCodespace(id, codespaceId);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Clear Codespace URL for a project (when manually deleted from GitHub)
router.post('/projects/:id/clear-codespace', async (req, res) => {
  try {
    const { id } = req.params;

    // Clear the codespace URL from database
    await codespaceService.updateProjectCodespace(id, null, null);

    res.json({ success: true, message: 'Codespace URL cleared' });
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

// === DEBUG SOLUTION CLUSTERS ===
router.get('/debug/solution-source-clusters', async (req, res) => {
  try {
    // Check if solutions have source_cluster_id
    const solutionCheck = await databaseService.executeQuery(`
      SELECT 
        COUNT(*) as total_solutions,
        COUNT(source_cluster_id) as solutions_with_cluster,
        COUNT(*) - COUNT(source_cluster_id) as solutions_without_cluster
      FROM dreamteam.solutions
    `);
    
    // Check what the getClusters query returns
    const clusterCounts = await databaseService.executeQuery(`
      WITH active_version AS (
        SELECT COALESCE(
          (SELECT version FROM dreamteam.cluster_versions WHERE is_active = true),
          (SELECT MAX(version) FROM dreamteam.cluster_centroids)
        ) as version
      ),
      cluster_data AS (
        SELECT 
          c.cluster_id,
          c.cluster_label,
          COUNT(DISTINCT p.id) as problem_count,
          COUNT(DISTINCT s.id) as solution_count
        FROM dreamteam.cluster_centroids c
        LEFT JOIN dreamteam.problems p ON p.cluster_id = c.cluster_id
        LEFT JOIN dreamteam.solutions s ON s.source_cluster_id = c.cluster_id
        WHERE c.version = (SELECT version FROM active_version)
        GROUP BY c.cluster_id, c.cluster_label
      )
      SELECT * FROM cluster_data
      WHERE solution_count > 0
      ORDER BY solution_count DESC
    `);
    
    // Sample solutions
    const sampleSolutions = await databaseService.executeQuery(`
      SELECT 
        id,
        title,
        source_cluster_id,
        source_cluster_label,
        created_at
      FROM dreamteam.solutions
      LIMIT 10
    `);
    
    res.json({
      solutionStats: solutionCheck[0] || {},
      clustersWithSolutions: clusterCounts || [],
      sampleSolutions: sampleSolutions || []
    });
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

// === CLUSTERING SCENARIOS ===

// Get current clustering configuration
router.get('/clustering-config/:entityType', async (req, res) => {
  try {
    const { entityType } = req.params;
    
    if (!['problem', 'solution'].includes(entityType)) {
      return res.status(400).json({ error: 'Invalid entity type' });
    }
    
    const config = await databaseService.getClusteringConfig(entityType);
    res.json(config);
  } catch (error) {
    console.error('Error fetching clustering config:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/clustering-scenarios', async (req, res) => {
  try {
    const { entity_type, k_value, similarity_threshold, requested_by, notes } = req.body;
    
    // Validate inputs
    if (!entity_type || !k_value || !similarity_threshold) {
      return res.status(400).json({ 
        error: 'Missing required fields: entity_type, k_value, similarity_threshold' 
      });
    }
    
    const scenarioId = await databaseService.createClusteringScenario(
      entity_type,
      k_value,
      similarity_threshold,
      requested_by,
      notes
    );
    
    res.json({ id: scenarioId, status: 'pending' });
  } catch (error) {
    console.error('Error creating clustering scenario:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/clustering-scenarios', async (req, res) => {
  try {
    const { entityType, status } = req.query;
    const scenarios = await databaseService.getClusteringScenarios(entityType, status);
    res.json(scenarios);
  } catch (error) {
    console.error('Error fetching clustering scenarios:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/clustering-scenarios/:id', async (req, res) => {
  try {
    const scenario = await databaseService.getClusteringScenarioDetails(req.params.id);
    if (!scenario) {
      return res.status(404).json({ error: 'Scenario not found' });
    }
    res.json(scenario);
  } catch (error) {
    console.error('Error fetching scenario details:', error);
    res.status(500).json({ error: error.message });
  }
});

router.delete('/clustering-scenarios/:id', async (req, res) => {
  try {
    await databaseService.deleteClusteringScenario(req.params.id);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting scenario:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/clustering-scenarios/:id/apply', async (req, res) => {
  try {
    const result = await databaseService.applyScenarioToProduction(req.params.id);
    res.json(result);
  } catch (error) {
    console.error('Error applying scenario to production:', error);
    res.status(500).json({ error: error.message });
  }
});

// === PRODUCT CREATION ===
router.post('/solutions/:id/create-product', async (req, res) => {
  try {
    const solutionId = req.params.id;
    console.log('Creating product for solution:', solutionId);
    
    // First check if solution exists and doesn't already have a project
    const solution = await databaseService.getSolutionById(solutionId);
    if (!solution) {
      console.error('Solution not found:', solutionId);
      return res.status(404).json({ error: 'Solution not found' });
    }
    
    if (solution.linear_project_id) {
      console.log('Solution already has a project:', solution.linear_project_id);
      return res.status(400).json({ error: 'Solution already has a project' });
    }
    
    // Trigger n8n webhook for F4-Create-Product
    const baseWebhookUrl = process.env.N8N_WEBHOOK_URL || 'http://localhost:5678/webhook';
    const webhookUrl = `${baseWebhookUrl}/f4-create-product`;
    console.log('Triggering F4 webhook:', webhookUrl);
    
    const webhookData = {
      solution_id: solutionId,
      triggered_by: 'ui_manual',
      timestamp: new Date().toISOString()
    };
    
    console.log('Webhook payload:', webhookData);
    
    let response;
    try {
      response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(webhookData)
      });
      
      console.log('Webhook response status:', response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Webhook error response:', errorText);
        throw new Error(`n8n webhook failed: ${response.statusText} - ${errorText}`);
      }
    } catch (fetchError) {
      if (fetchError.code === 'ECONNREFUSED') {
        console.error('n8n is not running or webhook not configured');
        throw new Error('Product creation service is not available. Please ensure n8n is running and the webhook is configured.');
      }
      throw fetchError;
    }
    
    res.json({ 
      success: true, 
      message: 'Product creation initiated',
      solution_id: solutionId 
    });
  } catch (error) {
    console.error('Error triggering product creation - Full error:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({ error: error.message });
  }
});

export default router;