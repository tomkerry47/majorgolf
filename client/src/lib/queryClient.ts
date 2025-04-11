import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { getToken } from "./auth";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = await res.text();
    console.log('API response status:', res.status);
    try {
      const data = JSON.parse(text);
      console.log('API data:', data);
      throw new Error(`${res.status}: ${data.error || res.statusText}`);
    } catch (e) {
      throw new Error(`${res.status}: ${text || res.statusText}`);
    }
  }
}

export async function apiRequest<T = any>(
  url: string,
  method: string = 'GET',
  data?: unknown | undefined,
): Promise<T> {
  // Restored header logic
  const token = getToken();
  const headers: Record<string, string> = {};
  let body: BodyInit | null | undefined = undefined;

  // Check if data is FormData
  if (data instanceof FormData) {
    // Don't set Content-Type for FormData, fetch handles it
    body = data;
  } else if (data) {
    // For other data types (like JSON), set Content-Type and stringify
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(data);
  }

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(url, {
    method,
    headers, // Headers might be empty or just contain Authorization
    body: body, // Use the prepared body
    credentials: "include",
  });

  // Handle 404 specifically: return null to indicate resource not found
  if (res.status === 404) {
    console.log(`API request to ${url} returned 404, returning null.`);
    return null as T; // Return null for 404
  }

  // For other errors, use the existing helper
  await throwIfResNotOk(res); 
  
  // Handle potential empty response body for non-error statuses (e.g., 204 No Content)
  const text = await res.text();
  try {
    // First, attempt to parse
    const jsonData = JSON.parse(text);
    // If successful, return the parsed data
    return jsonData as T;
  } catch (e: any) { // Catch the error object
    // Log detailed error information if parsing fails
    console.error(`Failed to parse JSON response from ${url}. Status: ${res.status}. Error:`, e);
    // Log the raw text that failed to parse (be mindful of large responses in production)
    console.error("Raw response text:", text); 
    // Still return null as per previous logic, but now with better diagnostics
    return null as T; 
  }
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    // Get token from localStorage
    const token = getToken();
    
    const headers: Record<string, string> = {};
    
    // Add Authorization header if token exists
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
    
    // Special handling for admin routes
    const url = queryKey[0] as string;
    if (url.startsWith('/api/admin/') && !token) {
      console.error('No auth token available for admin route:', url);
      if (unauthorizedBehavior === "returnNull") {
        return null;
      } else {
        throw new Error('Authentication required for admin routes');
      }
    }
    
    const res = await fetch(url, {
      headers,
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
