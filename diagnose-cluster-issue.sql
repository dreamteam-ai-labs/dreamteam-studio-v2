-- Diagnose the exact cluster situation
SET search_path TO dreamteam, public;

-- 1. Check active cluster version
SELECT 
    'Active cluster version' as check,
    COALESCE(
        (SELECT version FROM dreamteam.cluster_versions WHERE is_active = true),
        (SELECT MAX(version) FROM dreamteam.cluster_centroids),
        0
    ) as value;

-- 2. Check all cluster versions
SELECT 
    'All cluster versions' as check,
    version,
    is_active,
    created_at
FROM dreamteam.cluster_versions
ORDER BY version DESC;

-- 3. Check centroids for each version
SELECT 
    'Centroids by version' as check,
    version,
    COUNT(*) as centroid_count
FROM dreamteam.cluster_centroids
GROUP BY version
ORDER BY version DESC;

-- 4. Find the specific orphaned cluster
SELECT 
    'Orphaned cluster details' as check,
    cluster_id,
    COUNT(*) as problem_count
FROM dreamteam.problems
WHERE cluster_id = 'c38ff1f3-8ed4-4e9b-8cb5-f438fdb3b62f'
   OR cluster_id::text LIKE 'c38ff1f3%'
GROUP BY cluster_id;

-- 5. Check if this cluster exists in ANY version of centroids
SELECT 
    'Cluster in centroids?' as check,
    c.cluster_id,
    c.version,
    c.cluster_label,
    c.is_outlier_bucket
FROM dreamteam.cluster_centroids c
WHERE c.cluster_id = 'c38ff1f3-8ed4-4e9b-8cb5-f438fdb3b62f'
   OR c.cluster_id::text LIKE 'c38ff1f3%';

-- 6. Check problem cluster versions
SELECT 
    'Problem cluster versions' as check,
    cluster_version,
    COUNT(*) as problem_count
FROM dreamteam.problems
WHERE cluster_id IS NOT NULL
GROUP BY cluster_version
ORDER BY cluster_version;

-- 7. Find ALL orphaned clusters (checking all versions)
WITH all_problem_clusters AS (
    SELECT DISTINCT cluster_id
    FROM dreamteam.problems
    WHERE cluster_id IS NOT NULL
),
all_centroid_clusters AS (
    SELECT DISTINCT cluster_id
    FROM dreamteam.cluster_centroids
)
SELECT 
    'Orphaned clusters (not in ANY centroid version)' as check,
    p.cluster_id,
    COUNT(*) as problem_count
FROM dreamteam.problems p
WHERE p.cluster_id IN (
    SELECT cluster_id FROM all_problem_clusters
    WHERE cluster_id NOT IN (SELECT cluster_id FROM all_centroid_clusters)
)
GROUP BY p.cluster_id;