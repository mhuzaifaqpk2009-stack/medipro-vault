import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Check, CheckCheck, MessageSquare, Send, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useProjectStore } from "@/store/project-store";
import { useSession } from "@/store/session-store";
import { readInstall } from "@/lib/install";
import { addMessage, getMessages, markMessageRead, type MessagePriority } from "@/lib/messages";

export const Route = createFileRoute("/app/messages")({ component: MessagesPage });

function MessagesPage() {
  const data = useProjectStore((s) => s.data)!;
  const mutate = useProjectStore((s) => s.mutate);
  const save = useProjectStore((s) => s.save);
  const user = useSession((s) => s.user)!;
  const users = readInstall()?.users ?? [];
  const admins = users.filter((u) => u.role === "admin");
  const canMessageUsers = user.role === "admin" || user.roleTemplate === "manager";
  const recipients = canMessageUsers ? users.filter((u) => u.id !== user.id) : admins;
  const [recipientId, setRecipientId] = useState(recipients[0]?.id ?? "");
  const [body, setBody] = useState("");
  const [priority, setPriority] = useState<MessagePriority>("normal");
  const messages = useMemo(() => getMessages(data).filter((m) => m.fromUserId === user.id || m.toUserId === user.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt)), [data, user.id]);
  const canSend = canMessageUsers || user.permissions.messagesToAdmin === true;

  async function send() {
    const text = body.trim();
    const target = users.find((u) => u.id === recipientId);
    if (!text || !target) return;
    const now = new Date().toISOString();
    mutate((d) => addMessage(d, { id: crypto.randomUUID(), fromUserId: user.id, fromUsername: user.username, toUserId: target.id, toUsername: target.username, body: text, priority, createdAt: now, deliveredAt: now }));
    setBody("");
    const ok = await save();
    if (ok) toast.success(`Message sent to ${target.username}`); else toast.error("Message could not be saved");
  }

  function openMessage(id: string) {
    if (!messages.find((m) => m.id === id)?.readAt) {
      mutate((d) => markMessageRead(d, id, user.id));
      void save();
    }
  }

  return <div className="mx-auto max-w-5xl p-6 md:p-10">
    <header className="mb-6 flex items-center gap-3"><div className="grid h-11 w-11 place-items-center rounded-xl bg-primary/10 text-primary"><MessageSquare className="h-5 w-5" /></div><div><h1 className="font-display text-2xl font-bold tracking-tight">Messages</h1><p className="text-sm text-muted-foreground">Private internal instructions between the pharmacy administrator and staff.</p></div></header>
    <div className="grid gap-5 lg:grid-cols-[360px_1fr]">
      {canSend ? <section className="surface-card p-5"><h2 className="font-display text-base font-semibold">New message</h2><p className="mt-1 text-xs text-muted-foreground">{canMessageUsers ? "Admins and Managers can message other users." : "Your account is allowed to send messages to an administrator."}</p><div className="mt-5 space-y-4"><div><Label>To</Label><Select value={recipientId} onValueChange={setRecipientId}><SelectTrigger className="mt-1.5"><SelectValue placeholder="Select recipient" /></SelectTrigger><SelectContent>{recipients.map((r) => <SelectItem key={r.id} value={r.id}>{r.username}{r.role === "admin" ? " (Admin)" : ""}</SelectItem>)}</SelectContent></Select></div><div><Label>Priority</Label><Select value={priority} onValueChange={(v) => setPriority(v as MessagePriority)}><SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="normal">🟢 Normal</SelectItem><SelectItem value="important">🟡 Important</SelectItem><SelectItem value="urgent">🔴 Urgent</SelectItem></SelectContent></Select></div><div><Label>Message</Label><Textarea value={body} onChange={(e) => setBody(e.target.value)} onKeyDown={(e) => { if ((e.ctrlKey || e.metaKey) && e.key === "Enter") { e.preventDefault(); void send(); } }} placeholder="Type an instruction…" className="mt-1.5 min-h-32" maxLength={1000} /><p className="mt-1 text-right text-[11px] text-muted-foreground">Ctrl+Enter to send · {body.length}/1000</p></div><Button className="w-full" disabled={!body.trim() || !recipientId} onClick={() => void send()}><Send className="mr-2 h-4 w-4" /> Send message</Button></div></section> : <section className="surface-card p-5"><div className="flex items-center gap-3"><ShieldAlert className="h-5 w-5 text-muted-foreground" /><div><h2 className="font-display text-base font-semibold">Sending disabled</h2><p className="text-xs text-muted-foreground">Ask an administrator to enable “Send messages to Admin” for your account.</p></div></div></section>}
      <section className="surface-card overflow-hidden"><div className="border-b px-5 py-4"><h2 className="font-display text-base font-semibold">Conversation history</h2><p className="text-xs text-muted-foreground">Messages remain in the pharmacy project history.</p></div><div className="divide-y">{messages.length === 0 ? <div className="p-10 text-center text-sm text-muted-foreground">No messages yet.</div> : messages.map((m) => { const mine = m.fromUserId === user.id; const read = !!m.readAt; return <button key={m.id} type="button" className={`block w-full p-5 text-left transition hover:bg-accent/40 ${!mine && !read ? "bg-primary/5" : ""}`} onClick={() => openMessage(m.id)}><div className="flex items-start justify-between gap-3"><div><p className="font-medium">{mine ? `To ${m.toUsername}` : `From ${m.fromUsername}`}</p><p className="mt-0.5 text-xs text-muted-foreground">{new Date(m.createdAt).toLocaleString()} · {m.priority === "urgent" ? "🔴 Urgent" : m.priority === "important" ? "🟡 Important" : "Normal"}</p></div>{mine && <span className="flex items-center gap-1 text-xs text-muted-foreground" title={read ? "Read" : m.deliveredAt ? "Delivered" : "Sent"}>{read ? <><CheckCheck className="h-4 w-4 text-primary" />✓✓</> : m.deliveredAt ? <><CheckCheck className="h-4 w-4" />✓✓</> : <><Check className="h-4 w-4" />✓</>}</span>}</div><p className="mt-3 whitespace-pre-wrap text-sm">{m.body}</p>{!mine && !read && <p className="mt-2 text-xs font-medium text-primary">New message · click to mark read</p>}</button>; })}</div></section>
    </div>
  </div>;
}
