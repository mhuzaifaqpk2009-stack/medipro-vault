import { RouterProvider } from "@tanstack/react-router";
import { QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { getRouter, getQueryClient } from "./router";
import { bridge } from "./lib/electron-bridge";
import { useProjectStore } from "./store/project-store";
import { PasswordPromptHost } from "./components/PasswordPromptDialog";
import { VoiceSearchOverlay } from "./components/VoiceSearchOverlay";
import { ActivityBadgeOverlay } from "./components/ActivityBadgeOverlay";
import { installLanguageObserver } from "./lib/language";

export default function App() {
  const [router] = useState(() => getRouter());
  const queryClient = getQueryClient();

  useEffect(() => {
    const cleanup = installLanguageObserver();
    return cleanup;
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem("medicore.theme");
    if (saved === "dark") document.documentElement.classList.add("dark");
  }, []);

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
      <PasswordPromptHost />
      <VoiceSearchOverlay />
      <ActivityBadgeOverlay />
    </QueryClientProvider>
  );
}
