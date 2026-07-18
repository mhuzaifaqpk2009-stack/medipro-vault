import { RouterProvider } from "@tanstack/react-router";
import { QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { getRouter, getQueryClient } from "./router";

export default function App() {
  const [router] = useState(() => getRouter());
  const queryClient = getQueryClient();

  useEffect(() => {
    const saved = localStorage.getItem("medicore.theme");
    if (saved === "dark") document.documentElement.classList.add("dark");
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  );
}
