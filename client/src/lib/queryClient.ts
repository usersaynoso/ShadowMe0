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
  // Don't set Content-Type header for FormData objects as browser will set it with the boundary
  const isFormData = data instanceof FormData;
  
  const res = await fetch(url, {
    method,
    headers: data && !isFormData ? { "Content-Type": "application/json" } : {},
    body: isFormData ? data : data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

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
