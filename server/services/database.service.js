import pool from '../config/database.js';

/**
 * Database Service Layer
 * All database queries go through here, making it easy to swap to an ORM later
 */
class DatabaseService {
  // === PROBLEMS ===
  async getProblems(filters = {}) {
    try {
      let query = `
        SELECT 
          p.id,
          p.identifier,
          p.title,
          p.description,
          p.source_url,
          p.impact,
          p.industry,
          p.business_size,
          p.cluster_id,
          p.cluster_label,
          p.cluster_similarity,
          p.created_at,
          COUNT(DISTINCT psm.solution_id) as solution_count,
          COUNT(DISTINCT proj.id) as project_count
        FROM dreamteam.problems p
        LEFT JOIN dreamteam.problem_solution_map psm ON p.id = psm.problem_id
        LEFT JOIN dreamteam.solutions s ON psm.solution_id = s.id
        LEFT JOIN dreamteam.projects proj ON s.id = proj.solution_id
        WHERE 1=1
      `;
      
      const values = [];
      let paramCount = 0;

      // Add filters dynamically
      if (filters.cluster_id) {
        query += ` AND p.cluster_id = $${++paramCount}`;
        values.push(filters.cluster_id);
      }
      
      if (filters.cluster_label) {
        query += ` AND p.cluster_label = $${++paramCount}`;
        values.push(filters.cluster_label);
      }
      
      if (filters.impact) {
        query += ` AND p.impact = $${++paramCount}`;
        values.push(filters.impact);
      }
      
      if (filters.industry) {
        query += ` AND p.industry = $${++paramCount}`;
        values.push(filters.industry);
      }
      
      if (filters.business_size) {
        query += ` AND p.business_size = $${++paramCount}`;
        values.push(filters.business_size);
      }
      
      if (filters.search) {
        query += ` AND (p.title ILIKE $${++paramCount} OR p.description ILIKE $${paramCount})`;
        values.push(`%${filters.search}%`);
      }
      
      if (filters.has_solutions !== undefined) {
        if (filters.has_solutions === 'true' || filters.has_solutions === true) {
          query += ` AND EXISTS (SELECT 1 FROM dreamteam.problem_solution_map WHERE problem_id = p.id)`;
        } else if (filters.has_solutions === 'false' || filters.has_solutions === false) {
          query += ` AND NOT EXISTS (SELECT 1 FROM dreamteam.problem_solution_map WHERE problem_id = p.id)`;
        }
      }

      query += ` GROUP BY p.id`;
      
      // Add sorting
      const sortField = filters.sortBy || 'created_at';
      const sortOrder = filters.sortOrder || 'DESC';
      const validSortFields = ['title', 'impact', 'industry', 'created_at', 'solution_count', 'cluster_label'];
      
      if (validSortFields.includes(sortField)) {
        if (sortField === 'solution_count') {
          query += ` ORDER BY solution_count ${sortOrder === 'ASC' ? 'ASC' : 'DESC'}`;
        } else {
          query += ` ORDER BY p.${sortField} ${sortOrder === 'ASC' ? 'ASC' : 'DESC'}`;
        }
      } else {
        query += ` ORDER BY p.created_at DESC`;
      }
      
      const result = await pool.query(query, values);
      return result.rows;
    } catch (error) {
      console.error('Error fetching problems:', error);
      throw error;
    }
  }

  async getProblemById(id) {
    const query = `
      SELECT * FROM dreamteam.problems 
      WHERE id = $1
    `;
    const result = await pool.query(query, [id]);
    return result.rows[0];
  }
  
  async getSolutionsByProblem(problemId) {
    const query = `
      SELECT DISTINCT s.*
      FROM dreamteam.solutions s
      JOIN dreamteam.problem_solution_map psm ON s.id = psm.solution_id
      WHERE psm.problem_id = $1
      ORDER BY s.overall_viability DESC NULLS LAST
    `;
    const result = await pool.query(query, [problemId]);
    return result.rows;
  }

  async checkClusterExists(clusterId) {
    try {
      // Check if any problems are assigned to this cluster
      // This is more reliable than checking cluster_centroids which depends on versions
      const query = `
        SELECT EXISTS(
          SELECT 1 
          FROM dreamteam.problems 
          WHERE cluster_id = $1
        ) as exists
      `;
      const result = await pool.query(query, [clusterId]);
      return result.rows[0];
    } catch (error) {
      console.error('Error checking cluster existence:', error);
      return { exists: false };
    }
  }

