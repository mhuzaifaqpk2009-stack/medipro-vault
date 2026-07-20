import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { AppTopbar } from "@/components/AppTopbar";
import { useAutoSave } from "@/hooks/use-autosave";
import { useProjectStore } from "@/store/project-store";
import { useSession } from "@/store/session-store";

export const Route = createFileRoute("/app")({
  head: () => ({
    meta: [
      { title: "MediCore Workspace" },
      { name: "robots", content: "noindex" },
    ],
  }),
  beforeLoad: () => {
    if (typeof window !== "undefined") {
      if (!useSession.getState().user) throw redirect({ to: "/" });
      if (!useProjectStore.getState().data) throw redirect({ to: "/" });
    }
  },
  component: AppLayout,
});

function AppLayout() {
  useAutoSave();
  const data = useProjectStore((s) => s.data);
  if (!data) return null;

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background">
        <AppSidebar />
        <SidebarInset className="flex min-w-0 flex-1 flex-col">
          <AppTopbar />
          <main className="flex-1 overflow-auto">
            <Outlet />
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
