import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import {
  FolderOpen,
  Plus,
  Search,
  Lock,
  Clock,
  Trash2,
  Pencil,
  Copy,
  Stethoscope,
  ShieldCheck,
  Zap,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

import { CreateProjectDialog } from "@/components/CreateProjectDialog";
import { PasswordDialog } from "@/components/PasswordDialog";
import { RenameDialog } from "@/components/RenameDialog";

import {
  readRecents,
  removeRecent,
  renameRecent,
  upsertRecent,
  type RecentProject,
} from "@/lib/recents";
import { pickOpenFile, pickSaveFile, writeToHandle } from "@/lib/project-io";
import {
  decodeProject,
  encodeProject,
  peekEncrypted,
  WrongPasswordError,
} from "@/lib/project-codec";
import { openProjectFromBytes } from "@/store/project-store";
import type { ProjectData } from "@/domain/schema";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "MediCore — Projects" },
      {
        name: "description",
        content: "Open or create a pharmacy project. Everything is stored locally.",
      },
    ],
  }),
  component: ProjectManagerPage,
});

function ProjectManagerPage() {
  const navigate = useNavigate();
  const [recents, setRecents] = useState<RecentProject[]>([]);
  const [query, setQuery] = useState("");
  const [createOpen, setCreateOpen] = useState(false);

  const [pwState, setPwState] = useState<{
    open: boolean;
    bytes?: Uint8Array;
    handle?: any;
    name: string;
    error?: string;
    busy?: boolean;
    onCancel?: () => void;
  }>({ open: false, name: "" });

  const [renameTarget, setRenameTarget] = useState<RecentProject | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<RecentProject | null>(null);

  useEffect(() => {
    setRecents(readRecents());
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return recents;
    return recents.filter(
      (r) => r.name.toLowerCase().includes(q) || r.path.toLowerCase().includes(q),
    );
  }, [recents, query]);

  async function handleOpen() {
    try {
      const picked = await pickOpenFile();
      if (!picked) return;
      await ingestBytes(picked.bytes, picked.handle);
    } catch (e: any) {
      toast.error(e?.message ?? "Could not open project");
    }
  }

  async function ingestBytes(bytes: Uint8Array, handle: any) {
    const enc = await peekEncrypted(bytes).catch(() => {
      throw new Error("Not a MediCore project file");
    });
    if (!enc) {
      const data = await openProjectFromBytes(bytes, handle);
      toast.success(`Opened “${data.meta.name}”`);
      navigate({ to: "/app" });
      return;
    }
    setPwState({
      open: true,
      bytes,
      handle,
      name: handle?.name ?? "project",
      onCancel: () => setPwState({ open: false, name: "" }),
    });
  }

  async function submitPassword(pw: string) {
    if (!pwState.bytes) return;
    setPwState((s) => ({ ...s, busy: true, error: undefined }));
    try {
      const { payload } = await decodeProject(pwState.bytes, pw);
      const data = payload as unknown as ProjectData;
      await openProjectFromBytes(pwState.bytes, pwState.handle, pw).catch(() => data);
      toast.success(`Opened “${data.meta.name}”`);
      setPwState({ open: false, name: "" });
      navigate({ to: "/app" });
    } catch (e) {
      if (e instanceof WrongPasswordError) {
        setPwState((s) => ({ ...s, busy: false, error: "Incorrect password" }));
      } else {
        setPwState({ open: false, name: "" });
        toast.error("Could not open project");
      }
    }
  }

  async function openRecent(r: RecentProject) {
    // Browser cannot re-open by remembered path — always ask user to pick.
    // In Electron, main process reads by fsPath directly.
    if (typeof window !== "undefined" && (window as any).medicore && r.fsPath) {
      try {
        const bytes: Uint8Array = await (window as any).medicore.project.readFile(r.fsPath);
        await ingestBytes(bytes, {
          kind: "electron",
          name: r.name,
          path: r.fsPath,
          fsPath: r.fsPath,
        });
      } catch (e: any) {
        toast.error(e?.message ?? "Missing file");
        removeRecent(r.id);
        setRecents(readRecents());
      }
      return;
    }
    toast.message("Locate the project file", {
      description: "Browsers can't reopen files silently. Please pick the file.",
    });
    handleOpen();
  }

  async function duplicateProject(r: RecentProject) {
    // Only possible in Electron with a real fsPath. Otherwise, ask user to pick then re-save.
    try {
      let bytes: Uint8Array | null = null;
      if ((window as any).medicore && r.fsPath) {
        bytes = await (window as any).medicore.project.readFile(r.fsPath);
      } else {
        toast.message("Pick the source file to duplicate");
        const picked = await pickOpenFile();
        if (!picked) return;
        bytes = picked.bytes;
      }
      // Save-As
      const handle = await pickSaveFile(`${r.name} (Copy)`);
      if (!handle) return;
      await writeToHandle(handle, bytes!);
      upsertRecent({
        name: `${r.name} (Copy)`,
        path: handle.path,
        fsPath: handle.fsPath,
        encrypted: r.encrypted,
      });
      setRecents(readRecents());
      toast.success("Duplicated project");
    } catch (e: any) {
      toast.error(e?.message ?? "Duplicate failed");
    }
  }

  function doRename(name: string) {
    if (!renameTarget) return;
    renameRecent(renameTarget.id, name);
    setRenameTarget(null);
    setRecents(readRecents());
  }

  function doDelete() {
    if (!deleteTarget) return;
    removeRecent(deleteTarget.id);
    setDeleteTarget(null);
    setRecents(readRecents());
    toast.success("Removed from list");
  }

  return (
    <div className="hero-bg min-h-screen">
      <div className="mx-auto flex min-h-screen max-w-6xl flex-col gap-10 px-6 py-12">
        <header className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border bg-card/70 px-3 py-1 text-xs backdrop-blur">
              <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
              <span className="font-medium text-muted-foreground">Offline · Local storage</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="grid h-12 w-12 place-items-center rounded-xl bg-primary text-primary-foreground shadow-elevated">
                <Stethoscope className="h-6 w-6" />
              </div>
              <div>
                <h1 className="font-display text-4xl font-bold tracking-tight">MediCore</h1>
                <p className="text-sm text-muted-foreground">
                  Professional pharmacy management — every project is one portable file.
                </p>
              </div>
            </div>
          </motion.div>

          <div className="flex flex-wrap items-center gap-2">
            <Button size="lg" onClick={() => setCreateOpen(true)}>
              <Plus className="mr-2 h-4 w-4" /> Create project
            </Button>
            <Button size="lg" variant="outline" onClick={handleOpen}>
              <FolderOpen className="mr-2 h-4 w-4" /> Open project
            </Button>
          </div>
        </header>

        <div className="grid gap-4 md:grid-cols-3">
          <FeatureCard
            icon={<ShieldCheck className="h-4 w-4" />}
            title="Fully offline"
            body="No cloud, no accounts. Your data never leaves the machine you save it on."
          />
          <FeatureCard
            icon={<Lock className="h-4 w-4" />}
            title="Optional encryption"
            body="Protect a project with a password. AES-256 encrypts the entire file."
          />
          <FeatureCard
            icon={<Zap className="h-4 w-4" />}
            title="Portable file"
            body="Copy the .medicore file to another computer and pick up where you left off."
          />
        </div>

        <section className="surface-card p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-lg font-semibold">Recent projects</h2>
              <p className="text-xs text-muted-foreground">
                {recents.length} project{recents.length === 1 ? "" : "s"} remembered on this device.
              </p>
            </div>
            <div className="relative">
              <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search recent projects"
                className="h-9 w-64 pl-8"
              />
            </div>
          </div>

          {recents.length === 0 ? (
            <EmptyState onCreate={() => setCreateOpen(true)} onOpen={handleOpen} />
          ) : filtered.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">
              No projects match “{query}”.
            </p>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2">
              {filtered.map((r) => (
                <RecentCard
                  key={r.id}
                  project={r}
                  onOpen={() => openRecent(r)}
                  onRename={() => setRenameTarget(r)}
                  onDelete={() => setDeleteTarget(r)}
                  onDuplicate={() => duplicateProject(r)}
                />
              ))}
            </ul>
          )}
        </section>

        <footer className="mt-auto pt-4 text-center text-xs text-muted-foreground">
          MediCore · Offline pharmacy management · v0.1
        </footer>
      </div>

      <CreateProjectDialog open={createOpen} onOpenChange={setCreateOpen} />

      <PasswordDialog
        open={pwState.open}
        projectName={pwState.name}
        onCancel={() => setPwState({ open: false, name: "" })}
        onSubmit={submitPassword}
        error={pwState.error}
        busy={pwState.busy}
      />

      <RenameDialog
        open={!!renameTarget}
        initial={renameTarget?.name ?? ""}
        onCancel={() => setRenameTarget(null)}
        onSubmit={doRename}
      />

      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove from recent list?</AlertDialogTitle>
            <AlertDialogDescription>
              This only removes the reference from MediCore. The project file at{" "}
              <span className="font-mono">{deleteTarget?.path}</span> is not deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={doDelete}>Remove</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div className="surface-card p-4">
      <div className="mb-2 flex items-center gap-2">
        <span className="grid h-7 w-7 place-items-center rounded-md bg-primary/10 text-primary">
          {icon}
        </span>
        <p className="text-sm font-semibold">{title}</p>
      </div>
      <p className="text-xs leading-relaxed text-muted-foreground">{body}</p>
    </div>
  );
}

