import dotenv from 'dotenv';
dotenv.config();

/**
 * GCP Identity Platform Service
 * Handles tenant management for GCP Identity Platform
 */
class GcpService {
  constructor() {
    this.projectId = process.env.GCP_PROJECT_ID;
    this.apiKey = process.env.GCP_API_KEY;
    // For service account auth, you'd use a JWT token instead
    this.serviceAccountKey = process.env.GCP_SERVICE_ACCOUNT_KEY;
  }

  /**
   * Get an access token using service account credentials
   * Uses the Google Auth Library approach
   */
  async getAccessToken() {
    if (!this.serviceAccountKey) {
      console.warn('GCP_SERVICE_ACCOUNT_KEY not configured, skipping GCP operations');
      return null;
    }

    try {
      const { GoogleAuth } = await import('google-auth-library');
      const credentials = JSON.parse(this.serviceAccountKey);

      const auth = new GoogleAuth({
        credentials,
        scopes: ['https://www.googleapis.com/auth/identitytoolkit']
      });

      const client = await auth.getClient();
      const tokenResponse = await client.getAccessToken();
      return tokenResponse.token;
    } catch (error) {
      console.error('Error getting GCP access token:', error.message);
      return null;
    }
  }

  /**
   * Delete a GCP Identity Platform tenant
   * @param {string} tenantId - The tenant ID to delete (e.g., "myapp-abc123")
   * @returns {Promise<{success: boolean, tenantId: string, error?: string}>}
   */
  async deleteTenant(tenantId) {
    if (!this.projectId) {
      console.warn('GCP_PROJECT_ID not configured, skipping tenant deletion');
      return { success: false, tenantId, error: 'GCP_PROJECT_ID not configured' };
    }

    if (!tenantId) {
      return { success: false, tenantId, error: 'No tenant ID provided' };
    }

    try {
      const accessToken = await this.getAccessToken();
      if (!accessToken) {
        return { success: false, tenantId, error: 'Could not obtain access token' };
      }

      // GCP Identity Toolkit API endpoint for deleting a tenant
      const url = `https://identitytoolkit.googleapis.com/v2/projects/${this.projectId}/tenants/${tenantId}`;

      console.log(`Deleting GCP tenant: ${tenantId}`);

      const response = await fetch(url, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        console.log(`Successfully deleted GCP tenant: ${tenantId}`);
        return { success: true, tenantId };
      }

      // Handle specific error codes
      if (response.status === 404) {
        console.log(`GCP tenant not found (already deleted?): ${tenantId}`);
        return { success: true, tenantId, note: 'Tenant not found (may already be deleted)' };
      }

      const errorData = await response.json().catch(() => ({}));
      const errorMessage = errorData.error?.message || `HTTP ${response.status}`;
      console.error(`Failed to delete GCP tenant ${tenantId}:`, errorMessage);
      return { success: false, tenantId, error: errorMessage };

    } catch (error) {
      console.error(`Error deleting GCP tenant ${tenantId}:`, error.message);
      return { success: false, tenantId, error: error.message };
    }
  }

  /**
   * Delete multiple GCP Identity Platform tenants
   * @param {Array<{id: string, tenantId: string, name: string}>} tenants - Array of tenant info
   * @returns {Promise<{deleted: Array, failed: Array}>}
   */
  async deleteTenants(tenants) {
    if (!tenants || tenants.length === 0) {
      return { deleted: [], failed: [] };
    }

    const results = {
      deleted: [],
      failed: []
    };

    for (const tenant of tenants) {
      const result = await this.deleteTenant(tenant.tenantId);
      if (result.success) {
        results.deleted.push({
          productId: tenant.id,
          tenantId: tenant.tenantId,
          productName: tenant.name
        });
      } else {
        results.failed.push({
          productId: tenant.id,
          tenantId: tenant.tenantId,
          productName: tenant.name,
          error: result.error
        });
      }
    }

    console.log(`GCP tenant deletion complete: ${results.deleted.length} deleted, ${results.failed.length} failed`);
    return results;
  }

  /**
   * Test GCP connection
   */
  async testConnection() {
    if (!this.projectId) {
      return { connected: false, error: 'GCP_PROJECT_ID not configured' };
    }

    try {
      const accessToken = await this.getAccessToken();
      if (!accessToken) {
        return { connected: false, error: 'Could not obtain access token' };
      }

      // List tenants to test connection
      const url = `https://identitytoolkit.googleapis.com/v2/projects/${this.projectId}/tenants?pageSize=1`;
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });

      if (response.ok) {
        return { connected: true, projectId: this.projectId };
      }

      return { connected: false, error: `HTTP ${response.status}` };
    } catch (error) {
      return { connected: false, error: error.message };
    }
  }
}

export default new GcpService();
