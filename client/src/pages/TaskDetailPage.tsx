import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  ArrowLeft, CheckCircle, XCircle, Clock, Loader2, Terminal,
  ChevronDown, ChevronRight, Wrench, Brain, Info, AlertTriangle, Zap,
  GitBranch, Network, ChevronUp, X, Cpu, Layers,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { Task, TaskLog } from "@shared/schema";
import { formatDistanceToNow, format } from "date-fns";
import { cn } from "@/lib/utils";

interface Props {
  taskId: string;
  workspaceId: string;
  orchestratorId: string;
}

const STATUS_CONFIG: Record<string, { icon: any; color: string; badge: string }> = {
  pending:   { icon: Clock,      color: "text-yellow-400", badge: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" },
  running:   { icon: Loader2,    color: "text-blue-400",   badge: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
  completed: { icon: CheckCircle,color: "text-green-400",  badge: "bg-green-500/20 text-green-400 border-green-500/30" },
  failed:    { icon: XCircle,    color: "text-red-400",    badge: "bg-red-500/20 text-red-400 border-red-500/30" },
};

// ── Log type renderers ────────────────────────────────────────────────────────

function ToolCallCard({ log, resultLog }: { log: TaskLog; resultLog?: TaskLog }) {
  const [open, setOpen] = useState(false);
  const meta = (log.metadata ?? {}) as Record<string, any>;
  const toolName = meta.tool as string ?? log.message.replace("Calling tool: ", "").replace("Running ", "").split(" ")[0];
  const args = meta.args as Record<string, any> | undefined;
  const isError = resultLog?.level === "error";
  const resultMeta = (resultLog?.metadata ?? {}) as Record<string, any>;

  return (
    <div className="flex gap-3 items-start">
      <div className="flex flex-col items-center shrink-0 mt-1">
        <div className="w-7 h-7 rounded-full bg-orange-500/15 border border-orange-500/30 flex items-center justify-center">
          <Wrench className="w-3.5 h-3.5 text-orange-400" />
        </div>
        {resultLog && <div className="w-px h-3 bg-border mt-1" />}
      </div>
      <div className="flex-1 min-w-0">
        <div
          className="flex items-center gap-2 cursor-pointer group"
          onClick={() => setOpen((o) => !o)}
          data-testid={`tool-call-${toolName}`}
        >
          <Badge variant="outline" className="text-[10px] font-mono border-orange-500/40 text-orange-400 bg-orange-500/5">
            {toolName}
          </Badge>
          <span className="text-xs text-muted-foreground">tool call</span>
          {open ? <ChevronDown className="w-3 h-3 text-muted-foreground" /> : <ChevronRight className="w-3 h-3 text-muted-foreground" />}
        </div>

        {open && args && (
          <div className="mt-2 rounded-md bg-muted/40 border border-border p-2.5 font-mono text-[11px] break-all whitespace-pre-wrap text-muted-foreground">
            {JSON.stringify(args, null, 2)}
          </div>
        )}

        {resultLog && (
          <div className={cn(
            "mt-2 rounded-md border px-3 py-2 text-xs flex items-start gap-2",
            isError
              ? "bg-red-500/5 border-red-500/20 text-red-400"
              : "bg-green-500/5 border-green-500/20 text-green-400"
          )}>
            <div className={cn("w-1.5 h-1.5 rounded-full mt-0.5 shrink-0", isError ? "bg-red-400" : "bg-green-400")} />
            <div className="min-w-0">
              <div className="font-medium">{isError ? "Error" : "Success"}</div>
              {resultMeta.result && (
                <div className="mt-1 text-[10px] font-mono text-muted-foreground break-all line-clamp-4">
                  {String(resultMeta.result).slice(0, 400)}
                  {String(resultMeta.result).length > 400 ? "…" : ""}
                </div>
              )}
              {!resultMeta.result && (
                <div className="text-[10px] text-muted-foreground">{resultLog.message}</div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ReasoningBlock({ log }: { log: TaskLog }) {
  const [collapsed, setCollapsed] = useState(false);
  const text = log.message;
  const isLong = text.length > 300;

  return (
    <div className="flex gap-3 items-start">
      <div className="flex flex-col items-center shrink-0 mt-1">
        <div className="w-7 h-7 rounded-full bg-blue-500/15 border border-blue-500/30 flex items-center justify-center">
          <Brain className="w-3.5 h-3.5 text-blue-400" />
        </div>
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[10px] text-muted-foreground mb-1 flex items-center gap-1.5">
          <span>LLM reasoning</span>
          {isLong && (
            <button
              onClick={() => setCollapsed((c) => !c)}
              className="text-primary hover:underline text-[10px]"
            >
              {collapsed ? "expand" : "collapse"}
            </button>
          )}
        </div>
        <div className={cn(
          "text-sm leading-relaxed text-foreground bg-blue-500/5 border border-blue-500/15 rounded-lg px-3 py-2 whitespace-pre-wrap",
          collapsed && "line-clamp-3"
        )}>
          {text}
        </div>
      </div>
    </div>
  );
}

function StreamingBubble({ text }: { text: string }) {
  if (!text) return null;
  return (
    <div className="flex gap-3 items-start">
      <div className="flex flex-col items-center shrink-0 mt-1">
        <div className="w-7 h-7 rounded-full bg-blue-500/15 border border-blue-500/30 flex items-center justify-center animate-pulse">
          <Brain className="w-3.5 h-3.5 text-blue-400" />
        </div>
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[10px] text-muted-foreground mb-1">Generating…</div>
        <div className="text-sm leading-relaxed text-foreground bg-blue-500/5 border border-blue-500/15 rounded-lg px-3 py-2 whitespace-pre-wrap">
          {text}<span className="inline-block w-0.5 h-4 bg-blue-400 animate-pulse ml-0.5 align-middle" />
        </div>
      </div>
    </div>
  );
}

function InfoLogRow({ log }: { log: TaskLog }) {
  const colors: Record<string, string> = {
    info:  "text-muted-foreground",
    warn:  "text-yellow-400",
    error: "text-red-400",
  };
  const icons: Record<string, any> = {
    info: Info,
    warn: AlertTriangle,
    error: XCircle,
  };
  const Icon = icons[log.level ?? "info"] ?? Info;

  return (
    <div className={cn("flex gap-2 items-start text-xs", colors[log.level ?? "info"])}>
      <Icon className="w-3 h-3 mt-0.5 shrink-0 opacity-60" />
      <span className="break-all leading-relaxed">{log.message}</span>
    </div>
  );
}

// ── Live Feed ─────────────────────────────────────────────────────────────────

function LiveFeed({ taskId, onDone }: { taskId: string; onDone: () => void }) {
  const [logs, setLogs] = useState<TaskLog[]>([]);
  const [streamingText, setStreamingText] = useState("");
  const [streaming, setStreaming] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const es = new EventSource(`/api/tasks/${taskId}/stream`, { withCredentials: true });

    es.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.type === "done") {
          setStreaming(false);
          setStreamingText("");
          es.close();
          onDone();
          return;
        }
        if (data.id) {
          // Clear streaming text when a reasoning log arrives (content was captured)
          if (data.logType === "reasoning") setStreamingText("");
          setLogs((prev) => prev.some((l) => l.id === data.id) ? prev : [...prev, data]);
        }
      } catch {}
    };

    es.addEventListener("token", (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data);
        setStreamingText((prev) => prev + (data.content ?? ""));
      } catch {}
    });

    es.onerror = () => {
      setStreaming(false);
      es.close();
    };

    return () => es.close();
  }, [taskId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs, streamingText]);

  // Build merged display: skip tool_result logs (they render inside their tool_call parent)
  const toolResults = new Map<number, TaskLog>();
  for (const log of logs) {
    if (log.logType === "tool_result" && log.parentLogId != null) {
      toolResults.set(log.parentLogId, log);
    }
  }

  const displayLogs = logs.filter((l) => l.logType !== "tool_result");

  return (
    <ScrollArea className="h-[480px]">
      <div className="p-4 space-y-4" data-testid="container-live-feed">
        {displayLogs.length === 0 && streaming && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="w-3 h-3 animate-spin" /> Waiting for agent to start…
          </div>
        )}

        {displayLogs.map((log) => {
          if (log.logType === "tool_call") {
            return (
              <ToolCallCard
                key={log.id}
                log={log}
                resultLog={toolResults.get(log.id)}
              />
            );
          }
          if (log.logType === "reasoning") {
            return <ReasoningBlock key={log.id} log={log} />;
          }
          return <InfoLogRow key={log.id} log={log} />;
        })}

        {streaming && <StreamingBubble text={streamingText} />}

        {!streaming && displayLogs.length === 0 && (
          <div className="text-xs text-muted-foreground text-center py-6">No execution logs captured</div>
        )}
        <div ref={bottomRef} />
      </div>
    </ScrollArea>
  );
}

