import axios from 'axios';
import pool from '../config/database.js';

class CodespaceService {
  constructor() {
    this.githubToken = null;
    this.githubApi = axios.create({
      baseURL: 'https://api.github.com',
      headers: {
        'Accept': 'application/vnd.github.v3+json',
        'X-GitHub-Api-Version': '2022-11-28'
      }
    });
  }

  ensureGithubToken() {
    const token = process.env.GITHUB_TOKEN;
    if (!token) {
      console.warn('GITHUB_TOKEN not found in environment variables');
      throw new Error('GitHub token not configured');
    }

    if (token !== this.githubToken) {
      this.githubToken = token;
      this.githubApi.defaults.headers.Authorization = `Bearer ${token}`;
    }
  }

  // Load centralized devcontainer configuration
  async getDevcontainerConfig() {
    // Simple working config with Claude Code extension
    return {
      name: "DreamTeam Dev",
      image: "mcr.microsoft.com/devcontainers/javascript-node:1-20",
      customizations: {
        vscode: {
          extensions: [
            "anthropic.claude-code",
            "github.vscode-pull-request-github",
            "dbaeumer.vscode-eslint",
            "esbenp.prettier-vscode"
          ],
          settings: {
            "terminal.integrated.defaultProfile.linux": "bash",
            "git.autofetch": true,
            "git.confirmSync": false,
            "editor.formatOnSave": true,
            "editor.wordWrap": "on"
          }
        }
      },
      features: {
        "ghcr.io/devcontainers/features/github-cli:1": {
          "version": "latest"
        },
        "ghcr.io/devcontainers/features/node:1": {
          "version": "lts"
        }
      },
      forwardPorts: [3000, 3001, 5173, 8080],
      postCreateCommand: "npm install || echo 'No package.json found'",
      remoteUser: "node"
    };
  }

  // Create a new Codespace for a project
  async createCodespace(projectId, githubRepoName) {
    try {
      this.ensureGithubToken();

      // Parse owner and repo from the GitHub repo name or URL
      const repoMatch = githubRepoName.match(/(?:github\.com\/)?([^\/]+)\/([^\/\s]+)/);
      if (!repoMatch) {
        throw new Error('Invalid GitHub repository format');
      }

      const [, owner, repo] = repoMatch;

      // Get our centralized devcontainer configuration
      const devcontainerConfig = await this.getDevcontainerConfig();

      // Try to determine the default branch
      let defaultBranch = 'main';
      try {
        const repoResponse = await this.githubApi.get(`/repos/${owner}/${repo}`);
        defaultBranch = repoResponse.data.default_branch || 'main';
      } catch (err) {
        console.warn('Could not fetch repository details, using "main" as default branch');
      }

      // Truncate display name if too long (max 48 chars)
      let displayName = `DT - ${repo}`;
      if (displayName.length > 48) {
        displayName = displayName.substring(0, 48);
      }

      // Create the Codespace with our configuration
      const response = await this.githubApi.post(
        `/repos/${owner}/${repo}/codespaces`,
        {
          ref: defaultBranch,
          machine: 'basicLinux32gb', // 4 cores, 8GB RAM, 32GB storage
          display_name: displayName,
          retention_period_minutes: 43200, // 30 days retention
          devcontainer: devcontainerConfig // Use our centralized config
        }
      );

      // Use the web_url from GitHub's response - it's the proper browser URL
      const codespaceUrl = response.data.web_url || `https://github.com/codespaces/${response.data.name}`;
      const codespaceId = response.data.id;

      // Update the database with the Codespace URL
      await this.updateProjectCodespace(projectId, codespaceUrl, 'active');

      return {
        success: true,
        codespaceUrl,
        codespaceId,
        status: response.data.state
      };
    } catch (error) {
      const apiError = error.response?.data;
      const message = apiError?.message || error.message || 'Failed to create Codespace';
      console.error('Error creating Codespace:', apiError || error.message);
      throw new Error(message);
    }
  }

  // Check the status of a Codespace
  async getCodespaceStatus(codespaceId) {
    try {
      this.ensureGithubToken();
      const response = await this.githubApi.get(`/user/codespaces/${codespaceId}`);
      return {
        state: response.data.state,
        url: response.data.web_url || `https://github.com/codespaces/${response.data.name}`,
        machine: response.data.machine?.display_name
      };
    } catch (error) {
      if (error.response?.status === 404) {
        return { state: 'deleted' };
      }
      throw error;
    }
  }

  // Delete a Codespace
  async deleteCodespace(projectId, codespaceId) {
    try {
      this.ensureGithubToken();
      await this.githubApi.delete(`/user/codespaces/${codespaceId}`);

      // Clear the Codespace URL from the database
      await this.updateProjectCodespace(projectId, null, null);

      return { success: true };
    } catch (error) {
      console.error('Error deleting Codespace:', error);
      throw new Error('Failed to delete Codespace');
    }
  }

  // Update project's Codespace information in database
  async updateProjectCodespace(projectId, codespaceUrl, status) {
    try {
      const query = `
        UPDATE dreamteam.projects
        SET
          codespace_url = $1,
          codespace_status = $2,
          codespace_created_at = $3
        WHERE id = $4::UUID
        RETURNING *
      `;

      const createdAt = codespaceUrl ? new Date() : null;
      const result = await pool.query(query, [codespaceUrl, status, createdAt, projectId]);
      return result.rows[0];
    } catch (error) {
      console.error('Error updating project Codespace:', error);
      throw error;
    }
  }

  // Get Codespace info from URL - simplified version
  extractCodespaceId(codespaceUrl) {
    if (!codespaceUrl) {
      return null;
    }

    // Extract from web_url format: https://owner-repo-randomstring.github.dev/
    const githubDevMatch = codespaceUrl.match(/([a-z0-9]+-[a-z0-9]+-[a-z0-9]+)\.github\.dev/);
    if (githubDevMatch) {
      return githubDevMatch[1];
    }

    // Extract from GitHub codespaces URL: https://github.com/codespaces/name
    const codespaceMatch = codespaceUrl.match(/github\.com\/codespaces\/([^\/]+)/);
    if (codespaceMatch) {
      return codespaceMatch[1];
    }

    return null;
  }
}

export default new CodespaceService();