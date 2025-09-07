import http from 'http';

function fetchJSON(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch (e) { reject(e); }
      });
    }).on('error', reject);
  });
}

async function investigate() {
  const problems = await fetchJSON('http://localhost:3006/api/problems');
  const clusters = await fetchJSON('http://localhost:3006/api/clusters');
  
  // Group problems by cluster_id
  const clusterGroups = {};
  problems.forEach(p => {
    if (p.cluster_id) {
      if (!clusterGroups[p.cluster_id]) {
        clusterGroups[p.cluster_id] = {
          id: p.cluster_id,
          label: p.cluster_label,
          problems: []
        };
      }
      clusterGroups[p.cluster_id].problems.push({
        title: p.title,
        impact: p.impact
      });
    }
  });
  
  console.log('\n=== CLUSTER INVESTIGATION ===');
  const clusterIds = Object.keys(clusterGroups);
  console.log('Unique cluster IDs in problems table:', clusterIds.length);
  console.log('Clusters in cluster_centroids table:', clusters.length);
  
  // Find the clusters that exist in API
  const apiClusterIds = new Set(clusters.map(c => c.cluster_id));
  
  // Show clusters in problems but not in centroids
  const orphanedIds = clusterIds.filter(id => !apiClusterIds.has(id));
  if (orphanedIds.length > 0) {
    console.log('\n⚠️  ORPHANED CLUSTER IDS (in problems but not in centroids):');
    orphanedIds.forEach(id => {
      const cluster = clusterGroups[id];
      console.log(`  ${id.substring(0, 8)}... - ${cluster.problems.length} problems - Label: "${cluster.label || 'NO LABEL'}"`);
      // Show first few problem titles
      console.log('    Sample problems:');
      cluster.problems.slice(0, 3).forEach(p => {
        console.log(`      - ${p.title.substring(0, 60)}... (${p.impact})`);
      });
    });
  }
  
  // Check for clusters with labels vs without
  const withLabel = Object.values(clusterGroups).filter(c => c.label).length;
  const withoutLabel = Object.values(clusterGroups).filter(c => !c.label).length;
  
  console.log('\n=== LABEL STATUS ===');
  console.log(`Clusters with labels: ${withLabel}`);
  console.log(`Clusters without labels: ${withoutLabel}`);
  
  // Check if there's a version mismatch
  console.log('\n=== POSSIBLE CAUSES ===');
  if (orphanedIds.length > 0) {
    console.log('1. Cluster centroids table is missing entries for some cluster IDs');
    console.log('2. Clustering was done but centroids were not generated');
    console.log('3. There may be a version mismatch in the clustering data');
    console.log('\n💡 SOLUTION: You need to run the clustering process to generate centroids for ALL clusters');
  }
}

investigate().catch(console.error);