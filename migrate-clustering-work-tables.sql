-- ============================================
-- Migration: Add Clustering Work Tables
-- ============================================
-- Run this ONLY to add work tables to existing database that already has scenarios
-- Safe to run multiple times (idempotent)
-- If starting fresh, just run 05-clustering-scenarios.sql instead

SET search_path TO dreamteam, public;

-- Work table for items being clustered
CREATE TABLE IF NOT EXISTS dreamteam.clustering_work_items (
  session_id UUID NOT NULL,
  item_id UUID NOT NULL,
  embedding vector(1536) NOT NULL,
  assigned_cluster_id UUID,
  similarity FLOAT,
  PRIMARY KEY (session_id, item_id)
);

-- Work table for centroids
CREATE TABLE IF NOT EXISTS dreamteam.clustering_work_centroids (
  session_id UUID NOT NULL,
  cluster_id UUID NOT NULL,
  centroid_embedding vector(1536) NOT NULL,
  is_outlier_bucket BOOLEAN DEFAULT FALSE,
  PRIMARY KEY (session_id, cluster_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_clustering_work_items_session 
  ON dreamteam.clustering_work_items(session_id);
  
CREATE INDEX IF NOT EXISTS idx_clustering_work_centroids_session 
  ON dreamteam.clustering_work_centroids(session_id);

-- IMPORTANT: After running this migration, you should also re-run 05-clustering-scenarios.sql
-- to update all functions with the latest fixes (including ROUND() casting fixes).
-- The functions are CREATE OR REPLACE so it's safe to re-run.

-- Check tables were created
SELECT 
  'clustering_work_items' as table_name,
  COUNT(*) as row_count
FROM dreamteam.clustering_work_items
UNION ALL
SELECT 
  'clustering_work_centroids' as table_name,
  COUNT(*) as row_count
FROM dreamteam.clustering_work_centroids;

-- Migration complete. Work tables created successfully.