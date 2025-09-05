-- Show top problems in each cluster to identify themes for labeling
-- Run this to understand what each cluster represents

SET search_path TO dreamteam, public;

-- Get top 5 problems from each cluster with their titles
WITH cluster_samples AS (
    SELECT 
        c.cluster_id,
        c.problem_count,
        c.avg_similarity,
        (
            SELECT array_agg(title ORDER BY cluster_similarity DESC)
            FROM (
                SELECT title, cluster_similarity
                FROM dreamteam.problems p
                WHERE p.cluster_id = c.cluster_id
                ORDER BY cluster_similarity DESC
                LIMIT 5
            ) top_problems
        ) as top_problems
    FROM dreamteam.cluster_summary c
    WHERE c.is_outlier_bucket = FALSE
    ORDER BY c.problem_count DESC
)
SELECT 
    cluster_id as cluster_id,  -- FULL UUID for use in updates
    problem_count as size,
    ROUND(avg_similarity::numeric, 3) as avg_sim,
    '---' as divider,
    unnest(top_problems) as sample_problems
FROM cluster_samples
ORDER BY problem_count DESC, array_position(top_problems, unnest(top_problems));