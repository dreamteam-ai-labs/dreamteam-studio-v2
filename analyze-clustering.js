import http from 'http';

function fetchJSON(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

async function analyze() {
  const problems = await fetchJSON('http://localhost:3006/api/problems');
  const clusters = await fetchJSON('http://localhost:3006/api/clusters');
  
  const totalProblems = problems.length;
  const clusteredProblems = problems.filter(p => p.cluster_id).length;
  const unclusteredProblems = totalProblems - clusteredProblems;
  
  console.log('\n=== CLUSTERING ANALYSIS ===');
  console.log('Total Problems:', totalProblems);
  console.log('Clustered Problems:', clusteredProblems, '(' + (clusteredProblems/totalProblems*100).toFixed(1) + '%)');
  console.log('Unclustered Problems:', unclusteredProblems, '(' + (unclusteredProblems/totalProblems*100).toFixed(1) + '%)');
  console.log('');
  console.log('Clusters from API:', clusters.length);
  
  const totalInClusters = clusters.reduce((sum, c) => {
    const count = parseInt(c.problem_count) || 0;
    return sum + count;
  }, 0);
  console.log('Problems counted in clusters:', totalInClusters);
  
  if (totalInClusters !== clusteredProblems) {
    console.log('');
    console.log('⚠️  MISMATCH DETECTED!');
    console.log('Problems with cluster_id:', clusteredProblems);
    console.log('Problems in active clusters:', totalInClusters);
    console.log('Missing from clusters:', clusteredProblems - totalInClusters);
    console.log('\nThis means problems were clustered but cluster_centroids table is missing or outdated.');
    console.log('You need to run the clustering process (F2) to regenerate cluster centroids.');
  }
  
  // Check for problems with cluster_id but no cluster in the centroids
  const clusterIds = new Set(clusters.map(c => c.cluster_id));
  const problemClusterIds = new Set(problems.filter(p => p.cluster_id).map(p => p.cluster_id));
  const orphanedClusterIds = [...problemClusterIds].filter(id => !clusterIds.has(id));
  
  if (orphanedClusterIds.length > 0) {
    console.log('\n⚠️  ORPHANED CLUSTERS:');
    console.log('Number of cluster IDs in problems but not in centroids:', orphanedClusterIds.length);
    const orphanedProblemCount = problems.filter(p => orphanedClusterIds.includes(p.cluster_id)).length;
    console.log('Affected problems:', orphanedProblemCount);
  }
}

analyze().catch(console.error);