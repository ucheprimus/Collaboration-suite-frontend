// API Configuration
export const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";
export const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || "http://localhost:4000";
export const SERVER_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";

console.log('🔧 API Configuration:', {
  API_URL,
  SOCKET_URL,
  SERVER_URL,
  ENV_CHECK: {
    VITE_API_URL: import.meta.env.VITE_API_URL,
    VITE_SOCKET_URL: import.meta.env.VITE_SOCKET_URL,
  }
});

// Helper for API calls
export const fetchAPI = async (endpoint: string, options: RequestInit = {}) => {
  const url = `${API_URL}${endpoint}`;
  const { headers, ...restOptions } = options;
  
  console.log(`📡 API Request: ${options.method || 'GET'} ${url}`);
  
  try {
    const response = await fetch(url, {
      ...restOptions,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
      credentials: 'include',
    });

    if (!response.ok) {
      console.error(`❌ API Error: ${response.status} ${response.statusText}`);
    }

    return response;
  } catch (error) {
    console.error(`❌ API Request Failed:`, error);
    throw error;
  }
};