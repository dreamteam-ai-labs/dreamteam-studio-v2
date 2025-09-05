// Format datetime with both date and time
export function formatDateTime(date) {
  if (!date) return 'N/A';
  
  const d = new Date(date);
  
  // Check if valid date
  if (isNaN(d.getTime())) return 'N/A';
  
  // Format: Jan 15, 2024, 3:45 PM (in local timezone)
  // The Date constructor will automatically handle ISO strings with Z correctly
  return d.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
}

// Format date only
export function formatDate(date) {
  if (!date) return 'N/A';
  
  const d = new Date(date);
  
  // Check if valid date
  if (isNaN(d.getTime())) return 'N/A';
  
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

// Check if an item is new (created within last n seconds)
export function isNewItem(createdAt, thresholdSeconds = 10) {
  if (!createdAt) return false;
  
  const now = new Date();
  const created = new Date(createdAt);
  const diffMs = now - created;
  const diffSeconds = diffMs / 1000;
  
  return diffSeconds <= thresholdSeconds;
}