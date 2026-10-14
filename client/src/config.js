// Centralized configuration for API base URL
// In production (e.g. Vercel), set VITE_API_URL in your environment variables.
// In local development, it falls back to http://localhost:5000.
export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
