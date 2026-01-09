import dotenv from 'dotenv';
dotenv.config();

/**
 * GitHub Integration Service
 * Handles GitHub API operations like repository deletion
 */
class GitHubService {
  constructor() {
    this.token = process.env.GITHUB_TOKEN;
    this.owner = process.env.GITHUB_OWNER || 'dreamteam-ai-labs';
    this.apiBase = 'https://api.github.com';
  }

  /**
   * Delete a GitHub repository
   * @param {string} repoNameOrUrl - Repository name or full URL
   * @returns {Promise<{success: boolean, message: string}>}
   */
  async deleteRepository(repoNameOrUrl) {
    if (!this.token) {
      console.warn('GitHub token not configured - skipping repo deletion');
      return {
        success: false,
        message: 'GitHub token not configured',
        skipped: true
      };
    }

    try {
      // Extract repo name from URL if full URL provided
      let repoName = repoNameOrUrl;
      if (repoNameOrUrl.includes('github.com')) {
        const urlParts = repoNameOrUrl.split('/');
        repoName = urlParts[urlParts.length - 1].replace('.git', '');
      }

      console.log(`Deleting GitHub repository: ${this.owner}/${repoName}`);

      const response = await fetch(
        `${this.apiBase}/repos/${this.owner}/${repoName}`,
        {
          method: 'DELETE',
          headers: {
            'Accept': 'application/vnd.github+json',
            'Authorization': `Bearer ${this.token}`,
            'X-GitHub-Api-Version': '2022-11-28'
          }
        }
      );

      if (response.status === 204) {
        console.log(`Successfully deleted repository: ${repoName}`);
        return {
          success: true,
          message: `Repository ${repoName} deleted successfully`
        };
      } else if (response.status === 404) {
        console.log(`Repository not found (may already be deleted): ${repoName}`);
        return {
          success: true,
          message: `Repository ${repoName} not found (may already be deleted)`,
          notFound: true
        };
      } else if (response.status === 403) {
        const errorData = await response.json().catch(() => ({}));
        console.error(`Permission denied deleting repository: ${repoName}`, errorData);
        return {
          success: false,
          message: `Permission denied. Token may lack delete_repo scope.`,
          error: errorData
        };
      } else {
        const errorData = await response.json().catch(() => ({}));
        console.error(`Failed to delete repository: ${repoName}`, response.status, errorData);
        return {
          success: false,
          message: `Failed to delete repository: ${response.status}`,
          error: errorData
        };
      }
    } catch (error) {
      console.error('Error deleting GitHub repository:', error);
      return {
        success: false,
        message: error.message,
        error: error
      };
    }
  }

  /**
   * Delete multiple repositories
   * @param {Array<{name: string, url: string}>} repos - Array of repos to delete
   * @returns {Promise<{success: boolean, results: Array}>}
   */
  async deleteRepositories(repos) {
    if (!repos || repos.length === 0) {
      return { success: true, results: [], message: 'No repositories to delete' };
    }

    const results = [];
    let allSuccess = true;

    for (const repo of repos) {
      const result = await this.deleteRepository(repo.url || repo.name);
      results.push({
        ...repo,
        ...result
      });
      if (!result.success && !result.skipped && !result.notFound) {
        allSuccess = false;
      }
    }

    return {
      success: allSuccess,
      results,
      deleted_count: results.filter(r => r.success).length,
      failed_count: results.filter(r => !r.success && !r.skipped).length
    };
  }

  /**
   * Check if GitHub is configured and accessible
   */
  async testConnection() {
    if (!this.token) {
      return { connected: false, message: 'GitHub token not configured' };
    }

    try {
      const response = await fetch(`${this.apiBase}/user`, {
        headers: {
          'Accept': 'application/vnd.github+json',
          'Authorization': `Bearer ${this.token}`,
          'X-GitHub-Api-Version': '2022-11-28'
        }
      });

      if (response.ok) {
        const user = await response.json();
        return {
          connected: true,
          user: user.login,
          message: `Connected as ${user.login}`
        };
      } else {
        return {
          connected: false,
          message: `GitHub API returned ${response.status}`
        };
      }
    } catch (error) {
      return {
        connected: false,
        message: error.message
      };
    }
  }
}

export default new GitHubService();
