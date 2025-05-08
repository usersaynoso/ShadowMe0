import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  console.log(`API Request: ${method} ${url}`, data ? 'with data' : 'without data');
  
  // Don't set Content-Type header for FormData objects as browser will set it with the boundary
  const isFormData = data instanceof FormData;
  
  // For DELETE requests with data, we need to properly encode it
  const headers: HeadersInit = {};
  if (data && !isFormData) {
    headers['Content-Type'] = 'application/json';
    // Add explicit Accept header to request JSON
    headers['Accept'] = 'application/json';
  }
  
  // Some browsers/servers don't properly handle DELETE requests with bodies
  // For DELETE with data, consider using query parameters or custom headers
  let finalUrl = url;
  let body: any = isFormData ? data : data ? JSON.stringify(data) : undefined;
  
  if (method === 'DELETE' && data && typeof data === 'object') {
    // For DELETE requests with body in browsers that don't support it,
    // we could move the data to the URL as query parameters
    try {
      console.log(`Converting DELETE body to query params`, data);
      const params = new URLSearchParams();
      Object.entries(data as Record<string, any>).forEach(([key, value]) => {
        params.append(key, String(value));
      });
      finalUrl = `${url}${url.includes('?') ? '&' : '?'}${params.toString()}`;
      console.log(`Final DELETE URL with params: ${finalUrl}`);
      // We still keep the body in case the server supports it
    } catch (e) {
      console.error('Error converting DELETE body to query params:', e);
    }
  }
  
  const res = await fetch(finalUrl, {
    method,
    headers,
    body,
    credentials: "include",
  });

  console.log(`API Response status: ${res.status} for ${method} ${url}`);
  console.log(`API Response Content-Type: ${res.headers.get('Content-Type')}`);
  
  // Special handling for successful responses that may not be JSON
  if (res.ok) {
    // Clone the response to avoid consuming it
    const clonedRes = res.clone();
    const contentType = res.headers.get('Content-Type') || '';
    
    // If HTML was returned but we expected JSON, create a new Response with empty JSON
    if (contentType.includes('text/html')) {
      console.warn('Server returned HTML instead of JSON. Creating empty JSON response.');
      const jsonResponse = new Response(JSON.stringify({ success: true }), {
        status: res.status,
        statusText: res.statusText,
        headers: new Headers({
          'Content-Type': 'application/json'
        })
      });
      return jsonResponse;
    }
    
    // For non-JSON responses with 2xx status, just return success
    if (!contentType.includes('application/json') && method !== 'GET') {
      console.log('Server returned non-JSON successful response');
      const jsonResponse = new Response(JSON.stringify({ success: true }), {
        status: res.status,
        statusText: res.statusText,
        headers: new Headers({
          'Content-Type': 'application/json'
        })
      });
      return jsonResponse;
    }
    
    return res;
  }
  
  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export function getQueryFn<T>({ on401: unauthorizedBehavior }: { on401: UnauthorizedBehavior }): QueryFunction<T> {
  return async ({ queryKey }) => {
    console.log('getQueryFn: Fetching data for', queryKey[0]);
    try {
      const res = await fetch(queryKey[0] as string, {
        credentials: "include",
      });

      console.log('getQueryFn: Response status', res.status);
      
      if (unauthorizedBehavior === "returnNull" && res.status === 401) {
        console.log('getQueryFn: Unauthorized, returning null as requested');
        return null as unknown as T;
      }

      await throwIfResNotOk(res);
      const data = await res.json();
      console.log('getQueryFn: Received data', data);
      return data as T;
    } catch (error) {
      console.error('getQueryFn: Error fetching data', error);
      throw error;
    }
  };
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: true,
      staleTime: 0,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
