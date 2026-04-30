import type { Request, Response } from "express";
import { storage } from "../storage";

export interface ParsedEmail {
  messageId: string;
  fromEmail: string;
  fromName: string;
  subject: string;
  text: string;
  html?: string;
  inReplyTo?: string;
}

function parseSendgrid(body: any): ParsedEmail {
  return {
    messageId: body.headers?.match(/Message-ID:\s*<([^>]+)>/i)?.[1] ?? `sg-${Date.now()}`,
    fromEmail: (body.from ?? "").replace(/.*<|>/g, "").trim() || body.from,
    fromName: (body.from ?? "").replace(/<.*>/, "").trim(),
    subject: body.subject ?? "(no subject)",
    text: body.text ?? body.html ?? "",
    inReplyTo: body.headers?.match(/In-Reply-To:\s*<([^>]+)>/i)?.[1],
  };
}

function parsePostmark(body: any): ParsedEmail {
  return {
    messageId: body.MessageID ?? `pm-${Date.now()}`,
    fromEmail: body.FromFull?.Email ?? body.From ?? "",
    fromName: body.FromFull?.Name ?? body.FromName ?? "",
    subject: body.Subject ?? "(no subject)",
    text: body.TextBody ?? body.HtmlBody ?? "",
    inReplyTo: body.Headers?.find((h: any) => h.Name === "In-Reply-To")?.Value,
  };
}

function parseMailgun(body: any): ParsedEmail {
  return {
    messageId: (body["Message-Id"] ?? `mg-${Date.now()}`).replace(/[<>]/g, ""),
    fromEmail: (body.sender ?? body.from ?? "").replace(/.*<|>/g, "").trim(),
    fromName: (body.from ?? "").replace(/<.*>/, "").trim(),
    subject: body.subject ?? "(no subject)",
    text: body["body-plain"] ?? body["stripped-text"] ?? body["body-html"] ?? "",
    inReplyTo: body["In-Reply-To"]?.replace(/[<>]/g, ""),
  };
}

function detectProvider(body: any): "sendgrid" | "postmark" | "mailgun" | "generic" {
  if (body.FromFull || body.MessageID) return "postmark";
  if (body["Message-Id"] || body["body-plain"] || body.sender) return "mailgun";
  if (body.headers || (body.from && body.text !== undefined)) return "sendgrid";
  return "generic";
}

function parseGeneric(body: any): ParsedEmail {
  return {
    messageId: body.message_id ?? body.messageId ?? `generic-${Date.now()}`,
    fromEmail: body.from_email ?? body.fromEmail ?? body.from ?? "unknown@unknown.com",
    fromName: body.from_name ?? body.fromName ?? "",
    subject: body.subject ?? "(no subject)",
    text: body.text ?? body.body ?? body.content ?? "",
    inReplyTo: body.in_reply_to ?? body.inReplyTo,
  };
}

export function parseInboundEmail(body: any): ParsedEmail {
  const provider = detectProvider(body);
  switch (provider) {
    case "postmark": return parsePostmark(body);
    case "mailgun": return parseMailgun(body);
    case "sendgrid": return parseSendgrid(body);
    default: return parseGeneric(body);
  }
}

export async function handleEmailInbound(req: Request, res: Response): Promise<void> {
  const channelId = req.params.channelId as string;

  try {
    const channel = await storage.getChannel(channelId);
    if (!channel || (channel.type as string) !== "email" || !channel.isActive) {
      res.status(404).json({ error: "Email channel not found or inactive" });
      return;
    }

    const config = (channel.config ?? {}) as Record<string, any>;
    const agentId: string | undefined = config.agentId;
    const orchestratorId: string = (await storage.getOrchestrator(channel.orchestratorId))?.id
      ?? channel.orchestratorId;

    const email = parseInboundEmail(req.body);
    if (!email.fromEmail || !email.text) {
      res.status(400).json({ error: "Missing required email fields" });
      return;
    }

    const threadKey: string = email.inReplyTo ?? email.messageId;
    let thread = await storage.getEmailThread(channelId as string, threadKey as string);

    const prompt = `Inbound email from ${email.fromName ? `${email.fromName} <${email.fromEmail}>` : email.fromEmail}
Subject: ${email.subject}

${email.text.slice(0, 8000)}`;

    if (!thread) {
      thread = await storage.createEmailThread({
        channelId,
        messageId: threadKey,
        fromEmail: email.fromEmail,
        fromName: email.fromName || null,
        subject: email.subject || null,
        agentId: agentId ?? null,
      });
    }

    const task = await storage.createTask({
      orchestratorId,
      agentId: agentId ?? undefined,
      input: prompt,
      status: "pending",
      priority: 5,
      intent: "conversational",
      bypassApproval: false,
      commsThreadId: thread.id,
    });

    await storage.touchEmailThread(thread.id);
    console.log(`[email-inbound] Received email from ${email.fromEmail} → task ${task.id}`);

    res.json({ ok: true, taskId: task.id, threadId: thread.id });
  } catch (err: any) {
    console.error("[email-inbound] Error:", err);
    res.status(500).json({ error: "Internal error processing email" });
  }
}
