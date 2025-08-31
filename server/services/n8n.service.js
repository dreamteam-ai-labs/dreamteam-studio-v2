import dotenv from 'dotenv';
dotenv.config();

/**
 * n8n Integration Service
 * Handles communication with n8n workflows
 */
class N8nService {
  constructor() {
    this.webhookUrl = process.env.N8N_WEBHOOK_URL;
    this.apiKey = process.env.N8N_API_KEY;
    
    // Define workflow endpoints
    this.workflows = {
      f1_ingest: `${this.webhookUrl}/f1-problem-ingestion`,
      f2_cluster: `${this.webhookUrl}/f2-clustering`,
      f3_generate: `${this.webhookUrl}/f3-generate-solutions`,
      f4_birth: `${this.webhookUrl}/f4-project-birth`,
      pipeline_status: `${this.webhookUrl}/pipeline-status`
    };
  }

  /**
   * Trigger F1: Problem Ingestion
   */
  async triggerProblemIngestion(sourceUrl) {
    try {
      const response = await fetch(this.workflows.f1_ingest, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': this.apiKey
        },
        body: JSON.stringify({ 
          source_url: sourceUrl,
          triggered_by: 'studio-v2'
        })
      });

      if (!response.ok) {
        throw new Error(`n8n responded with ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error triggering F1:', error);
      throw error;
    }
  }

  /**
   * Trigger F2: Clustering
   */
  async triggerClustering(options = {}) {
    try {
      const response = await fetch(this.workflows.f2_cluster, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': this.apiKey
        },
        body: JSON.stringify({
          force_recluster: options.forceRecluster || false,
          min_cluster_size: options.minClusterSize || 5,
          triggered_by: 'studio-v2'
        })
      });

      if (!response.ok) {
        throw new Error(`n8n responded with ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error triggering F2:', error);
      throw error;
    }
  }

  /**
   * Trigger F3: Solution Generation
   */
  async triggerSolutionGeneration(clusterId) {
    try {
      const response = await fetch(this.workflows.f3_generate, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': this.apiKey
        },
        body: JSON.stringify({
          cluster_id: clusterId,
          triggered_by: 'studio-v2'
        })
      });

      if (!response.ok) {
        throw new Error(`n8n responded with ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error triggering F3:', error);
      throw error;
    }
  }

  /**
   * Trigger F4: Project Birth
   */
  async triggerProjectBirth(solutionId) {
    try {
      const response = await fetch(this.workflows.f4_birth, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': this.apiKey
        },
        body: JSON.stringify({
          solution_id: solutionId,
          triggered_by: 'studio-v2'
        })
      });

      if (!response.ok) {
        throw new Error(`n8n responded with ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error triggering F4:', error);
      throw error;
    }
  }

  /**
   * Get pipeline status from n8n
   */
  async getPipelineStatus() {
    try {
      // Check if webhook URL is configured
      if (!this.webhookUrl) {
        return {
          f1: { last_run: null, status: 'not_configured' },
          f2: { last_run: null, status: 'not_configured' },
          f3: { last_run: null, status: 'not_configured' },
          f4: { last_run: null, status: 'not_configured' }
        };
      }

      const response = await fetch(this.workflows.pipeline_status, {
        method: 'GET',
        headers: {
          'X-API-Key': this.apiKey
        }
      }).catch((fetchError) => {
        // Handle connection errors gracefully
        if (fetchError.cause?.code === 'ECONNREFUSED') {
          console.log('n8n service not running - workflows unavailable');
        }
        return null;
      });

      if (!response) {
        return {
          f1: { last_run: null, status: 'offline' },
          f2: { last_run: null, status: 'offline' },
          f3: { last_run: null, status: 'offline' },
          f4: { last_run: null, status: 'offline' }
        };
      }

      if (!response.ok) {
        // If endpoint doesn't exist, return mock data
        if (response.status === 404) {
          return {
            f1: { last_run: null, status: 'idle' },
            f2: { last_run: null, status: 'idle' },
            f3: { last_run: null, status: 'idle' },
            f4: { last_run: null, status: 'idle' }
          };
        }
        throw new Error(`n8n responded with ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error getting pipeline status:', error.message);
      // Return default status if n8n is not available
      return {
        f1: { last_run: null, status: 'unavailable' },
        f2: { last_run: null, status: 'unavailable' },
        f3: { last_run: null, status: 'unavailable' },
        f4: { last_run: null, status: 'unavailable' }
      };
    }
  }

  /**
   * Test n8n connection
   */
  async testConnection() {
    try {
      // Check if webhook URL is configured
      if (!this.webhookUrl) {
        return false;
      }

      const response = await fetch(`${this.webhookUrl}/health`, {
        method: 'GET',
        headers: {
          'X-API-Key': this.apiKey
        }
      }).catch((fetchError) => {
        // Handle connection errors gracefully
        if (fetchError.cause?.code === 'ECONNREFUSED') {
          console.log('n8n service not running');
        }
        return null;
      });

      return response ? response.ok : false;
    } catch (error) {
      // Silently fail - n8n is optional
      return false;
    }
  }
}

export default new N8nService();