function EmptyState({ onCreate, onOpen }: { onCreate: () => void; onOpen: () => void }) {
  return (
    <div className="grid place-items-center gap-3 rounded-lg border border-dashed py-14 text-center">
      <div className="grid h-12 w-12 place-items-center rounded-full bg-primary/10 text-primary">
        <FolderOpen className="h-5 w-5" />
      </div>
      <div>
        <p className="font-display text-base font-semibold">No projects yet</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Create your first pharmacy or open an existing project file.
        </p>
      </div>
      <div className="mt-2 flex gap-2">
        <Button onClick={onCreate}>
          <Plus className="mr-2 h-4 w-4" /> Create
        </Button>
        <Button variant="outline" onClick={onOpen}>
          <FolderOpen className="mr-2 h-4 w-4" /> Open
        </Button>
      </div>
    </div>
  );
}

function RecentCard({
  project,
  onOpen,
  onRename,
  onDelete,
  onDuplicate,
}: {
  project: RecentProject;
  onOpen: () => void;
  onRename: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
}) {
  return (
    <motion.li
      whileHover={{ y: -2 }}
      className="group flex items-start justify-between gap-3 rounded-xl border bg-card p-4 shadow-soft transition-shadow hover:shadow-elevated"
    >
      <button onClick={onOpen} className="flex flex-1 items-start gap-3 text-left">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-primary to-primary-glow text-primary-foreground shadow-soft">
          <Stethoscope className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <p className="truncate font-display text-sm font-semibold">{project.name}</p>
            {project.encrypted && (
              <Lock className="h-3 w-3 text-muted-foreground" />
            )}
          </div>
          <p className="mt-0.5 truncate font-mono text-[11px] text-muted-foreground">
            {project.path}
          </p>
          <p className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
            <Clock className="h-3 w-3" />
            {new Date(project.lastOpened).toLocaleString()}
          </p>
        </div>
      </button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="opacity-60 group-hover:opacity-100">
            <span className="text-lg leading-none">⋯</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={onOpen}>
            <FolderOpen className="mr-2 h-4 w-4" /> Open
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onRename}>
            <Pencil className="mr-2 h-4 w-4" /> Rename
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onDuplicate}>
            <Copy className="mr-2 h-4 w-4" /> Duplicate
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={onDelete} className="text-destructive focus:text-destructive">
            <Trash2 className="mr-2 h-4 w-4" /> Remove
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </motion.li>
  );
}