  async getProblemsByClusterId(clusterId) {
    try {
      const query = `
        SELECT 
          p.id,
          p.identifier,
          p.title,
          p.description,
          p.source_url,
          p.impact,
          p.industry,
          p.business_size,
          p.cluster_similarity,
          p.created_at,
          COUNT(psm.solution_id) as solution_count
        FROM dreamteam.problems p
        LEFT JOIN dreamteam.problem_solution_map psm ON p.id = psm.problem_id
        WHERE p.cluster_id = $1
        GROUP BY p.id
        ORDER BY 
          CASE p.impact::text
            WHEN 'critical' THEN 1
            WHEN 'high' THEN 2
            WHEN 'medium' THEN 3
            WHEN 'low' THEN 4
            ELSE 5
          END,
          p.cluster_similarity DESC NULLS LAST
      `;
      const result = await pool.query(query, [clusterId]);
      return result.rows;
    } catch (error) {
      console.error('Error fetching problems by cluster:', error);
      throw error;
    }
  }

  // === CLUSTERS ===
  async getClusterById(clusterId) {
    try {
      const query = `
        WITH active_version AS (
          SELECT COALESCE(
            (SELECT version FROM dreamteam.cluster_versions WHERE is_active = true),
            (SELECT MAX(version) FROM dreamteam.cluster_centroids)
          ) as version
        )
        SELECT 
          c.cluster_id,
          c.cluster_label,
          c.avg_similarity,
          c.is_outlier_bucket,
          c.created_at,
          COUNT(DISTINCT p.id) as problem_count,
          COUNT(DISTINCT s.id) as solution_count
        FROM dreamteam.cluster_centroids c
        LEFT JOIN dreamteam.problems p ON p.cluster_id = c.cluster_id
        LEFT JOIN dreamteam.solutions s ON s.source_cluster_id = c.cluster_id
        WHERE c.cluster_id = $1
          AND c.version = (SELECT version FROM active_version)
        GROUP BY c.cluster_id, c.cluster_label, c.avg_similarity, c.is_outlier_bucket, c.created_at
      `;
      
      const result = await pool.query(query, [clusterId]);
      return result.rows[0] || null;
    } catch (error) {
      console.error('Error fetching cluster by ID:', error);
      throw error;
    }
  }

  async getClusters(filters = {}) {
    try {
      let baseQuery;
      let params = [];
      let paramCount = 0;
      
      if (filters.version) {
        baseQuery = `
          WITH cluster_data AS (
            SELECT 
              c.cluster_id,
              c.cluster_label,
              c.avg_similarity,
              c.is_outlier_bucket,
              COUNT(p.id) as problem_count,
              COUNT(DISTINCT s.id) as solution_count
            FROM dreamteam.cluster_centroids c
            LEFT JOIN dreamteam.problems p ON p.cluster_id = c.cluster_id
            LEFT JOIN dreamteam.solutions s ON s.source_cluster_id = c.cluster_id
            WHERE c.version = $${++paramCount}
              -- Include outlier bucket to show all clusters
        `;
        params.push(filters.version);
      } else {
        baseQuery = `
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
              c.avg_similarity,
              c.is_outlier_bucket,
              c.created_at,
              COUNT(p.id) as problem_count,
              COUNT(DISTINCT s.id) as solution_count
            FROM dreamteam.cluster_centroids c
            LEFT JOIN dreamteam.problems p ON p.cluster_id = c.cluster_id
            LEFT JOIN dreamteam.solutions s ON s.source_cluster_id = c.cluster_id
            WHERE c.version = (SELECT version FROM active_version)
              -- Include outlier bucket to show all clusters
        `;
      }
      
      // Add GROUP BY first
      baseQuery += `
            GROUP BY c.cluster_id, c.cluster_label, 
                     c.avg_similarity, c.is_outlier_bucket, c.created_at
      `;
      
      // Add HAVING filters after GROUP BY
      let havingClauses = [];
      
      if (filters.has_solutions !== undefined) {
        if (filters.has_solutions === 'true' || filters.has_solutions === true) {
          havingClauses.push('COUNT(DISTINCT s.id) > 0');
        } else if (filters.has_solutions === 'false' || filters.has_solutions === false) {
          havingClauses.push('COUNT(DISTINCT s.id) = 0');
        }
      }
      
      if (filters.min_problems) {
        havingClauses.push(`COUNT(p.id) >= $${++paramCount}`);
        params.push(parseInt(filters.min_problems));
      }
      
      if (havingClauses.length > 0) {
        baseQuery += ` HAVING ${havingClauses.join(' AND ')}`;
      }
      
      baseQuery += `
          )
          SELECT * FROM cluster_data
      `;
      
      // Add search filter
      if (filters.search) {
        baseQuery += ` WHERE cluster_label ILIKE $${++paramCount}`;
        params.push(`%${filters.search}%`);
      }
      
      // Add sorting
      const sortField = filters.sortBy || 'problem_count';
      const sortOrder = filters.sortOrder || 'DESC';
      const validSortFields = ['cluster_label', 'problem_count', 'solution_count', 'avg_similarity'];
      
      if (validSortFields.includes(sortField)) {
        baseQuery += ` ORDER BY ${sortField} ${sortOrder === 'ASC' ? 'ASC' : 'DESC'}`;
      } else {
        baseQuery += ` ORDER BY problem_count DESC`;
      }
      
      const result = await pool.query(baseQuery, params);
      return result.rows;
    } catch (error) {
      console.error('Error fetching clusters:', error);
      throw error;
    }
  }