// ── Trace Graph ───────────────────────────────────────────────────────────────

interface TraceData {
  logs: TaskLog[];
  task: Task | null;
}

function TraceNode({ log, resultLog, isLast }: { log: TaskLog; resultLog?: TaskLog; isLast: boolean }) {
  const [open, setOpen] = useState(false);

  const nodeStyle: Record<string, { dot: string; label: string; text: string }> = {
    info:        { dot: "bg-muted-foreground/40 border-muted-foreground/30", label: "text-muted-foreground", text: "text-muted-foreground" },
    reasoning:   { dot: "bg-blue-500 border-blue-400",                       label: "text-blue-400",          text: "text-foreground" },
    tool_call:   { dot: "bg-orange-500 border-orange-400",                    label: "text-orange-400",        text: "text-foreground" },
    tool_result: { dot: "bg-green-500 border-green-400",                      label: "text-green-400",         text: "text-foreground" },
    error:       { dot: "bg-red-500 border-red-400",                          label: "text-red-400",           text: "text-red-300" },
    warn:        { dot: "bg-yellow-500 border-yellow-400",                    label: "text-yellow-400",        text: "text-yellow-300" },
  };

  const type = log.logType === "info" && log.level === "warn" ? "warn"
             : log.logType === "info" && log.level === "error" ? "error"
             : log.logType ?? "info";

  const style = nodeStyle[type] ?? nodeStyle["info"];
  const meta = (log.metadata ?? {}) as Record<string, any>;
  const toolName = type === "tool_call" ? (meta.tool as string ?? log.message.replace("Calling tool: ", "")) : null;
  const isError = resultLog?.level === "error";

  return (
    <div className="flex gap-3">
      {/* Timeline spine */}
      <div className="flex flex-col items-center shrink-0">
        <div className={cn("w-2.5 h-2.5 rounded-full border mt-1.5 shrink-0", style.dot)} />
        {!isLast && <div className="w-px flex-1 bg-border mt-1" />}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 pb-4">
        <div className="flex items-center gap-2 mb-0.5">
          <span className={cn("text-[10px] font-semibold uppercase tracking-wide", style.label)}>
            {type === "tool_call" ? toolName ?? "tool" : type}
          </span>
          <span className="text-[10px] text-muted-foreground/50">
            {log.timestamp ? format(new Date(log.timestamp), "HH:mm:ss.SSS") : ""}
          </span>
        </div>

        {type === "reasoning" && (
          <div className="text-xs text-foreground/80 leading-relaxed whitespace-pre-wrap bg-blue-500/5 border border-blue-500/15 rounded-md px-2.5 py-2">
            {log.message.length > 400 && !open
              ? <>{log.message.slice(0, 400)}<button onClick={() => setOpen(true)} className="text-primary ml-1 hover:underline">…more</button></>
              : log.message
            }
          </div>
        )}

        {type === "tool_call" && (
          <div>
            {meta.args && (
              <div
                className="flex items-center gap-1 text-[10px] text-muted-foreground cursor-pointer hover:text-foreground"
                onClick={() => setOpen((o) => !o)}
              >
                {open ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                args
              </div>
            )}
            {open && meta.args && (
              <div className="mt-1 text-[10px] font-mono bg-muted/40 border border-border rounded p-2 break-all whitespace-pre-wrap text-muted-foreground">
                {JSON.stringify(meta.args, null, 2)}
              </div>
            )}
            {resultLog && (
              <div className={cn(
                "mt-2 text-[10px] rounded border px-2 py-1.5 flex items-start gap-1.5",
                isError ? "bg-red-500/5 border-red-500/20 text-red-400" : "bg-green-500/5 border-green-500/20 text-green-400"
              )}>
                <div className={cn("w-1.5 h-1.5 rounded-full mt-0.5 shrink-0", isError ? "bg-red-400" : "bg-green-400")} />
                <span>{isError ? resultLog.message : "Success"}</span>
              </div>
            )}
          </div>
        )}

        {(type === "info" || type === "warn" || type === "error") && (
          <div className={cn("text-xs", style.text, "leading-relaxed")}>{log.message}</div>
        )}
      </div>
    </div>
  );
}

function TraceGraph({ taskId }: { taskId: string }) {
  const { data, isLoading } = useQuery<TraceData>({
    queryKey: [`/api/tasks/${taskId}/trace`],
    refetchInterval: (query) => {
      const status = query.state.data?.task?.status;
      return (status === "running" || status === "pending") ? 3000 : false;
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground p-6">
        <Loader2 className="w-3 h-3 animate-spin" /> Loading trace…
      </div>
    );
  }

  const logs = data?.logs ?? [];
  if (logs.length === 0) {
    return <div className="text-xs text-muted-foreground text-center py-10">No trace data available</div>;
  }

  // Build tool results map for linking
  const toolResults = new Map<number, TaskLog>();
  for (const log of logs) {
    if (log.logType === "tool_result" && log.parentLogId != null) {
      toolResults.set(log.parentLogId, log);
    }
  }

  // Display: skip tool_results (shown inside their tool_call node)
  const display = logs.filter((l) => l.logType !== "tool_result");

  const status = data?.task?.status;
  const startTime = data?.task?.startedAt ? new Date(data.task.startedAt) : null;
  const endTime = data?.task?.completedAt ? new Date(data.task.completedAt) : null;
  const durationSec = startTime && endTime ? ((endTime.getTime() - startTime.getTime()) / 1000).toFixed(1) : null;

  return (
    <ScrollArea className="h-[480px]">
      <div className="p-4">
        {/* Start node */}
        <div className="flex gap-3 mb-0">
          <div className="flex flex-col items-center shrink-0">
            <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center">
              <Zap className="w-2.5 h-2.5 text-white" />
            </div>
            <div className="w-px flex-1 bg-border mt-1" style={{ minHeight: "16px" }} />
          </div>
          <div className="pb-4">
            <div className="text-xs font-semibold text-primary">Task Started</div>
            {startTime && <div className="text-[10px] text-muted-foreground">{format(startTime, "HH:mm:ss")}</div>}
          </div>
        </div>

        {/* Log nodes */}
        {display.map((log, i) => (
          <TraceNode
            key={log.id}
            log={log}
            resultLog={log.logType === "tool_call" ? toolResults.get(log.id) : undefined}
            isLast={i === display.length - 1 && !status}
          />
        ))}

        {/* End node */}
        {(status === "completed" || status === "failed") && (
          <div className="flex gap-3">
            <div className="flex flex-col items-center shrink-0">
              <div className={cn(
                "w-5 h-5 rounded-full flex items-center justify-center",
                status === "completed" ? "bg-green-500" : "bg-red-500"
              )}>
                {status === "completed"
                  ? <CheckCircle className="w-3 h-3 text-white" />
                  : <XCircle className="w-3 h-3 text-white" />
                }
              </div>
            </div>
            <div className="pb-2">
              <div className={cn("text-xs font-semibold", status === "completed" ? "text-green-400" : "text-red-400")}>
                {status === "completed" ? "Completed" : "Failed"}
              </div>
              {durationSec && <div className="text-[10px] text-muted-foreground">{durationSec}s total</div>}
            </div>
          </div>
        )}
      </div>
    </ScrollArea>
  );
}

// ── Span Graph (Phase 3) ──────────────────────────────────────────────────────

interface Span {
  id: string;
  taskId: string;
  parentSpanId: string | null;
  spanType: string;
  name: string;
  input: Record<string, unknown> | null;
  output: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
  status: string;
  startedAt: string | null;
  endedAt: string | null;
  durationMs: number | null;
  seq: number;
}

const SPAN_STYLES: Record<string, { bg: string; border: string; text: string; icon: any; label: string }> = {
  root:     { bg: "bg-primary/10",     border: "border-primary/40",     text: "text-primary",     icon: Layers, label: "Root" },
  llm_call: { bg: "bg-blue-500/10",    border: "border-blue-500/40",    text: "text-blue-400",    icon: Cpu, label: "LLM Call" },
  tool_call:{ bg: "bg-orange-500/10",  border: "border-orange-500/40",  text: "text-orange-400",  icon: Wrench, label: "Tool" },
  info:     { bg: "bg-muted",          border: "border-border",         text: "text-muted-foreground", icon: Info, label: "Info" },
};

function SpanNode({ span, indent = 0, onClick, isSelected }: {
  span: Span; indent?: number; onClick: (s: Span) => void; isSelected: boolean;
}) {
  const style = SPAN_STYLES[span.spanType] ?? SPAN_STYLES.info;
  const Icon = style.icon;
  const isRunning = span.status === "running";
  const isError = span.status === "error";

  return (
    <div
      className={cn(
        "flex items-center gap-2 p-2.5 rounded-lg border cursor-pointer transition-all hover:shadow-sm",
        style.bg, style.border,
        isSelected && "ring-2 ring-primary/60",
        indent > 0 && "ml-8",
      )}
      style={{ marginLeft: indent * 32 }}
      onClick={() => onClick(span)}
      data-testid={`span-node-${span.id}`}
    >
      <div className={cn("shrink-0", style.text)}>
        {isRunning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> :
         isError ? <XCircle className="w-3.5 h-3.5 text-red-400" /> :
         <Icon className="w-3.5 h-3.5" />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={cn("text-[10px] font-semibold uppercase tracking-wide shrink-0", style.text)}>
            {style.label}
          </span>
          <span className="text-xs text-foreground font-medium truncate">{span.name}</span>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {isError && <Badge variant="outline" className="text-[9px] border-red-500/40 text-red-400 bg-red-500/5">Error</Badge>}
        {span.durationMs != null && (
          <span className="text-[10px] text-muted-foreground font-mono">
            {span.durationMs < 1000 ? `${span.durationMs}ms` : `${(span.durationMs / 1000).toFixed(1)}s`}
          </span>
        )}
        {isRunning && (
          <Badge variant="outline" className="text-[9px] border-blue-500/40 text-blue-400 bg-blue-500/5 animate-pulse">live</Badge>
        )}
      </div>
    </div>
  );
}

function SpanDetailPanel({ span, onClose }: { span: Span; onClose: () => void }) {
  const style = SPAN_STYLES[span.spanType] ?? SPAN_STYLES.info;
  return (
    <div className="border-t border-border bg-muted/20 p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className={cn("text-xs font-semibold", style.text)}>{style.label}</span>
          <span className="text-sm font-medium">{span.name}</span>
          {span.durationMs != null && (
            <span className="text-xs text-muted-foreground font-mono">
              ({span.durationMs < 1000 ? `${span.durationMs}ms` : `${(span.durationMs / 1000).toFixed(1)}s`})
            </span>
          )}
        </div>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onClose}>
          <X className="w-3.5 h-3.5" />
        </Button>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {span.input && (
          <div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Input</div>
            <pre className="text-xs bg-muted/50 rounded p-2 overflow-auto max-h-40 whitespace-pre-wrap font-mono">
              {JSON.stringify(span.input, null, 2)}
            </pre>
          </div>
        )}
        {span.output && (
          <div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Output</div>
            <pre className="text-xs bg-muted/50 rounded p-2 overflow-auto max-h-40 whitespace-pre-wrap font-mono">
              {JSON.stringify(span.output, null, 2)}
            </pre>
          </div>
        )}
      </div>
      {span.metadata && Object.keys(span.metadata).length > 0 && (
        <div className="mt-3">
          <div className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Metadata</div>
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(span.metadata).map(([k, v]) => (
              <span key={k} className="text-[10px] font-mono bg-muted/50 rounded px-2 py-0.5">
                {k}: <span className="text-foreground">{String(v)}</span>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function SpanGraph({ taskId }: { taskId: string }) {
  const [selectedSpan, setSelectedSpan] = useState<Span | null>(null);
  const { data: spans = [], isLoading } = useQuery<Span[]>({
    queryKey: [`/api/tasks/${taskId}/spans`],
    refetchInterval: (q) => {
      const hasRunning = (q.state.data ?? []).some((s) => s.status === "running");
      return hasRunning ? 2500 : false;
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground p-6">
        <Loader2 className="w-3 h-3 animate-spin" /> Loading span graph…
      </div>
    );
  }

  if (spans.length === 0) {
    return (
      <div className="text-center py-12 px-4">
        <Network className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
        <div className="text-sm text-muted-foreground">No trace spans available</div>
        <div className="text-xs text-muted-foreground/60 mt-1">Spans are captured for tasks run after enabling trace instrumentation</div>
      </div>
    );
  }

  const sorted = [...spans].sort((a, b) => a.seq - b.seq);
  const root = sorted.find((s) => s.spanType === "root");
  const rest = sorted.filter((s) => s.spanType !== "root");

  const rounds: Array<{ llm: Span | null; tools: Span[] }> = [];
  let currentRound: { llm: Span | null; tools: Span[] } = { llm: null, tools: [] };
  for (const span of rest) {
    if (span.spanType === "llm_call") {
      if (currentRound.llm || currentRound.tools.length > 0) rounds.push(currentRound);
      currentRound = { llm: span, tools: [] };
    } else {
      currentRound.tools.push(span);
    }
  }
  if (currentRound.llm || currentRound.tools.length > 0) rounds.push(currentRound);

  const totalDurationMs = root?.durationMs ?? null;

  return (
    <div>
      <ScrollArea className="h-[460px]">
        <div className="p-4 space-y-2">
          {/* Stats row */}
          <div className="flex items-center gap-4 text-xs text-muted-foreground mb-4 pb-3 border-b border-border">
            <span>{spans.length} span{spans.length !== 1 ? "s" : ""}</span>
            <span>{rounds.length} LLM round{rounds.length !== 1 ? "s" : ""}</span>
            <span>{rest.filter((s) => s.spanType === "tool_call").length} tool call{rest.filter((s) => s.spanType === "tool_call").length !== 1 ? "s" : ""}</span>
            {totalDurationMs != null && (
              <span className="ml-auto font-mono">
                Total: {totalDurationMs < 1000 ? `${totalDurationMs}ms` : `${(totalDurationMs / 1000).toFixed(2)}s`}
              </span>
            )}
          </div>

          {/* Root span */}
          {root && (
            <SpanNode
              span={root}
              indent={0}
              onClick={(s) => setSelectedSpan(s === selectedSpan ? null : s)}
              isSelected={selectedSpan?.id === root.id}
            />
          )}

          {/* Rounds */}
          {rounds.map((round, ri) => (
            <div key={ri} className="space-y-1 pl-4 border-l-2 border-border ml-3">
              {round.llm && (
                <SpanNode
                  span={round.llm}
                  indent={0}
                  onClick={(s) => setSelectedSpan(s === selectedSpan ? null : s)}
                  isSelected={selectedSpan?.id === round.llm!.id}
                />
              )}
              {round.tools.map((tool) => (
                <SpanNode
                  key={tool.id}
                  span={tool}
                  indent={1}
                  onClick={(s) => setSelectedSpan(selectedSpan?.id === s.id ? null : s)}
                  isSelected={selectedSpan?.id === tool.id}
                />
              ))}
            </div>
          ))}
        </div>
      </ScrollArea>

      {/* Detail panel */}
      {selectedSpan && (
        <SpanDetailPanel span={selectedSpan} onClose={() => setSelectedSpan(null)} />
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function TaskDetailPage({ taskId, workspaceId, orchestratorId }: Props) {
  const [activeTab, setActiveTab] = useState<"feed" | "trace" | "graph">("feed");

  const { data: task, refetch: refetchTask } = useQuery<Task>({
    queryKey: [`/api/tasks/${taskId}`],
    refetchInterval: (query) => {
      const s = query.state.data?.status;
      return (s === "running" || s === "pending") ? 2000 : false;
    },
  });

  const statusConfig = STATUS_CONFIG[task?.status ?? "pending"];
  const base = `/workspaces/${workspaceId}/orchestrators/${orchestratorId}`;
  const isActive = task?.status === "running" || task?.status === "pending";

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Back nav */}
      <div className="flex items-center gap-3 mb-6">
        <Link href={`${base}/tasks`}>
          <Button variant="ghost" size="sm" className="gap-1" data-testid="button-back-tasks">
            <ArrowLeft className="w-4 h-4" /> Tasks
          </Button>
        </Link>
        <span className="text-muted-foreground">/</span>
        <span className="font-mono text-sm text-muted-foreground">{taskId.slice(0, 8)}…</span>
      </div>

      {/* Task summary card */}
      <Card className="mb-4">
        <CardContent className="p-5">
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-2">
              {statusConfig && (
                <statusConfig.icon className={cn("w-5 h-5", statusConfig.color, isActive && "animate-spin")} />
              )}
              <Badge className={statusConfig?.badge ?? ""} data-testid="status-task">
                {task?.status ?? "loading"}
              </Badge>
              {isActive && (
                <Badge variant="secondary" className="text-xs gap-1 animate-pulse">
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-400" /> Live
                </Badge>
              )}
            </div>
            <div className="text-xs text-muted-foreground">
              {task?.createdAt && formatDistanceToNow(new Date(task.createdAt), { addSuffix: true })}
            </div>
          </div>

          <div className="mb-2">
            <div className="text-xs text-muted-foreground mb-1">Input</div>
            <div className="text-sm bg-muted/50 rounded-md p-3 whitespace-pre-wrap font-mono" data-testid="text-task-input">
              {task?.input}
            </div>
          </div>

          {task?.output && (
            <div>
              <div className="text-xs text-muted-foreground mb-1 mt-3">Output</div>
              <div className="text-sm bg-green-500/5 border border-green-500/20 rounded-md p-3 whitespace-pre-wrap" data-testid="text-task-output">
                {task.output}
              </div>
            </div>
          )}

          {task?.errorMessage && (
            <div>
              <div className="text-xs text-muted-foreground mb-1 mt-3">Error</div>
              <div className="text-sm bg-red-500/5 border border-red-500/20 rounded-md p-3 text-red-400 font-mono" data-testid="text-task-error">
                {task.errorMessage}
              </div>
            </div>
          )}

          <div className="flex gap-4 mt-3 text-xs text-muted-foreground">
            {task?.startedAt && <span>Started: {format(new Date(task.startedAt), "HH:mm:ss")}</span>}
            {task?.completedAt && <span>Completed: {format(new Date(task.completedAt), "HH:mm:ss")}</span>}
            {task?.startedAt && task?.completedAt && (
              <span>Duration: {((new Date(task.completedAt).getTime() - new Date(task.startedAt).getTime()) / 1000).toFixed(1)}s</span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Card>
        <CardHeader className="pb-0">
          <div className="flex items-center justify-between">
            <div className="flex gap-1">
              {(["feed", "trace", "graph"] as const).map((tab) => {
                const cfg = {
                  feed:  { icon: Terminal,   label: "Live Feed" },
                  trace: { icon: GitBranch,  label: "Trace" },
                  graph: { icon: Network,    label: "Span Graph" },
                }[tab];
                return (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    data-testid={`tab-${tab}`}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
                      activeTab === tab
                        ? "bg-muted text-foreground"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                    )}
                  >
                    <cfg.icon className="w-3.5 h-3.5" />
                    {cfg.label}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="border-b border-border mt-2" />
        </CardHeader>

        <CardContent className="p-0">
          {activeTab === "feed"  && <LiveFeed taskId={taskId} onDone={() => refetchTask()} />}
          {activeTab === "trace" && <TraceGraph taskId={taskId} />}
          {activeTab === "graph" && <SpanGraph taskId={taskId} />}
        </CardContent>
      </Card>
    </div>
  );
}
