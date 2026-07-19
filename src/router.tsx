import { QueryClient } from "@tanstack/react-query";
import { createRouter, createHashHistory } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

let queryClient: QueryClient | undefined;
export function getQueryClient(): QueryClient {
  if (!queryClient) queryClient = new QueryClient();
  return queryClient;
}

export function getRouter() {
  return createRouter({
    routeTree,
    context: { queryClient: getQueryClient() },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
    history: createHashHistory(),
  });
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}