  async getProblemsBySolutionId(solutionId) {
    try {
      const query = `
        SELECT 
          p.id,
          p.identifier,
          p.title,
          p.description,
          p.source_url,
          p.impact,
          p.industry,
          p.business_size,
          p.cluster_id,
          p.cluster_label,
          p.created_at
        FROM dreamteam.problems p
        INNER JOIN dreamteam.problem_solution_map psm ON p.id = psm.problem_id
        WHERE psm.solution_id = $1
        ORDER BY 
          CASE p.impact::text
            WHEN 'critical' THEN 1
            WHEN 'high' THEN 2
            WHEN 'medium' THEN 3
            WHEN 'low' THEN 4
            ELSE 5
          END,
          p.created_at DESC
      `;
      const result = await pool.query(query, [solutionId]);
      return result.rows;
    } catch (error) {
      console.error('Error fetching problems by solution:', error);
      throw error;
    }
  }

  // === SOLUTIONS ===
  async getBestSolutionCandidate() {
    try {
      const query = `
        WITH solution_scores AS (
          SELECT 
            s.id,
            s.identifier,
            s.title,
            s.description,
            s.overall_viability,
            s.ltv_estimate,
            s.cac_estimate,
            s.market_size_estimate,
            COALESCE(
              s.source_cluster_label, 
              cc.cluster_label,
              'Unknown Cluster'
            ) as source_cluster_label,
            s.is_saas_compatible,
            s.value_proposition,
            s.status,
            COUNT(DISTINCT psm.problem_id) as problem_count,
            -- Use the database-calculated candidate_score
            s.candidate_score as selection_score
          FROM dreamteam.solutions s
          LEFT JOIN dreamteam.problem_solution_map psm ON s.id = psm.solution_id
          LEFT JOIN dreamteam.projects p ON s.id = p.solution_id
          LEFT JOIN LATERAL (
            SELECT cluster_label 
            FROM dreamteam.cluster_centroids 
            WHERE cluster_id = s.source_cluster_id 
              AND cluster_label IS NOT NULL
            ORDER BY version DESC 
            LIMIT 1
          ) cc ON s.source_cluster_label IS NULL
          WHERE s.status = 'candidate'
            AND s.is_saas_compatible = TRUE
            AND p.id IS NULL
          GROUP BY s.id, s.identifier, s.title, s.description, s.overall_viability,
                   s.ltv_estimate, s.cac_estimate, s.market_size_estimate,
                   s.source_cluster_label, s.is_saas_compatible,
                   s.value_proposition, s.status, cc.cluster_label
        )
        SELECT 
          id,
          identifier,
          title,
          description,
          overall_viability,
          ltv_estimate,
          cac_estimate,
          source_cluster_label,
          problem_count,
          selection_score,
          value_proposition,
          status
        FROM solution_scores
        ORDER BY selection_score DESC
        LIMIT 1
      `;
      
      const result = await pool.query(query);
      return result.rows[0] || null;
    } catch (error) {
      console.error('Error getting best solution candidate:', error);
      return null;
    }
  }

