import { RouterProvider } from "@tanstack/react-router";
import { QueryClientProvider } from "@tanstack/react-query";
import { Component, type ReactNode, useEffect, useState } from "react";
import { getRouter, getQueryClient } from "./router";
import { bridge } from "./lib/electron-bridge";
import { useProjectStore } from "./store/project-store";
import { PasswordPromptHost } from "./components/PasswordPromptDialog";
import { VoiceSearchOverlay } from "./components/VoiceSearchOverlay";
import { ActivityBadgeOverlay } from "./components/ActivityBadgeOverlay";
import { ExternalLinkFixes } from "./components/ExternalLinkFixes";
import { installLanguageObserver } from "./lib/language";

type ErrorState = { error: Error | null };
class AppErrorBoundary extends Component<{ children: ReactNode }, ErrorState> {
  state: ErrorState = { error: null };
  static getDerivedStateFromError(error: Error): ErrorState { return { error }; }
  render() {
    if (!this.state.error) return this.props.children;
    return <div className="grid min-h-screen place-items-center bg-background p-8"><div className="max-w-xl rounded-xl border bg-card p-8 text-center shadow-lg"><h1 className="font-display text-2xl font-bold">Something went wrong</h1><p className="mt-2 text-sm text-muted-foreground">The application hit an unexpected runtime error instead of showing a blank screen.</p><pre className="mt-4 max-h-40 overflow-auto rounded-lg bg-muted p-3 text-left text-xs">{this.state.error.message}</pre><button className="mt-5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground" onClick={() => window.location.reload()}>Reload application</button></div></div>;
  }
}

export default function App() {
  const [router] = useState(() => getRouter());
  const queryClient = getQueryClient();
  useEffect(() => installLanguageObserver(), []);
  useEffect(() => { const saved = localStorage.getItem("medicore.theme"); if (saved === "dark") document.documentElement.classList.add("dark"); }, []);
  useEffect(() => { const api = bridge(); if (!api) return; const off = api.app.onSaveAndQuit(async () => { const ok = await useProjectStore.getState().save(); await api.app.saveCompleted(ok); }); return off; }, []);
  return <AppErrorBoundary><QueryClientProvider client={queryClient}><RouterProvider router={router} /><PasswordPromptHost /><VoiceSearchOverlay /><ActivityBadgeOverlay /><ExternalLinkFixes /></QueryClientProvider></AppErrorBoundary>;
}
