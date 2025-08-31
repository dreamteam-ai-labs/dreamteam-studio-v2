import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  connectionString: 'postgresql://neondb_owner:npg_jJimfsE3h1yt@ep-round-night-abifvtjf-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require',
  ssl: {
    rejectUnauthorized: false
  }
});

async function fixClusterLabels() {
  try {
    console.log('Starting cluster label fix...\n');
    
    // First, let's see what we're going to update
    const previewQuery = `
      SELECT 
        p.cluster_id,
        c.cluster_label,
        COUNT(*) as problem_count
      FROM dreamteam.problems p
      INNER JOIN dreamteam.cluster_centroids c 
        ON p.cluster_id = c.cluster_id
      WHERE p.cluster_id IS NOT NULL 
        AND p.cluster_label IS NULL
        AND c.version = (SELECT MAX(version) FROM dreamteam.cluster_centroids)
      GROUP BY p.cluster_id, c.cluster_label
      ORDER BY problem_count DESC
    `;
    
    const previewResult = await pool.query(previewQuery);
    console.log('=== Clusters to be updated ===');
    previewResult.rows.forEach(row => {
      console.log(`${row.cluster_label}: ${row.problem_count} problems`);
    });
    
    // Now perform the update
    const updateQuery = `
      UPDATE dreamteam.problems p
      SET cluster_label = c.cluster_label
      FROM dreamteam.cluster_centroids c
      WHERE p.cluster_id = c.cluster_id
        AND p.cluster_id IS NOT NULL
        AND p.cluster_label IS NULL
        AND c.version = (SELECT MAX(version) FROM dreamteam.cluster_centroids)
    `;
    
    console.log('\nPerforming update...');
    const updateResult = await pool.query(updateQuery);
    console.log(`✅ Updated ${updateResult.rowCount} problems with their cluster labels`);
    
    // Verify the fix
    const verifyQuery = `
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN cluster_id IS NOT NULL AND cluster_label IS NULL THEN 1 END) as still_missing_labels,
        COUNT(CASE WHEN cluster_id IS NOT NULL AND cluster_label IS NOT NULL THEN 1 END) as properly_labeled,
        COUNT(CASE WHEN cluster_id IS NULL THEN 1 END) as unclustered
      FROM dreamteam.problems
    `;
    
    const verifyResult = await pool.query(verifyQuery);
    console.log('\n=== Final Status ===');
    console.log(verifyResult.rows[0]);
    
    // Show a sample of the fixed data
    const sampleQuery = `
      SELECT 
        title,
        cluster_id,
        cluster_label
      FROM dreamteam.problems
      WHERE cluster_id IS NOT NULL
      ORDER BY RANDOM()
      LIMIT 5
    `;
    
    const sampleResult = await pool.query(sampleQuery);
    console.log('\n=== Sample of Fixed Problems ===');
    sampleResult.rows.forEach(row => {
      console.log(`- ${row.title.substring(0, 50)}...`);
      console.log(`  Cluster: ${row.cluster_label}`);
    });
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

// Run the fix
fixClusterLabels();