  async getSolutions(filters = {}) {
    try {
      let query = `
        SELECT 
          s.id,
          s.identifier,
          s.title,
          s.description,
          s.value_proposition,
          s.primary_feature,
          s.overall_viability,
          s.candidate_score,
          s.technical_feasibility,
          s.market_demand,
          s.competitive_advantage,
          s.ltv_estimate,
          s.cac_estimate,
          s.recurring_revenue_potential,
          s.source_cluster_id,
          s.source_cluster_label,
          s.solution_cluster_id,
          s.solution_cluster_label,
          s.linear_project_id,
          s.github_repo_url,
          s.created_at,
          s.status,
          COUNT(psm.problem_id) as problem_count,
          ARRAY_AGG(psm.problem_id) FILTER (WHERE psm.problem_id IS NOT NULL) as problem_ids
        FROM dreamteam.solutions s
        LEFT JOIN dreamteam.problem_solution_map psm ON s.id = psm.solution_id
        WHERE 1=1
      `;
      
      const values = [];
      let paramCount = 0;

      if (filters.cluster_id) {
        query += ` AND s.source_cluster_id = $${++paramCount}`;
        values.push(filters.cluster_id);
      }
      
      if (filters.status) {
        query += ` AND s.status = $${++paramCount}`;
        values.push(filters.status);
      }
      
      if (filters.min_viability) {
        query += ` AND s.overall_viability >= $${++paramCount}`;
        values.push(parseFloat(filters.min_viability));
      }
      
      if (filters.search) {
        query += ` AND (s.title ILIKE $${++paramCount} OR s.description ILIKE $${paramCount} OR s.value_proposition ILIKE $${paramCount})`;
        values.push(`%${filters.search}%`);
      }

      if (filters.has_project !== undefined) {
        if (filters.has_project === 'true' || filters.has_project === true) {
          query += ` AND s.linear_project_id IS NOT NULL`;
        } else if (filters.has_project === 'false' || filters.has_project === false) {
          query += ` AND s.linear_project_id IS NULL`;
        }
      }

      query += ` GROUP BY s.id`;
      
      // Add sorting
      const sortField = filters.sortBy || 'overall_viability';
      const sortOrder = filters.sortOrder || 'DESC';
      const validSortFields = ['title', 'overall_viability', 'candidate_score', 'status', 'created_at', 'ltv_estimate', 'recurring_revenue_potential', 'problem_count'];
      
      if (validSortFields.includes(sortField)) {
        if (sortField === 'problem_count') {
          query += ` ORDER BY problem_count ${sortOrder === 'ASC' ? 'ASC' : 'DESC'} NULLS LAST`;
        } else {
          query += ` ORDER BY s.${sortField} ${sortOrder === 'ASC' ? 'ASC' : 'DESC'} NULLS LAST`;
        }
      } else {
        query += ` ORDER BY s.overall_viability DESC NULLS LAST`;
      }
      
      const result = await pool.query(query, values);
      return result.rows;
    } catch (error) {
      console.error('Error fetching solutions:', error);
      throw error;
    }
  }

  // === PIPELINE STATS ===
  async getPipelineStats() {
    try {
      const query = `
        WITH stats AS (
          SELECT 
            (SELECT COUNT(*) FROM dreamteam.problems) as total_problems,
            (SELECT COUNT(*) FROM dreamteam.problems WHERE cluster_id IS NULL) as unclustered_problems,
            (SELECT COUNT(*) FROM dreamteam.solutions) as total_solutions,
            (SELECT COUNT(*) FROM dreamteam.solutions WHERE linear_project_id IS NOT NULL) as active_projects,
            (SELECT COUNT(DISTINCT cluster_id) FROM dreamteam.cluster_centroids 
             WHERE version = (SELECT version FROM dreamteam.cluster_versions WHERE is_active = true)
             AND is_outlier_bucket = false) as total_clusters,
            (SELECT COUNT(DISTINCT problem_id) FROM dreamteam.problem_solution_map) as problems_with_solutions
        )
        SELECT * FROM stats
      `;
      
      const result = await pool.query(query);
      return result.rows[0];
    } catch (error) {
      console.error('Error fetching pipeline stats:', error);
      throw error;
    }
  }

