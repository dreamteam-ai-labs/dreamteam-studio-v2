# Studio V2 Backlog

## Performance Optimizations

### Optimize show-cluster-themes.sql for n8n workflow
- **Current Issue**: SQL query returns ~1,886 rows (377 clusters × 5 problems each) which is inefficient for data transfer
- **Current Behavior**: Each cluster's metadata is repeated 5 times, one row per sample problem
- **Constraint**: Must maintain exact compatibility with existing n8n code node that expects:
  - Field named `sample_problems` (singular)
  - Multiple rows with same `cluster_id` 
  - String value for each problem title
  - Rows that can be grouped by `cluster_id`
- **Potential Solution**: Consider updating both SQL and n8n code node together when time permits for testing
- **Priority**: Low (current solution works correctly despite inefficiency)
- **File**: `studio-v2\show-cluster-themes.sql`