// src/config/api.js

const getBackendUrl = () => {
  // Check if we're in a browser environment
  if (typeof window !== 'undefined') {
    // Client-side: use NEXT_PUBLIC_ prefixed variables
    return (
      process.env.NEXT_PUBLIC_METADATA_SERVICE_URL || 'http://localhost:3001'
    )
  } else {
    // Server-side (during SSR)
    return (
      process.env.METADATA_SERVICE_URL ||
      process.env.NEXT_PUBLIC_METADATA_SERVICE_URL ||
      'http://localhost:3001'
    )
  }
}

export const apiConfig = {
  backendUrl: getBackendUrl(),
  fallbackEnabled: process.env.NEXT_PUBLIC_FALLBACK_ENABLED !== 'false'
}