  // === DEBUG ===
  async debugCluster(clusterId) {
    try {
      // Get cluster info
      const clusterQuery = `
        SELECT * FROM dreamteam.cluster_centroids 
        WHERE cluster_id = $1
      `;
      const clusterResult = await pool.query(clusterQuery, [clusterId]);
      
      // Count problems with this cluster_id
      const problemCountQuery = `
        SELECT COUNT(*) as count 
        FROM dreamteam.problems 
        WHERE cluster_id = $1
      `;
      const problemCountResult = await pool.query(problemCountQuery, [clusterId]);
      
      // Get sample problems if any
      const problemSampleQuery = `
        SELECT id, title, cluster_id, cluster_label 
        FROM dreamteam.problems 
        WHERE cluster_id = $1 
        LIMIT 5
      `;
      const problemSampleResult = await pool.query(problemSampleQuery, [clusterId]);
      
      // Check if it appears in the clusters list
      const visibilityQuery = `
        WITH active_version AS (
          SELECT COALESCE(
            (SELECT version FROM dreamteam.cluster_versions WHERE is_active = true),
            (SELECT MAX(version) FROM dreamteam.cluster_centroids)
          ) as version
        )
        SELECT 
          c.cluster_id,
          c.cluster_label,
          c.version,
          c.is_outlier_bucket,
          COUNT(p.id) as problem_count
        FROM dreamteam.cluster_centroids c
        LEFT JOIN dreamteam.problems p ON p.cluster_id = c.cluster_id
        WHERE c.cluster_id = $1
        GROUP BY c.cluster_id, c.cluster_label, c.version, c.is_outlier_bucket
      `;
      const visibilityResult = await pool.query(visibilityQuery, [clusterId]);
      
      return {
        cluster: clusterResult.rows[0] || null,
        problem_count: parseInt(problemCountResult.rows[0].count),
        sample_problems: problemSampleResult.rows,
        visibility_info: visibilityResult.rows[0] || null,
        diagnosis: {
          cluster_exists: clusterResult.rows.length > 0,
          has_problems: parseInt(problemCountResult.rows[0].count) > 0,
          is_outlier: clusterResult.rows[0]?.is_outlier_bucket || false,
          appears_in_list: visibilityResult.rows.length > 0 && parseInt(visibilityResult.rows[0]?.problem_count || 0) > 0
        }
      };
    } catch (error) {
      console.error('Error debugging cluster:', error);
      throw error;
    }
  }
  
  // === DEBUG ===
  async getOrphanedClusterReferences() {
    try {
      const query = `
        SELECT 
          s.id as solution_id,
          s.title as solution_title,
          s.source_cluster_id,
          s.source_cluster_label,
          cc.cluster_id as actual_cluster_id,
          cc.cluster_label as actual_cluster_label
        FROM dreamteam.solutions s
        LEFT JOIN dreamteam.cluster_centroids cc ON s.source_cluster_id = cc.cluster_id
        WHERE s.source_cluster_id IS NOT NULL
          AND cc.cluster_id IS NULL
        ORDER BY s.created_at DESC
      `;
      const result = await pool.query(query);
      
      // Also get count of solutions with valid clusters
      const validQuery = `
        SELECT COUNT(*) as valid_count
        FROM dreamteam.solutions s
        INNER JOIN dreamteam.cluster_centroids cc ON s.source_cluster_id = cc.cluster_id
        WHERE s.source_cluster_id IS NOT NULL
      `;
      const validResult = await pool.query(validQuery);
      
      return {
        orphaned_solutions: result.rows,
        orphaned_count: result.rows.length,
        valid_cluster_references: parseInt(validResult.rows[0].valid_count),
        message: result.rows.length > 0 ? 
          'Found solutions referencing non-existent clusters. These clusters may have been deleted or the solutions have stale references.' :
          'All solution cluster references are valid.'
      };
    } catch (error) {
      console.error('Error checking orphaned cluster references:', error);
      throw error;
    }
  }

  // === PROJECTS ===
  async getProjects() {
    try {
      const query = `
        SELECT 
          p.id,
          p.identifier,
          p.name,
          p.description,
          p.status,
          p.solution_id,
          p.github_repo_name,
          p.github_repo_url,
          p.github_created_at,
          p.linear_team_id,
          p.linear_team_key,
          p.linear_project_id,
          p.linear_project_url,
          p.linear_created_at,
          p.created_at,
          s.title as solution_title,
          s.description as solution_description,
          s.overall_viability,
          s.primary_feature,
          s.value_proposition,
          s.tech_stack,
          s.linear_project_id as solution_linear_project_id,
          s.github_repo_url as solution_github_repo_url
        FROM dreamteam.projects p
        LEFT JOIN dreamteam.solutions s ON p.solution_id = s.id
        ORDER BY p.created_at DESC
      `;
      
      const result = await pool.query(query);
      return result.rows;
    } catch (error) {
      console.error('Error fetching projects:', error);
      throw error;
    }
  }

