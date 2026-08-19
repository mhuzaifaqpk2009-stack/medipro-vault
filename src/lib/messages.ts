import type { ProjectData } from "@/domain/schema";

export type MessagePriority = "normal" | "important" | "urgent";
export interface PharmacyMessage {
  id: string;
  fromUserId: string;
  fromUsername: string;
  toUserId: string;
  toUsername: string;
  body: string;
  priority: MessagePriority;
  createdAt: string;
  deliveredAt?: string;
  readAt?: string;
}

export function getMessages(data: ProjectData | null | undefined): PharmacyMessage[] {
  return (data as (ProjectData & { messages?: PharmacyMessage[] }) | null | undefined)?.messages ?? [];
}

export function unreadMessages(data: ProjectData | null | undefined, userId?: string | null): PharmacyMessage[] {
  if (!userId) return [];
  return getMessages(data).filter((m) => m.toUserId === userId && !m.readAt);
}

export function addMessage(data: ProjectData, message: PharmacyMessage) {
  const d = data as ProjectData & { messages?: PharmacyMessage[] };
  d.messages = [...(d.messages ?? []), message];
}

export function markMessageRead(data: ProjectData, messageId: string, userId: string) {
  const d = data as ProjectData & { messages?: PharmacyMessage[] };
  const message = d.messages?.find((m) => m.id === messageId && m.toUserId === userId);
  if (message && !message.readAt) message.readAt = new Date().toISOString();
}
