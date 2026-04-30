import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Brain, Search, Trash2, X, Loader2, Bot, Database,
  ChevronDown, ChevronRight, RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";


interface MemoryEntry {
  id: string;
  agent_id: string;
  workspace_id: string;
  task_id?: string;
  content: string;
  source: string;
  created_at: string;
  agent_name?: string;
  memoryType?: "vector" | "kv";
}

interface KvEntry {
  id: string;
  agentId: string;
  agentName: string;
  key: string;
  value: string;
  updatedAt: string;
}

interface Props { workspaceId: string }

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function MemoryCard({ entry, onDelete }: { entry: MemoryEntry; onDelete: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const isLong = entry.content.length > 200;
  const displayContent = isLong && !expanded ? entry.content.slice(0, 200) + "…" : entry.content;
  const isKv = entry.memoryType === "kv";

  return (
    <Card data-testid={`card-memory-${entry.id}`} className="group border-border/60 hover:shadow-sm transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${isKv ? "bg-amber-500/10" : "bg-primary/10"}`}>
            <Brain className={`w-4 h-4 ${isKv ? "text-amber-500" : "text-primary"}`} />
          </div>
          <div className="flex-1 min-w-0 space-y-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              {entry.agent_name && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-primary/30 text-primary">
                  <Bot className="w-2.5 h-2.5 mr-1" />{entry.agent_name}
                </Badge>
              )}
              <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${isKv ? "border-amber-500/40 text-amber-500" : "text-muted-foreground"}`}>
                {isKv ? "kv" : (entry.source || "vector")}
              </Badge>
              {entry.task_id && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-muted-foreground border-violet-500/30 text-violet-400">
                  task
                </Badge>
              )}
              <span className="text-[10px] text-muted-foreground ml-auto">{timeAgo(entry.created_at)}</span>
            </div>
            <p className="text-sm text-foreground/80 whitespace-pre-wrap break-words">{displayContent}</p>
            {isLong && (
              <button
                onClick={() => setExpanded(!expanded)}
                className="text-xs text-primary flex items-center gap-0.5 hover:underline"
              >
                {expanded ? <><ChevronDown className="w-3 h-3" /> Show less</> : <><ChevronRight className="w-3 h-3" /> Show more</>}
              </button>
            )}
          </div>
          <Button
            size="icon"
            variant="ghost"
            className="w-7 h-7 shrink-0 opacity-0 group-hover:opacity-100 hover:text-red-400"
            onClick={onDelete}
            data-testid={`button-delete-memory-${entry.id}`}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function AgentMemoryPage({ workspaceId }: Props) {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [deleteEntryTarget, setDeleteEntryTarget] = useState<MemoryEntry | null>(null);
  const [clearAgentTarget, setClearAgentTarget] = useState<{ id: string; name: string } | null>(null);

  const { data: vectorEntries = [], isLoading: vectorLoading, refetch: refetchVector } = useQuery<MemoryEntry[]>({
    queryKey: [`/api/workspaces/${workspaceId}/memory`],
  });

  const { data: kvRaw = [], isLoading: kvLoading, refetch: refetchKv } = useQuery<KvEntry[]>({
    queryKey: [`/api/workspaces/${workspaceId}/memory/kv`],
  });

  const kvEntries: MemoryEntry[] = kvRaw.map((e) => ({
    id: `kv-${e.id}`,
    agent_id: e.agentId,
    agent_name: e.agentName,
    workspace_id: workspaceId,
    content: `**${e.key}**: ${e.value}`,
    source: "kv",
    created_at: e.updatedAt,
    memoryType: "kv",
  }));

  const entries: MemoryEntry[] = [
    ...vectorEntries.map((e) => ({ ...e, memoryType: "vector" as const })),
    ...kvEntries,
  ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  const isLoading = vectorLoading || kvLoading;
  const refetch = () => { refetchVector(); refetchKv(); };

  const filtered = entries.filter((e) => {
    const q = search.toLowerCase();
    return !q || e.content.toLowerCase().includes(q) || (e.agent_name ?? "").toLowerCase().includes(q) || (e.source ?? "").toLowerCase().includes(q);
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/workspaces/${workspaceId}/memory/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/workspaces/${workspaceId}/memory`] });
      setDeleteEntryTarget(null);
      toast({ title: "Memory entry deleted" });
    },
  });

  const clearAgentMutation = useMutation({
    mutationFn: (agentId: string) => apiRequest("DELETE", `/api/agents/${agentId}/memory`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/workspaces/${workspaceId}/memory`] });
      setClearAgentTarget(null);
      toast({ title: "Agent memory cleared" });
    },
  });

  // Group by agent for the agent summary panel
  const agentMap = new Map<string, { name: string; count: number }>();
  entries.forEach((e) => {
    const existing = agentMap.get(e.agent_id);
    if (existing) existing.count++;
    else agentMap.set(e.agent_id, { name: e.agent_name ?? e.agent_id.slice(0, 8), count: 1 });
  });
  const agentList = Array.from(agentMap.entries());

  return (
    <div className="flex flex-col h-full">
        {/* Header */}
        <div className="border-b bg-background px-6 py-4 flex items-center gap-4">
          <Brain className="w-5 h-5 text-primary" />
          <div>
            <h1 className="text-lg font-semibold">Agent Memory</h1>
            <p className="text-sm text-muted-foreground">Browse and manage memory stored by your agents (KV + vector)</p>
          </div>
          <Button variant="outline" size="sm" className="ml-auto" onClick={() => refetch()} data-testid="button-refresh-memory">
            <RefreshCw className="w-4 h-4 mr-2" /> Refresh
          </Button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar: agent summary */}
          <div className="w-56 border-r bg-muted/20 flex flex-col shrink-0">
            <div className="px-4 py-3 border-b">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Agents</p>
            </div>
            <div className="flex-1 overflow-auto p-2 space-y-1">
              {agentList.length === 0 && !isLoading && (
                <p className="text-xs text-muted-foreground px-2 py-4 text-center">No memory recorded yet</p>
              )}
              {agentList.map(([agentId, info]) => (
                <div
                  key={agentId}
                  data-testid={`agent-memory-row-${agentId}`}
                  className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-muted/60 group"
                >
                  <Bot className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  <span className="text-xs truncate flex-1">{info.name}</span>
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0 shrink-0">{info.count}</Badge>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="w-5 h-5 opacity-0 group-hover:opacity-100 hover:text-red-400"
                    onClick={() => setClearAgentTarget({ id: agentId, name: info.name })}
                    data-testid={`button-clear-agent-${agentId}`}
                  >
                    <X className="w-3 h-3" />
                  </Button>
                </div>
              ))}
            </div>
            <div className="border-t px-3 py-2">
              <p className="text-[10px] text-muted-foreground">
                <Database className="w-3 h-3 inline mr-1" />
                {entries.length} total entries
              </p>
            </div>
          </div>

          {/* Main content */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Search bar */}
            <div className="border-b bg-background/60 px-4 py-2.5 flex items-center gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search memory content…"
                  className="pl-9 h-8 text-sm"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  data-testid="input-search-memory"
                />
                {search && (
                  <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              <span className="text-xs text-muted-foreground shrink-0">{filtered.length} result{filtered.length !== 1 ? "s" : ""}</span>
            </div>

            <div className="flex-1 overflow-auto p-4 space-y-3">
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-24 w-full" />
                ))
              ) : filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-48 gap-3 text-muted-foreground">
                  <Brain className="w-10 h-10 opacity-30" />
                  <p className="text-sm">
                    {search ? "No memory entries match your search" : "No memory entries yet"}
                  </p>
                  <p className="text-xs opacity-60">Enable Memory on an agent and chat with it — KV memory is stored instantly. Vector memory requires an OpenAI or Gemini API key.</p>
                </div>
              ) : (
                filtered.map((entry) => (
                  <MemoryCard
                    key={entry.id}
                    entry={entry}
                    onDelete={() => setDeleteEntryTarget(entry)}
                  />
                ))
              )}
            </div>
          </div>
        </div>

      {/* Delete single entry */}
      <AlertDialog open={!!deleteEntryTarget} onOpenChange={() => setDeleteEntryTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Memory Entry</AlertDialogTitle>
            <AlertDialogDescription>This will permanently remove this memory vector. The agent will no longer recall this context.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteEntryTarget && deleteMutation.mutate(deleteEntryTarget.id)}
              data-testid="button-confirm-delete-memory"
            >
              {deleteMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Clear agent memory */}
      <AlertDialog open={!!clearAgentTarget} onOpenChange={() => setClearAgentTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear Agent Memory</AlertDialogTitle>
            <AlertDialogDescription>
              Delete all vector memory for <strong>{clearAgentTarget?.name}</strong>? This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => clearAgentTarget && clearAgentMutation.mutate(clearAgentTarget.id)}
              data-testid="button-confirm-clear-agent-memory"
            >
              {clearAgentMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Clear All"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