  // === FILTER OPTIONS ===
  async getProblemsFilterOptions() {
    try {
      const query = `
        SELECT 
          ARRAY_AGG(DISTINCT impact ORDER BY impact) FILTER (WHERE impact IS NOT NULL) as impacts,
          ARRAY_AGG(DISTINCT industry ORDER BY industry) FILTER (WHERE industry IS NOT NULL) as industries,
          ARRAY_AGG(DISTINCT business_size ORDER BY business_size) FILTER (WHERE business_size IS NOT NULL) as business_sizes,
          ARRAY_AGG(DISTINCT cluster_label ORDER BY cluster_label) FILTER (WHERE cluster_label IS NOT NULL) as cluster_labels
        FROM dreamteam.problems
      `;
      const result = await pool.query(query);
      
      // Parse PostgreSQL array strings if needed
      const options = result.rows[0];
      const parseArray = (val) => {
        if (!val) return [];
        if (Array.isArray(val)) return val;
        // Parse PostgreSQL array string format: "{item1,item2,item3}"
        if (typeof val === 'string' && val.startsWith('{') && val.endsWith('}')) {
          return val.slice(1, -1).split(',');
        }
        return [];
      };
      
      return {
        impacts: parseArray(options.impacts),
        industries: options.industries || [],
        business_sizes: options.business_sizes || [],
        cluster_labels: options.cluster_labels || []
      };
    } catch (error) {
      console.error('Error fetching problem filter options:', error);
      throw error;
    }
  }

  async getClustersFilterOptions() {
    try {
      const query = `
        WITH active_version AS (
          SELECT COALESCE(
            (SELECT version FROM dreamteam.cluster_versions WHERE is_active = true),
            (SELECT MAX(version) FROM dreamteam.cluster_centroids)
          ) as version
        )
        SELECT 
          ARRAY_AGG(DISTINCT cluster_label ORDER BY cluster_label) FILTER (WHERE cluster_label IS NOT NULL) as cluster_labels
        FROM dreamteam.cluster_centroids
        WHERE version = (SELECT version FROM active_version)
          AND is_outlier_bucket = false
      `;
      const result = await pool.query(query);
      
      // Ensure arrays are properly formatted
      const options = result.rows[0];
      return {
        cluster_labels: options.cluster_labels || []
      };
    } catch (error) {
      console.error('Error fetching cluster filter options:', error);
      throw error;
    }
  }

  async getSolutionsFilterOptions() {
    try {
      const query = `
        SELECT 
          ARRAY_AGG(DISTINCT status ORDER BY status) FILTER (WHERE status IS NOT NULL) as statuses,
          ARRAY_AGG(DISTINCT source_cluster_label ORDER BY source_cluster_label) FILTER (WHERE source_cluster_label IS NOT NULL) as cluster_labels
        FROM dreamteam.solutions
      `;
      const result = await pool.query(query);
      
      // Parse PostgreSQL array strings if needed
      const options = result.rows[0];
      const parseArray = (val) => {
        if (!val) return [];
        if (Array.isArray(val)) return val;
        // Parse PostgreSQL array string format: "{item1,item2,item3}"
        if (typeof val === 'string' && val.startsWith('{') && val.endsWith('}')) {
          return val.slice(1, -1).split(',');
        }
        return [];
      };
      
      return {
        statuses: parseArray(options.statuses),
        cluster_labels: options.cluster_labels || []
      };
    } catch (error) {
      console.error('Error fetching solution filter options:', error);
      throw error;
    }
  }

  // === SOLUTION CLUSTERS ===
  async getSolutionClusterById(clusterId) {
    try {
      const query = `
        WITH active_version AS (
          SELECT COALESCE(
            (SELECT version FROM dreamteam.solution_cluster_versions WHERE is_active = true),
            (SELECT MAX(version) FROM dreamteam.solution_cluster_centroids)
          ) as version
        )
        SELECT 
          c.cluster_id,
          c.cluster_label,
          c.avg_similarity,
          c.is_outlier_bucket,
          c.created_at,
          COUNT(DISTINCT s.id) as solution_count,
          0 as problem_count
        FROM dreamteam.solution_cluster_centroids c
        LEFT JOIN dreamteam.solutions s ON s.solution_cluster_id = c.cluster_id
        WHERE c.cluster_id = $1
          AND c.version = (SELECT version FROM active_version)
        GROUP BY c.cluster_id, c.cluster_label, c.avg_similarity, c.is_outlier_bucket, c.created_at
      `;
      
      const result = await pool.query(query, [clusterId]);
      return result.rows[0] || null;
    } catch (error) {
      console.error('Error fetching solution cluster by ID:', error);
      throw error;
    }
  }

