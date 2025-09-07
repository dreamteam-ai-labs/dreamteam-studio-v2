-- Force complete re-clustering
-- This will clear ALL cluster assignments so F2 can start fresh

SET search_path TO dreamteam, public;

-- Show current state before clearing
SELECT 
    'BEFORE: Clustered problems' as status,
    COUNT(*) as count
FROM dreamteam.problems
WHERE cluster_id IS NOT NULL;

SELECT 
    'BEFORE: Problems in outlier bucket' as status,
    COUNT(*) as count
FROM dreamteam.problems p
JOIN dreamteam.cluster_centroids c ON p.cluster_id = c.cluster_id
WHERE c.is_outlier_bucket = true
  AND c.version = 13;

-- Clear ALL cluster assignments to force complete re-clustering
UPDATE dreamteam.problems 
SET 
    cluster_id = NULL,
    cluster_label = NULL,
    cluster_similarity = NULL,
    cluster_version = NULL;

-- Show result
SELECT 
    'AFTER: Cleared problems' as status,
    COUNT(*) as count
FROM dreamteam.problems
WHERE cluster_id IS NULL
  AND embedding_normalized IS NOT NULL;

-- Recommendation
SELECT 
    'NEXT STEPS' as action,
    'Run F2 in n8n with adjusted parameters (maybe lower similarity threshold)' as recommendation;