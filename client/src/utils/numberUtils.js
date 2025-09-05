// Format number with commas for thousands
export function formatNumber(num) {
  if (num === null || num === undefined) return '0';
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

// Format currency with pound symbol and commas
export function formatCurrency(amount, showPence = false) {
  if (!amount && amount !== 0) return '£0';
  
  // Convert to number if it's a string
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  
  if (showPence) {
    // Show with 2 decimal places
    return `£${num.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  } else {
    // Round to nearest pound
    return `£${Math.round(num).toLocaleString('en-GB')}`;
  }
}

// Format large currency amounts (in thousands or millions)
export function formatLargeCurrency(amount, decimals = 1) {
  if (!amount && amount !== 0) return '£0';
  
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  
  if (num >= 1000000) {
    // Millions
    return `£${(num / 1000000).toFixed(decimals)}M`;
  } else if (num >= 1000) {
    // Thousands
    return `£${(num / 1000).toFixed(decimals === 0 ? 0 : decimals)}k`;
  } else {
    // Less than 1000
    return `£${num.toFixed(0)}`;
  }
}

// Format percentage
export function formatPercentage(value, decimals = 0) {
  if (value === null || value === undefined) return 'N/A';
  return `${parseFloat(value).toFixed(decimals)}%`;
}

// Format ratio (e.g., LTV/CAC)
export function formatRatio(value, decimals = 1) {
  if (value === null || value === undefined) return 'N/A';
  return parseFloat(value).toFixed(decimals);
}