  async getSolutionClusters(filters = {}) {
    try {
      let baseQuery;
      let params = [];
      let paramCount = 0;
      
      if (filters.version) {
        baseQuery = `
          WITH cluster_data AS (
            SELECT 
              c.cluster_id,
              c.cluster_label,
              c.avg_similarity,
              c.is_outlier_bucket,
              COUNT(s.id) as solution_count,
              COUNT(s.id) as problem_count  -- For UI compatibility
            FROM dreamteam.solution_cluster_centroids c
            LEFT JOIN dreamteam.solutions s ON s.solution_cluster_id = c.cluster_id
            WHERE c.version = $${++paramCount}
        `;
        params.push(filters.version);
      } else {
        baseQuery = `
          WITH active_version AS (
            SELECT COALESCE(
              (SELECT version FROM dreamteam.solution_cluster_versions WHERE is_active = true),
              (SELECT MAX(version) FROM dreamteam.solution_cluster_centroids)
            ) as version
          ),
          cluster_data AS (
            SELECT 
              c.cluster_id,
              c.cluster_label,
              c.avg_similarity,
              c.is_outlier_bucket,
              c.created_at,
              COUNT(s.id) as solution_count,
              COUNT(s.id) as problem_count  -- For UI compatibility
            FROM dreamteam.solution_cluster_centroids c
            LEFT JOIN dreamteam.solutions s ON s.solution_cluster_id = c.cluster_id
            WHERE c.version = (SELECT version FROM active_version)
        `;
      }
      
      // Add GROUP BY first
      baseQuery += `
            GROUP BY c.cluster_id, c.cluster_label, 
                     c.avg_similarity, c.is_outlier_bucket, c.created_at
      `;
      
      // Add HAVING clause if needed
      if (filters.min_solutions) {
        baseQuery += ` HAVING COUNT(s.id) >= $${++paramCount}`;
        params.push(parseInt(filters.min_solutions));
      }
      
      // Complete the CTE and main query
      let query = baseQuery + `
          )
          SELECT * FROM cluster_data WHERE 1=1
      `;
      
      // Add search filter
      if (filters.search) {
        query += ` AND cluster_label ILIKE $${++paramCount}`;
        params.push(`%${filters.search}%`);
      }
      
      // Add sorting
      const sortField = filters.sortBy || 'solution_count';
      const sortOrder = filters.sortOrder || 'DESC';
      const validSortFields = ['cluster_label', 'solution_count', 'avg_similarity'];
      
      if (validSortFields.includes(sortField)) {
        query += ` ORDER BY ${sortField} ${sortOrder === 'ASC' ? 'ASC' : 'DESC'}`;
      } else {
        query += ` ORDER BY solution_count DESC`;
      }
      
      const result = await pool.query(query, params);
      return result.rows;
    } catch (error) {
      console.error('Error fetching solution clusters:', error);
      throw error;
    }
  }

  async getSolutionsByClusterId(clusterId) {
    try {
      const query = `
        SELECT 
          s.id,
          s.identifier,
          s.title,
          s.description,
          s.overall_viability,
          s.status,
          s.tech_stack,
          s.linear_project_id,
          s.solution_cluster_similarity as cluster_similarity
        FROM dreamteam.solutions s
        WHERE s.solution_cluster_id = $1
        ORDER BY s.solution_cluster_similarity DESC
      `;
      const result = await pool.query(query, [clusterId]);
      return result.rows;
    } catch (error) {
      console.error('Error fetching solutions by cluster:', error);
      throw error;
    }
  }

  // === UTILITY ===
  async executeQuery(sql, params = []) {
    // For future custom queries - use with caution
    try {
      const result = await pool.query(sql, params);
      return result.rows;
    } catch (error) {
      console.error('Error executing query:', error);
      throw error;
    }
  }
  // === CLUSTERING SCENARIOS ===
  
  async createClusteringScenario(entityType, kValue, similarityThreshold, requestedBy = null, notes = null) {
    const result = await this.executeQuery(
      `SELECT dreamteam.create_clustering_scenario($1, $2, $3, $4, $5) as scenario_id`,
      [entityType, kValue, similarityThreshold, requestedBy, notes]
    );
    return result[0].scenario_id;
  }

  async getClusteringScenarios(entityType = null, status = null) {
    let query = `
      SELECT 
        id,
        entity_type,
        k_value,
        similarity_threshold,
        status,
        requested_at,
        started_at,
        completed_at,
        requested_by,
        total_items,
        outlier_count,
        outlier_percentage,
        outlier_improvement_percentage,
        notes
      FROM dreamteam.clustering_scenarios
      WHERE 1=1
    `;
    
    const params = [];
    if (entityType) {
      params.push(entityType);
      query += ` AND entity_type = $${params.length}`;
    }
    if (status) {
      params.push(status);
      query += ` AND status = $${params.length}`;
    }
    
    query += ' ORDER BY requested_at DESC LIMIT 20';
    
    const result = await this.executeQuery(query, params);
    return result;
  }

