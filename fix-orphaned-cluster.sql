-- Fix for orphaned cluster issue
-- This will clear the orphaned cluster assignments so F2 can properly re-cluster them

SET search_path TO dreamteam, public;

-- Step 1: Identify the orphaned cluster
WITH orphaned_clusters AS (
    SELECT DISTINCT p.cluster_id
    FROM dreamteam.problems p
    WHERE p.cluster_id IS NOT NULL
    AND NOT EXISTS (
        SELECT 1 
        FROM dreamteam.cluster_centroids c
        WHERE c.cluster_id = p.cluster_id
        AND c.version = (
            SELECT COALESCE(
                (SELECT version FROM dreamteam.cluster_versions WHERE is_active = true),
                (SELECT MAX(version) FROM dreamteam.cluster_centroids)
            )
        )
    )
)
SELECT 
    cluster_id,
    COUNT(*) as affected_problems
FROM dreamteam.problems
WHERE cluster_id IN (SELECT cluster_id FROM orphaned_clusters)
GROUP BY cluster_id;

-- Step 2: Clear the orphaned cluster assignments
-- This makes these problems available for proper clustering
UPDATE dreamteam.problems 
SET 
    cluster_id = NULL,
    cluster_label = NULL,
    cluster_similarity = NULL,
    cluster_version = NULL
WHERE cluster_id IN (
    SELECT DISTINCT p.cluster_id
    FROM dreamteam.problems p
    WHERE p.cluster_id IS NOT NULL
    AND NOT EXISTS (
        SELECT 1 
        FROM dreamteam.cluster_centroids c
        WHERE c.cluster_id = p.cluster_id
        AND c.version = (
            SELECT COALESCE(
                (SELECT version FROM dreamteam.cluster_versions WHERE is_active = true),
                (SELECT MAX(version) FROM dreamteam.cluster_centroids)
            )
        )
    )
);

-- Step 3: Show the result
SELECT 
    COUNT(*) as cleared_problems
FROM dreamteam.problems
WHERE cluster_id IS NULL
AND embedding_normalized IS NOT NULL;

-- Step 4: Show current state
SELECT 
    'Total Problems' as metric,
    COUNT(*) as count
FROM dreamteam.problems
UNION ALL
SELECT 
    'Problems with embeddings' as metric,
    COUNT(*) as count
FROM dreamteam.problems
WHERE embedding_normalized IS NOT NULL
UNION ALL
SELECT 
    'Clustered Problems' as metric,
    COUNT(*) as count
FROM dreamteam.problems
WHERE cluster_id IS NOT NULL
UNION ALL
SELECT 
    'Unclustered Problems (ready for clustering)' as metric,
    COUNT(*) as count
FROM dreamteam.problems
WHERE cluster_id IS NULL
AND embedding_normalized IS NOT NULL;

-- Message
SELECT 
    'ORPHANED CLUSTERS CLEARED' as status,
    'Now run F2 in n8n to properly cluster all problems' as next_action;