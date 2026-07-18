import { RouterProvider } from "@tanstack/react-router";
import { QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { getRouter, getQueryClient } from "./router";
import { bridge } from "./lib/electron-bridge";
import { useProjectStore } from "./store/project-store";

export default function App() {
  const [router] = useState(() => getRouter());
  const queryClient = getQueryClient();

  useEffect(() => {
    const saved = localStorage.getItem("medicore.theme");
    if (saved === "dark") document.documentElement.classList.add("dark");
  }, []);

  // Wire native "Save then quit" handler once.
  useEffect(() => {
    const api = bridge();
    if (!api) return;
    const off = api.app.onSaveAndQuit(async () => {
      const ok = await useProjectStore.getState().save();
      await api.app.saveCompleted(ok);
    });
    return off;
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  );
}
