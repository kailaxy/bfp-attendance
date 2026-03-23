/**
 * Format a timestamp relative to now (e.g., "2 min ago")
 * @param {number|Date|null} timestamp - ISO string, milliseconds, or Date
 * @returns {string} Relative time display
 */
export const getRelativeTime = (timestamp) => {
  if (!timestamp) {
    return 'Never'
  }

  const date = timestamp instanceof Date ? timestamp : new Date(timestamp)
  if (Number.isNaN(date.getTime())) {
    return 'Unknown'
  }

  const now = new Date()
  const diff = (now - date) / 1000 // seconds

  if (diff < 60) {
    return 'Just now'
  }
  if (diff < 3600) {
    const mins = Math.floor(diff / 60)
    return `${mins} min${mins > 1 ? 's' : ''} ago`
  }
  if (diff < 86400) {
    const hrs = Math.floor(diff / 3600)
    return `${hrs} hr${hrs > 1 ? 's' : ''} ago`
  }
  if (diff < 604800) {
    const days = Math.floor(diff / 86400)
    return `${days} day${days > 1 ? 's' : ''} ago`
  }

  return date.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

/**
 * Format a timestamp as absolute time (e.g., "Jan 15, 2:30 PM")
 */
export const getAbsoluteTime = (timestamp) => {
  if (!timestamp) {
    return 'Never'
  }

  const date = timestamp instanceof Date ? timestamp : new Date(timestamp)
  if (Number.isNaN(date.getTime())) {
    return 'Unknown'
  }

  return date.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    meridiem: 'short',
  })
}
