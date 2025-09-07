-- Test script to check and create clustering scenarios
SET search_path TO dreamteam, public;

-- Check current scenarios
SELECT 
  id,
  entity_type,
  k_value,
  similarity_threshold,
  status,
  requested_at,
  completed_at,
  outlier_percentage
FROM dreamteam.clustering_scenarios
ORDER BY requested_at DESC
LIMIT 10;

-- Create a test scenario for problems with different K value
-- Uncomment to create:
/*
SELECT dreamteam.create_clustering_scenario(
  'problem',      -- entity_type
  10,            -- k_value (lower than default)
  0.60,          -- similarity_threshold (higher than default 0.55)
  'test-user',   -- requested_by
  'Testing lower K with higher threshold'  -- notes
);
*/

-- Check if any scenarios are pending
SELECT COUNT(*) as pending_count
FROM dreamteam.clustering_scenarios
WHERE status = 'pending';