  async getClusteringScenarioDetails(scenarioId) {
    // Get scenario basic info
    const scenarioResult = await this.executeQuery(
      `SELECT * FROM dreamteam.clustering_scenarios WHERE id = $1`,
      [scenarioId]
    );
    
    if (scenarioResult.length === 0) {
      return null;
    }
    
    const scenario = scenarioResult[0];
    
    // If completed, get cluster details
    if (scenario.status === 'completed') {
      const clustersResult = await this.executeQuery(
        `SELECT 
          cluster_id as id,
          cluster_id,
          item_count,
          avg_similarity,
          min_similarity,
          max_similarity,
          is_outlier_bucket as is_outlier,
          sample_titles,
          sample_titles[1] as label
        FROM dreamteam.scenario_clusters
        WHERE scenario_id = $1
        ORDER BY is_outlier_bucket, item_count DESC`,
        [scenarioId]
      );
      
      // For each cluster, get the items if needed
      for (const cluster of clustersResult) {
        if (cluster.item_count > 0) {
          const itemsResult = await this.executeQuery(
            `SELECT 
              entity_id as id,
              entity_id,
              similarity
            FROM dreamteam.scenario_assignments
            WHERE scenario_id = $1 AND cluster_id = $2
            LIMIT 50`,
            [scenarioId, cluster.cluster_id]
          );
          
          // Get the actual item details
          const itemIds = itemsResult.map(item => item.entity_id);
          if (itemIds.length > 0) {
            const itemDetailsResult = await this.executeQuery(
              `SELECT 
                id,
                title as name,
                description as statement
              FROM dreamteam.${scenario.entity_type}s
              WHERE id = ANY($1::uuid[])`,
              [itemIds]
            );
            
            // Merge item details with similarity scores
            cluster.items = itemsResult.map(item => {
              const details = itemDetailsResult.find(d => d.id === item.entity_id);
              return {
                ...item,
                ...details
              };
            });
          }
        }
      }
      
      scenario.clusters = clustersResult;
    }
    
    return scenario;
  }

  async deleteClusteringScenario(scenarioId) {
    await this.executeQuery(
      `DELETE FROM dreamteam.clustering_scenarios WHERE id = $1 AND status IN ('pending', 'failed', 'completed')`,
      [scenarioId]
    );
  }

  async getClusteringConfig(entityType) {
    const result = await this.executeQuery(
      `SELECT 
        k_value,
        similarity_threshold,
        outlier_percentage,
        cluster_count,
        avg_cluster_size,
        last_updated
      FROM dreamteam.clustering_config
      WHERE entity_type = $1`,
      [entityType]
    );
    
    if (result.length === 0) {
      // Return defaults if no config exists yet
      return {
        k_value: 25,
        similarity_threshold: 0.60,
        outlier_percentage: null,
        cluster_count: null,
        avg_cluster_size: null,
        last_updated: null
      };
    }
    
    return result[0];
  }
  
  async applyScenarioToProduction(scenarioId) {
    // First check if scenario is completed
    const scenarioResult = await this.executeQuery(
      `SELECT entity_type, status FROM dreamteam.clustering_scenarios WHERE id = $1`,
      [scenarioId]
    );
    
    if (scenarioResult.length === 0) {
      throw new Error('Scenario not found');
    }
    
    if (scenarioResult[0].status !== 'completed') {
      throw new Error('Can only apply completed scenarios');
    }
    
    const entityType = scenarioResult[0].entity_type;
    
    // Apply the scenario assignments to production
    if (entityType === 'problem') {
      await this.executeQuery(
        `UPDATE dreamteam.problems p
         SET 
           cluster_id = sa.cluster_id,
           cluster_similarity = sa.similarity::REAL
         FROM dreamteam.scenario_assignments sa
         WHERE sa.scenario_id = $1
           AND sa.entity_id = p.id`,
        [scenarioId]
      );
    } else {
      await this.executeQuery(
        `UPDATE dreamteam.solutions s
         SET 
           solution_cluster_id = sa.cluster_id,
           cluster_similarity = sa.similarity::REAL
         FROM dreamteam.scenario_assignments sa
         WHERE sa.scenario_id = $1
           AND sa.entity_id = s.id`,
        [scenarioId]
      );
    }
    
    // Mark scenario as applied
    await this.executeQuery(
      `UPDATE dreamteam.clustering_scenarios 
       SET notes = COALESCE(notes || ' | ', '') || 'Applied to production at ' || NOW()::TEXT
       WHERE id = $1`,
      [scenarioId]
    );
    
    return { success: true, entityType };
  }
}

export default new DatabaseService();
