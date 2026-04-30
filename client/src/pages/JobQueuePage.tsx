import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Clock, CheckCircle2, XCircle, Loader2, Circle, Ban,
  RefreshCw, Trash2, ChevronDown, ChevronRight, AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { cn } from "@/lib/utils";

interface Props {
  workspaceId: string;
}

interface JobItem {
  id: string;
  type: string;
  status: "pending" | "running" | "completed" | "failed" | "cancelled";
  priority: number;
  payload: unknown;
  attempts: number;
  lastError: string | null;
  scheduledFor: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  orchestratorId: string | null;
  workspaceId: string;
}

interface JobQueueResponse {
  items: JobItem[];
  total: number;
}

const STATUS_CONFIG: Record<string, { label: string; icon: React.ReactNode; color: string; badgeClass: string }> = {
  pending:   { label: "Pending",   icon: <Circle className="w-3.5 h-3.5" />,        color: "text-yellow-400",  badgeClass: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30" },
  running:   { label: "Running",   icon: <Loader2 className="w-3.5 h-3.5 animate-spin" />, color: "text-blue-400",   badgeClass: "bg-blue-500/15 text-blue-400 border-blue-500/30" },
  completed: { label: "Completed", icon: <CheckCircle2 className="w-3.5 h-3.5" />,  color: "text-green-400",   badgeClass: "bg-green-500/15 text-green-400 border-green-500/30" },
  failed:    { label: "Failed",    icon: <XCircle className="w-3.5 h-3.5" />,       color: "text-destructive", badgeClass: "bg-destructive/15 text-destructive border-destructive/30" },
  cancelled: { label: "Cancelled", icon: <Ban className="w-3.5 h-3.5" />,           color: "text-muted-foreground", badgeClass: "bg-muted text-muted-foreground border-border" },
};

const STATUS_FILTERS = ["all", "pending", "running", "completed", "failed", "cancelled"] as const;

function timeAgo(dateStr: string | null) {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  const diff = Date.now() - d.getTime();
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return d.toLocaleDateString();
}

function duration(startedAt: string | null, completedAt: string | null) {
  if (!startedAt) return null;
  const end = completedAt ? new Date(completedAt).getTime() : Date.now();
  const ms = end - new Date(startedAt).getTime();
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60_000)}m ${Math.floor((ms % 60_000) / 1000)}s`;
}

function JobRow({ job, onCancel }: { job: JobItem; onCancel: (id: string) => void }) {
  const [expanded, setExpanded] = useState(false);
  const cfg = STATUS_CONFIG[job.status] ?? STATUS_CONFIG.pending;
  const dur = duration(job.startedAt, job.completedAt);
  const canCancel = job.status === "pending";

  return (
    <div className="rounded-lg border border-border bg-card" data-testid={`row-job-${job.id}`}>
      <button
        className="w-full flex items-center gap-3 p-4 text-left hover:bg-muted/30 transition-colors rounded-lg"
        onClick={() => setExpanded((v) => !v)}
      >
        <span className={cn("shrink-0", cfg.color)}>{cfg.icon}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-sm">{job.type}</span>
            <Badge variant="outline" className={cn("text-[10px] border", cfg.badgeClass)}>
              {cfg.label}
            </Badge>
            {job.priority > 5 && (
              <Badge variant="outline" className="text-[10px] border bg-orange-500/15 text-orange-400 border-orange-500/30">
                P{job.priority}
              </Badge>
            )}
            {job.attempts > 1 && (
              <span className="text-xs text-muted-foreground">{job.attempts} attempts</span>
            )}
          </div>
          <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-3">
            <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {timeAgo(job.createdAt)}</span>
            {dur && <span>Ran: {dur}</span>}
            {job.scheduledFor && !job.startedAt && (
              <span>Scheduled: {timeAgo(job.scheduledFor)}</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {canCancel && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-destructive hover:text-destructive"
              onClick={(e) => { e.stopPropagation(); onCancel(job.id); }}
              title="Cancel job"
              data-testid={`button-cancel-job-${job.id}`}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          )}
          {expanded ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4 pt-0 space-y-3 border-t border-border mt-0">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 text-xs">
            <div>
              <div className="text-muted-foreground mb-0.5">Job ID</div>
              <code className="font-mono text-[10px] bg-muted rounded px-1.5 py-0.5 break-all">{job.id}</code>
            </div>
            {job.orchestratorId && (
              <div>
                <div className="text-muted-foreground mb-0.5">Orchestrator ID</div>
                <code className="font-mono text-[10px] bg-muted rounded px-1.5 py-0.5 break-all">{job.orchestratorId}</code>
              </div>
            )}
            <div>
              <div className="text-muted-foreground mb-0.5">Started</div>
              <span>{job.startedAt ? new Date(job.startedAt).toLocaleString() : "—"}</span>
            </div>
            <div>
              <div className="text-muted-foreground mb-0.5">Completed</div>
              <span>{job.completedAt ? new Date(job.completedAt).toLocaleString() : "—"}</span>
            </div>
          </div>

          {job.lastError && (
            <div>
              <div className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                <AlertCircle className="w-3 h-3 text-destructive" /> Last Error
              </div>
              <pre className="text-xs font-mono bg-destructive/10 border border-destructive/20 rounded px-3 py-2 whitespace-pre-wrap max-h-32 overflow-auto text-destructive">
                {job.lastError}
              </pre>
            </div>
          )}

          <div>
            <div className="text-xs text-muted-foreground mb-1">Payload</div>
            <pre className="text-xs font-mono bg-muted/50 rounded px-3 py-2 whitespace-pre-wrap max-h-40 overflow-auto">
              {JSON.stringify(job.payload, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}

export default function JobQueuePage({ workspaceId }: Props) {
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const queryKey = [`/api/workspaces/${workspaceId}/job-queue`, statusFilter];

  const { data, isLoading, refetch, isFetching } = useQuery<JobQueueResponse>({
    queryKey,
    queryFn: async () => {
      const params = new URLSearchParams({ limit: "100" });
      if (statusFilter !== "all") params.set("status", statusFilter);
      const res = await fetch(`/api/workspaces/${workspaceId}/job-queue?${params}`, { credentials: "include" });
      return res.json();
    },
    refetchInterval: 5000,
  });

  const cancelMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/workspaces/${workspaceId}/job-queue/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/workspaces/${workspaceId}/job-queue`] });
      toast({ title: "Job cancelled" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const items = data?.items ?? [];
  const total = data?.total ?? 0;

  const counts = items.reduce<Record<string, number>>((acc, j) => {
    acc[j.status] = (acc[j.status] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Job Queue</h1>
          <p className="text-muted-foreground mt-1">
            Background jobs processed by the always-on queue worker
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          disabled={isFetching}
          data-testid="button-refresh-queue"
        >
          <RefreshCw className={cn("w-4 h-4 mr-2", isFetching && "animate-spin")} />
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
        {(["pending", "running", "completed", "failed", "cancelled"] as const).map((s) => {
          const cfg = STATUS_CONFIG[s];
          return (
            <Card
              key={s}
              className={cn(
                "cursor-pointer transition-all",
                statusFilter === s ? "ring-1 ring-primary border-primary" : "hover:border-primary/30"
              )}
              onClick={() => setStatusFilter(s === statusFilter ? "all" : s)}
              data-testid={`card-status-${s}`}
            >
              <CardContent className="p-4">
                <div className={cn("flex items-center gap-1.5 mb-1", cfg.color)}>
                  {cfg.icon}
                  <span className="text-xs font-medium">{cfg.label}</span>
                </div>
                <div className="text-2xl font-bold">{counts[s] ?? 0}</div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="flex gap-2 overflow-x-auto pb-2 mb-4 scrollbar-none">
        {STATUS_FILTERS.map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            data-testid={`filter-status-${s}`}
            className={cn(
              "px-3 py-1.5 rounded-md text-sm whitespace-nowrap transition-colors shrink-0 capitalize",
              statusFilter === s
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
            )}
          >
            {s === "all" ? `All (${total})` : s}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-16 rounded-lg" />)}
        </div>
      ) : items.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-16 text-center">
            <Circle className="w-12 h-12 mx-auto text-muted-foreground mb-3 opacity-40" />
            <h3 className="font-semibold mb-1">Queue is empty</h3>
            <p className="text-muted-foreground text-sm">
              {statusFilter === "all"
                ? "No jobs have been queued yet. Jobs are created by email inbound, webhooks, and other triggers."
                : `No ${statusFilter} jobs found.`}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {items.map((job) => (
            <JobRow
              key={job.id}
              job={job}
              onCancel={(id) => cancelMutation.mutate(id)}
            />
          ))}
          {total > items.length && (
            <p className="text-xs text-muted-foreground text-center pt-2">
              Showing {items.length} of {total} jobs
            </p>
          )}
        </div>
      )}
    </div>
  );
}
