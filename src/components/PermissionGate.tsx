import { ShieldAlert } from "lucide-react";
import { useSession } from "@/store/session-store";
import type { UserPermissions } from "@/lib/users";

type PermKey = keyof UserPermissions;

export function PermissionGate({
  perm,
  children,
}: {
  perm: PermKey;
  children: React.ReactNode;
}) {
  const user = useSession((s) => s.user);
  if (!user) return null;
  if (user.role === "admin" || user.permissions[perm]) return <>{children}</>;
  return (
    <div className="grid h-full place-items-center p-8">
      <div className="surface-card max-w-md p-8 text-center">
        <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-full bg-destructive/10 text-destructive">
          <ShieldAlert className="h-6 w-6" />
        </div>
        <h2 className="font-display text-lg font-semibold">Access denied</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          You don't have permission to view this page. Ask the pharmacy administrator to
          enable the "<span className="font-medium">{perm}</span>" permission for your
          account.
        </p>
      </div>
    </div>
  );
}

export function AdminGate({ children }: { children: React.ReactNode }) {
  const user = useSession((s) => s.user);
  if (user?.role === "admin") return <>{children}</>;
  return (
    <div className="grid h-full place-items-center p-8">
      <div className="surface-card max-w-md p-8 text-center">
        <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-full bg-destructive/10 text-destructive">
          <ShieldAlert className="h-6 w-6" />
        </div>
        <h2 className="font-display text-lg font-semibold">Admin only</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          This section is restricted to administrators.
        </p>
      </div>
    </div>
  );
}
