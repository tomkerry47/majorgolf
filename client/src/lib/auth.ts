// Direct JWT authentication service

interface LoginResponse {
  user: {
    id: string;
    email: string;
    username: string;
    avatarUrl?: string;
    isAdmin: boolean;
  };
  token: string;
}

// Store token in localStorage
const TOKEN_KEY = 'auth_token';
const USER_KEY = 'auth_user';

// Get and set token
export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function removeToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

// Get and set user
export function getStoredUser(): any | null {
  const userStr = localStorage.getItem(USER_KEY);
  return userStr ? JSON.parse(userStr) : null;
}

export function setStoredUser(user: any): void {
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function removeStoredUser(): void {
  localStorage.removeItem(USER_KEY);
}

// Authentication functions
export async function login(email: string, password: string): Promise<LoginResponse> {
  console.log('Attempting to login with direct JWT auth:', { email });
  
  const response = await fetch('/api/auth/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, password }),
    credentials: 'include',
  });
  
  if (!response.ok) {
    const errorData = await response.json();
    console.error('Login error:', errorData);
    throw new Error(errorData.error || 'Login failed');
  }
  
  const data = await response.json();
  console.log('Login successful:', data);
  
  // Store auth data
  setToken(data.token);
  setStoredUser(data.user);
  
  return data;
}

export async function logout(): Promise<void> {
  try {
    // Call logout endpoint
    await fetch('/api/auth/logout', {
      method: 'POST',
      credentials: 'include',
    });
  } catch (error) {
    console.error('Error during logout:', error);
  } finally {
    // Clear local storage regardless of server response
    removeToken();
    removeStoredUser();
  }
}

export async function fetchUserProfile(userId: string): Promise<any> {
  const token = getToken();
  
  if (!token) {
    throw new Error('No authentication token');
  }
  
  const response = await fetch(`/api/users/${userId}`, {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
    credentials: 'include',
  });
  
  if (!response.ok) {
    throw new Error('Failed to fetch user profile');
  }
  
  return response.json();
}

// Check if user is authenticated
export function isAuthenticated(): boolean {
  return !!getToken() && !!getStoredUser();
}

// Get auth headers helper function
export function getAuthHeaders(): Record<string, string> {
  const token = getToken();
  const headers: Record<string, string> = {};
  
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  
  return headers;
}
