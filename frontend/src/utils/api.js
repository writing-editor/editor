
// In src/utils/api.js
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';



export function debounce(func, delay) {
    let timeout;
    return function (...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), delay);
    };
}


/**
 * A generic helper for making API requests to the backend.
 * @param {string} endpoint The API endpoint to call (e.g., '/books').
 * @param {string} method The HTTP method (GET, POST, PUT, DELETE).
 * @param {object} body The JSON body for the request.
 * @returns {Promise<any>} The JSON response from the server.
 */

// A more generic request helper for different methods (GET, POST, PUT, DELETE)
export async function request(endpoint, method = 'GET', body = null) {
  try {
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    // --- NEW: Add the API key header for AI calls ---
    if (endpoint.startsWith('/ai/')) {
      const settings = JSON.parse(localStorage.getItem('app-settings') || '{}');
      const apiKey = settings.apiKey;

      if (!apiKey) {
        // If the key is missing, we can stop the request early.
        alert('API Key is not set. Please set it in the Settings panel.');
        return null; // Stop the request
      }
      // Send the key in a custom header
      options.headers['X-API-Key'] = apiKey;
    }
    // --- END OF NEW LOGIC ---

    if (body) {
      options.body = JSON.stringify(body);
    }
    
    const response = await fetch(`${API_BASE_URL}${endpoint}`, options);
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || `API Error: ${response.statusText}`);
    }
    if (response.status === 204) {
      return { status: 'success' };
    }
    return await response.json();
  } catch (error) {
    console.error(`API Error for ${method} ${endpoint}:`, error);
    // Here we can also provide user-facing feedback
    // app.showIndicator(`API Error: ${error.message}`, { isError: true, duration: 5000 });
    return null;
  }
}