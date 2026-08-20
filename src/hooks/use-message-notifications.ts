import { useEffect, useRef } from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { getMessages } from "@/lib/messages";
import { useNotificationStore } from "@/store/notification-store";
import { useProjectStore } from "@/store/project-store";
import { useSession } from "@/store/session-store";

/** Turns newly received private messages into rich notification-center items and an immediate toast. */
export function useMessageNotifications() {
  const data = useProjectStore((s) => s.data);
  const user = useSession((s) => s.user);
  const add = useNotificationStore((s) => s.add);
  const navigate = useNavigate();
  const snapshot = useRef("");
  useEffect(() => {
    if (!user || !data) return;
    const messages = getMessages(data);
    const current = JSON.stringify(messages.map((m) => ({ id: m.id, to: m.toUserId, from: m.fromUserId, createdAt: m.createdAt })));
    if (!snapshot.current) { snapshot.current = current; return; }
    const old = JSON.parse(snapshot.current) as Array<{ id: string }>;
    const oldIds = new Set(old.map((m) => m.id));
    for (const message of messages) {
      if (message.toUserId !== user.id || message.fromUserId === user.id || oldIds.has(message.id)) continue;
      add({
        id: `message:${message.id}:${user.id}`,
        type: "messageReceived",
        username: message.fromUsername,
        timestamp: message.createdAt,
        entityId: message.id,
        recipientUserId: user.id,
        details: message.body,
        priority: message.priority,
      });
      const open = () => {
        try { sessionStorage.setItem("medicore.focus-message", message.id); } catch {}
        navigate({ to: "/app/messages" });
      };
      toast.info(`New message from ${message.fromUsername}`, {
        description: `${message.priority.toUpperCase()} · ${message.body.slice(0, 140)}`,
        duration: 7000,
        action: { label: "Open Messages", onClick: open },
      });
    }
    snapshot.current = current;
  }, [data, user, add, navigate]);
}
