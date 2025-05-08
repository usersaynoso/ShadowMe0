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
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
