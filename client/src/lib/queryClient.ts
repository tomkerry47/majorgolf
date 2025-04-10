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
  if (data) {
    headers["Content-Type"] = "application/json";
  }
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(url, {
    method,
    headers, // Restored headers
    body: data ? JSON.stringify(data) : undefined,
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
    return JSON.parse(text) as T;
  } catch (e) {
    // If parsing fails but status was ok, return null or handle as appropriate
    console.warn(`Failed to parse JSON response from ${url}, but status was ${res.status}. Returning null.`);
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
