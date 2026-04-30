import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend, ReferenceLine,
} from "recharts";
import {
  BarChart2, Zap, DollarSign, Activity, TrendingUp, Bell,
  Shield, Key, Copy, Trash2, Plus, CheckCircle, Settings2, TrendingDown,
} from "lucide-react";
import { useState, useMemo, useEffect } from "react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface ObservabilityPageProps {
  workspaceId: string;
}

interface AgentPerf {
  agentId: string;
  agentName: string;
  totalRuns: number;
  completed: number;
  failed: number;
  avgDurationMs: number | null;
  p95DurationMs: number | null;
  successRate: number;
}

interface TaskTrendDay {
  date: string;
  completed: number;
  failed: number;
  total: number;
}

interface QuotaData {
  quota: {
    monthlyTokenLimit: number | null;
    dailyTokenLimit: number | null;
    monthlyCostLimitCents: number | null;
    alertThresholdPct: number;
    enforcement: string;
  } | null;
  usage: { totalTokens: number; estimatedCostCents: number };
}

interface ApiKey {
  id: string;
  name: string;
  keyPrefix: string;
  scopes: string[];
  lastUsedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
}

interface ObsStats {
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCostUsd: number;
  byAgent: Array<{ agentName: string; inputTokens: number; outputTokens: number; costUsd: number; calls: number }>;
  byDay: Array<{ date: string; inputTokens: number; outputTokens: number; costUsd: number }>;
  byProvider: Array<{ provider: string; model: string; inputTokens: number; outputTokens: number; costUsd: number }>;
  recentUsage: Array<{ id: string; agentName: string | null; provider: string; model: string; inputTokens: number; outputTokens: number; estimatedCostUsd: number | null; createdAt: string }>;
}

function StatCard({ title, value, sub, icon: Icon, color, badge }: { title: string; value: string; sub?: string; icon: any; color: string; badge?: string }) {
  return (
    <Card>
      <CardContent className="pt-4">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-sm text-muted-foreground">{title}</p>
              {badge && <Badge variant="secondary" className="text-xs px-1.5 py-0">{badge}</Badge>}
            </div>
            <p className="text-2xl font-bold mt-1 truncate" data-testid={`stat-${title.toLowerCase().replace(/\s/g, "-")}`}>{value}</p>
            {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
          </div>
          <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ml-3 ${color}`}>
            <Icon className="w-5 h-5 text-white" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function fmt(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function fmtCost(n: number) {
  if (n >= 100) return `$${n.toFixed(2)}`;
  if (n >= 1) return `$${n.toFixed(3)}`;
  return `$${n.toFixed(4)}`;
}

function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

function computeForecast(byDay: ObsStats["byDay"]) {
  if (byDay.length === 0) return null;

  const daysWithUsage = byDay.filter((d) => d.costUsd > 0);
  if (daysWithUsage.length === 0) return null;

  const totalCost = daysWithUsage.reduce((s, d) => s + d.costUsd, 0);
  const avgDailyCost = totalCost / daysWithUsage.length;

  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);
  const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  const remainingDays = endOfMonth.getDate() - today.getDate() + 1;

  const lastDate = byDay[byDay.length - 1]?.date ?? todayStr;

  const forecastPoints: Array<{ date: string; projected: number }> = [];
  for (let i = 1; i <= 14; i++) {
    forecastPoints.push({ date: addDays(lastDate, i), projected: avgDailyCost });
  }

  return {
    avgDailyCost,
    forecast7d: avgDailyCost * 7,
    forecast30d: avgDailyCost * 30,
    forecast90d: avgDailyCost * 90,
    remainingMonthCost: avgDailyCost * remainingDays,
    remainingDays,
    forecastPoints,
    todayStr,
  };
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-background border rounded-lg shadow-lg p-3 text-xs space-y-1">
      <p className="font-medium text-foreground">{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} style={{ color: p.color }}>
          {p.name}: {p.name.toLowerCase().includes("cost") || p.name.toLowerCase().includes("projected") || p.name.toLowerCase().includes("actual")
            ? fmtCost(p.value)
            : fmt(p.value)}
        </p>
      ))}
    </div>
  );
};

function fmsDuration(ms: number | null) {
  if (ms == null) return "—";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

export default function ObservabilityPage({ workspaceId }: ObservabilityPageProps) {
  const { toast } = useToast();
  const [days, setDays] = useState("30");
  const [alertThreshold, setAlertThreshold] = useState("");
  const [alertChannelId, setAlertChannelId] = useState("none");

  // Quota state
  const [quotaOpen, setQuotaOpen] = useState(false);
  const [quotaForm, setQuotaForm] = useState({
    monthlyTokenLimit: "",
    dailyTokenLimit: "",
    alertThresholdPct: "80",
    enforcement: "warn",
  });

  // API key state
  const [newKeyName, setNewKeyName] = useState("");
  const [newKeySecret, setNewKeySecret] = useState<string | null>(null);

  const { data: stats, isLoading } = useQuery<ObsStats>({
    queryKey: [`/api/workspaces/${workspaceId}/observability`, days],
    queryFn: async () => {
      const res = await fetch(`/api/workspaces/${workspaceId}/observability?days=${days}`, { credentials: "include" });
      if (!res.ok) throw new Error(`${res.status}`);
      return res.json();
    },
  });

  const { data: workspaceConfig } = useQuery<{
    utilizationAlertThresholdTokens: number | null;
    utilizationAlertChannelId: string | null;
  }>({
    queryKey: [`/api/workspaces/${workspaceId}/config`],
  });

  useEffect(() => {
    if (workspaceConfig) {
      setAlertThreshold(workspaceConfig.utilizationAlertThresholdTokens != null ? String(workspaceConfig.utilizationAlertThresholdTokens) : "");
      setAlertChannelId(workspaceConfig.utilizationAlertChannelId ?? "none");
    }
  }, [workspaceConfig]);

  const { data: allChannels = [] } = useQuery<{ id: string; name: string; type: string }[]>({
    queryKey: [`/api/workspaces/${workspaceId}/channels`],
  });
  const outboundChannels = allChannels.filter((c) => ["slack", "teams", "google_chat", "generic_webhook"].includes(c.type));

  const updateConfigMutation = useMutation({
    mutationFn: () => apiRequest("PUT", `/api/workspaces/${workspaceId}/config`, {
      utilizationAlertThresholdTokens: alertThreshold ? parseInt(alertThreshold) : null,
      utilizationAlertChannelId: alertChannelId === "none" ? null : alertChannelId,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/workspaces/${workspaceId}/config`] });
      toast({ title: "Alert settings saved" });
    },
    onError: () => toast({ title: "Failed to save settings", variant: "destructive" }),
  });

  // ── Agent Performance Analytics ──────────────────────────────────────────────
  const { data: agentPerf = [] } = useQuery<AgentPerf[]>({
    queryKey: [`/api/workspaces/${workspaceId}/analytics/agents`],
    queryFn: async () => {
      const res = await fetch(`/api/workspaces/${workspaceId}/analytics/agents`, { credentials: "include" });
      if (!res.ok) throw new Error(`${res.status}`);
      const json = await res.json();
      return Array.isArray(json) ? json : [];
    },
    refetchInterval: 30_000,
  });

  const { data: taskTrend = [] } = useQuery<TaskTrendDay[]>({
    queryKey: [`/api/workspaces/${workspaceId}/analytics/task-trend`],
    queryFn: async () => {
      const res = await fetch(`/api/workspaces/${workspaceId}/analytics/task-trend?days=14`, { credentials: "include" });
      if (!res.ok) throw new Error(`${res.status}`);
      const json = await res.json();
      return Array.isArray(json) ? json : [];
    },
    refetchInterval: 30_000,
  });

  // ── Quota ─────────────────────────────────────────────────────────────────────
  const { data: quotaData } = useQuery<QuotaData>({
    queryKey: [`/api/workspaces/${workspaceId}/quota`],
    queryFn: async () => {
      const res = await fetch(`/api/workspaces/${workspaceId}/quota`, { credentials: "include" });
      if (!res.ok) throw new Error(`${res.status}`);
      return res.json();
    },
  });

  useEffect(() => {
    if (quotaData?.quota) {
      setQuotaForm({
        monthlyTokenLimit: quotaData.quota.monthlyTokenLimit != null ? String(quotaData.quota.monthlyTokenLimit) : "",
        dailyTokenLimit: quotaData.quota.dailyTokenLimit != null ? String(quotaData.quota.dailyTokenLimit) : "",
        alertThresholdPct: String(quotaData.quota.alertThresholdPct),
        enforcement: quotaData.quota.enforcement,
      });
    }
  }, [quotaData]);

  const saveQuotaMutation = useMutation({
    mutationFn: () => apiRequest("PUT", `/api/workspaces/${workspaceId}/quota`, {
      monthlyTokenLimit: quotaForm.monthlyTokenLimit ? parseInt(quotaForm.monthlyTokenLimit) : null,
      dailyTokenLimit: quotaForm.dailyTokenLimit ? parseInt(quotaForm.dailyTokenLimit) : null,
      alertThresholdPct: parseInt(quotaForm.alertThresholdPct) || 80,
      enforcement: quotaForm.enforcement,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/workspaces/${workspaceId}/quota`] });
      setQuotaOpen(false);
      toast({ title: "Quota settings saved" });
    },
    onError: () => toast({ title: "Failed to save quota", variant: "destructive" }),
  });

  // ── API Keys ──────────────────────────────────────────────────────────────────
  const { data: apiKeys = [] } = useQuery<ApiKey[]>({
    queryKey: [`/api/workspaces/${workspaceId}/api-keys`],
    queryFn: async () => {
      const res = await fetch(`/api/workspaces/${workspaceId}/api-keys`, { credentials: "include" });
      if (!res.ok) throw new Error(`${res.status}`);
      const json = await res.json();
      return Array.isArray(json) ? json : [];
    },
  });

  const createKeyMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/workspaces/${workspaceId}/api-keys`, { name: newKeyName }),
    onSuccess: async (res: any) => {
      const data = await res.json();
      setNewKeySecret(data.key);
      setNewKeyName("");
      queryClient.invalidateQueries({ queryKey: [`/api/workspaces/${workspaceId}/api-keys`] });
    },
    onError: () => toast({ title: "Failed to create API key", variant: "destructive" }),
  });

  const revokeKeyMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/workspaces/${workspaceId}/api-keys/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/workspaces/${workspaceId}/api-keys`] });
      toast({ title: "API key revoked" });
    },
    onError: () => toast({ title: "Failed to revoke key", variant: "destructive" }),
  });

  const totalTokens = (stats?.totalInputTokens ?? 0) + (stats?.totalOutputTokens ?? 0);
  const forecast = useMemo(() => stats?.byDay ? computeForecast(stats.byDay) : null, [stats?.byDay]);

  const costChartData = useMemo(() => {
    if (!stats?.byDay) return [];
    const actual = stats.byDay.map((d) => ({ date: d.date, actual: d.costUsd, projected: undefined as number | undefined }));
    if (!forecast) return actual;
    const projectedPoints = forecast.forecastPoints.map((p) => ({ date: p.date, actual: undefined as number | undefined, projected: p.projected }));
    return [...actual, ...projectedPoints];
  }, [stats?.byDay, forecast]);

  const todayStr = new Date().toISOString().slice(0, 10);

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <BarChart2 className="w-6 h-6 text-primary" />
            Observability
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Token usage, cost tracking, and spend forecasting.</p>
        </div>
        <Select value={days} onValueChange={setDays}>
          <SelectTrigger className="w-32" data-testid="select-days">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7">Last 7 days</SelectItem>
            <SelectItem value="30">Last 30 days</SelectItem>
            <SelectItem value="90">Last 90 days</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading && <p className="text-muted-foreground text-sm">Loading metrics…</p>}

      {!isLoading && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard title="Total Tokens" value={fmt(totalTokens)} sub={`${fmt(stats?.totalInputTokens ?? 0)} in / ${fmt(stats?.totalOutputTokens ?? 0)} out`} icon={Zap} color="bg-blue-500" />
            <StatCard title="Est. Cost" value={fmtCost(stats?.totalCostUsd ?? 0)} sub={`Last ${days} days`} icon={DollarSign} color="bg-emerald-500" />
            <StatCard title="Agent Calls" value={String(stats?.recentUsage?.length ?? 0)} sub="Token records" icon={Activity} color="bg-violet-500" />
            <StatCard title="Active Agents" value={String(stats?.byAgent?.length ?? 0)} sub="With usage" icon={BarChart2} color="bg-orange-500" />
          </div>

          {forecast && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp className="w-4 h-4 text-primary" />
                <h2 className="text-base font-semibold">Cost Forecast</h2>
                <Badge variant="outline" className="text-xs">Based on last {days} days avg</Badge>
              </div>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                  title="Daily Burn Rate"
                  value={fmtCost(forecast.avgDailyCost)}
                  sub="Average per active day"
                  icon={TrendingUp}
                  color="bg-sky-500"
                  data-testid="stat-daily-burn-rate"
                />
                <StatCard
                  title="7-Day Projection"
                  value={fmtCost(forecast.forecast7d)}
                  sub="Next 7 days"
                  icon={TrendingUp}
                  color="bg-sky-500"
                  badge="7d"
                />
                <StatCard
                  title="30-Day Projection"
                  value={fmtCost(forecast.forecast30d)}
                  sub="Next 30 days"
                  icon={TrendingUp}
                  color="bg-indigo-500"
                  badge="30d"
                />
                <StatCard
                  title="Month-End Estimate"
                  value={fmtCost(forecast.remainingMonthCost)}
                  sub={`${forecast.remainingDays} days remaining`}
                  icon={DollarSign}
                  color="bg-amber-500"
                  badge="EOM"
                />
              </div>
            </div>
          )}

          {costChartData.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  Daily Cost
                  {forecast && <Badge variant="outline" className="text-xs font-normal">Dashed = 14-day projection</Badge>}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={costChartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                    <YAxis tickFormatter={(v) => `$${v.toFixed(3)}`} tick={{ fontSize: 10 }} width={60} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend />
                    {forecast && (
                      <ReferenceLine x={todayStr} stroke="#94a3b8" strokeDasharray="4 2" label={{ value: "Today", position: "top", fontSize: 10, fill: "#94a3b8" }} />
                    )}
                    <Line
                      type="monotone"
                      dataKey="actual"
                      name="Actual cost"
                      stroke="#10b981"
                      strokeWidth={2}
                      dot={false}
                      connectNulls={false}
                    />
                    {forecast && (
                      <Line
                        type="monotone"
                        dataKey="projected"
                        name="Projected cost"
                        stroke="#6366f1"
                        strokeWidth={2}
                        strokeDasharray="6 3"
                        dot={false}
                        connectNulls={false}
                      />
                    )}
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {(stats?.byDay?.length ?? 0) > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-base">Daily Token Usage</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={stats!.byDay} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                    <YAxis tickFormatter={fmt} tick={{ fontSize: 11 }} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend />
                    <Line type="monotone" dataKey="inputTokens" name="Input Tokens" stroke="#3b82f6" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="outputTokens" name="Output Tokens" stroke="#8b5cf6" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {(stats?.byAgent?.length ?? 0) > 0 && (
              <Card>
                <CardHeader><CardTitle className="text-base">Tokens by Agent</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={stats!.byAgent.slice(0, 8)} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="agentName" tick={{ fontSize: 10 }} />
                      <YAxis tickFormatter={fmt} tick={{ fontSize: 10 }} />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend />
                      <Bar dataKey="inputTokens" name="Input" fill="#3b82f6" radius={[2, 2, 0, 0]} />
                      <Bar dataKey="outputTokens" name="Output" fill="#8b5cf6" radius={[2, 2, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}

            {(stats?.byProvider?.length ?? 0) > 0 && (
              <Card>
                <CardHeader><CardTitle className="text-base">Usage by Provider / Model</CardTitle></CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {stats!.byProvider.map((p) => (
                      <div key={`${p.provider}-${p.model}`} className="flex items-center justify-between text-sm p-2 rounded-md bg-muted/40">
                        <div>
                          <span className="font-medium">{{ openai: "OpenAI", anthropic: "Anthropic", gemini: "Gemini", ollama: "Ollama", vllm: "vLLM" }[p.provider] ?? p.provider}</span>
                          <span className="text-muted-foreground mx-1">·</span>
                          <span className="text-muted-foreground text-xs">{p.model}</span>
                        </div>
                        <div className="text-right text-xs">
                          <div>{fmt(p.inputTokens + p.outputTokens)} tokens</div>
                          <div className="text-muted-foreground">{fmtCost(p.costUsd)}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {(stats?.byAgent?.length ?? 0) > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-base">Agent Performance</CardTitle></CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2 font-medium text-muted-foreground">Agent</th>
                        <th className="text-right py-2 font-medium text-muted-foreground">Calls</th>
                        <th className="text-right py-2 font-medium text-muted-foreground">Input</th>
                        <th className="text-right py-2 font-medium text-muted-foreground">Output</th>
                        <th className="text-right py-2 font-medium text-muted-foreground">Est. Cost</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats!.byAgent.map((a, i) => (
                        <tr key={i} className="border-b last:border-0" data-testid={`row-agent-${i}`}>
                          <td className="py-2 font-medium">{a.agentName}</td>
                          <td className="py-2 text-right text-muted-foreground">{a.calls}</td>
                          <td className="py-2 text-right text-muted-foreground">{fmt(a.inputTokens)}</td>
                          <td className="py-2 text-right text-muted-foreground">{fmt(a.outputTokens)}</td>
                          <td className="py-2 text-right font-medium">{fmtCost(a.costUsd)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {totalTokens === 0 && !isLoading && (
            <div className="text-center py-20 text-muted-foreground">
              <BarChart2 className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No token usage data yet. Run some tasks to see metrics here.</p>
            </div>
          )}
        </>
      )}

      {/* ── Task Trend Chart ────────────────────────────────────────────────── */}
      {taskTrend.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-primary" />
              Task Trend (Last 14 Days)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={taskTrend} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                <Bar dataKey="completed" name="Completed" stackId="a" fill="#10b981" radius={[0, 0, 0, 0]} />
                <Bar dataKey="failed" name="Failed" stackId="a" fill="#ef4444" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* ── Agent Task Performance ───────────────────────────────────────────── */}
      {agentPerf.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Activity className="w-4 h-4 text-primary" />
              Agent Task Performance
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground text-xs">Agent</th>
                    <th className="text-right px-4 py-2.5 font-medium text-muted-foreground text-xs">Runs</th>
                    <th className="text-right px-4 py-2.5 font-medium text-muted-foreground text-xs">Success Rate</th>
                    <th className="text-right px-4 py-2.5 font-medium text-muted-foreground text-xs">Avg Duration</th>
                    <th className="text-right px-4 py-2.5 font-medium text-muted-foreground text-xs">p95 Duration</th>
                    <th className="text-right px-4 py-2.5 font-medium text-muted-foreground text-xs">Errors</th>
                  </tr>
                </thead>
                <tbody>
                  {agentPerf.map((a, i) => (
                    <tr key={a.agentId} className="border-b last:border-0 hover:bg-muted/20 transition-colors" data-testid={`row-agentperf-${i}`}>
                      <td className="px-4 py-2.5 font-medium">{a.agentName}</td>
                      <td className="px-4 py-2.5 text-right text-muted-foreground">{a.totalRuns}</td>
                      <td className="px-4 py-2.5 text-right">
                        <span className={cn("font-medium", a.successRate >= 90 ? "text-green-500" : a.successRate >= 70 ? "text-yellow-500" : "text-red-500")}>
                          {a.successRate}%
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-right text-muted-foreground font-mono text-xs">{fmsDuration(a.avgDurationMs)}</td>
                      <td className="px-4 py-2.5 text-right text-muted-foreground font-mono text-xs">{fmsDuration(a.p95DurationMs)}</td>
                      <td className="px-4 py-2.5 text-right">
                        {a.failed > 0
                          ? <span className="text-red-400 font-medium">{a.failed}</span>
                          : <span className="text-muted-foreground">0</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Usage Quota Governance ───────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Shield className="w-4 h-4 text-primary" />
              Usage Quota
            </CardTitle>
            <Dialog open={quotaOpen} onOpenChange={setQuotaOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1.5 h-8" data-testid="button-edit-quota">
                  <Settings2 className="w-3.5 h-3.5" /> Edit Limits
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Workspace Usage Quota</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-2">
                  <div className="space-y-1.5">
                    <Label>Monthly Token Limit (0 = unlimited)</Label>
                    <Input
                      type="number"
                      placeholder="e.g. 10000000"
                      value={quotaForm.monthlyTokenLimit}
                      onChange={(e) => setQuotaForm((f) => ({ ...f, monthlyTokenLimit: e.target.value }))}
                      data-testid="input-monthly-token-limit"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Daily Token Limit (0 = unlimited)</Label>
                    <Input
                      type="number"
                      placeholder="e.g. 500000"
                      value={quotaForm.dailyTokenLimit}
                      onChange={(e) => setQuotaForm((f) => ({ ...f, dailyTokenLimit: e.target.value }))}
                      data-testid="input-daily-token-limit"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label>Alert Threshold (%)</Label>
                      <Input
                        type="number"
                        min="1"
                        max="100"
                        value={quotaForm.alertThresholdPct}
                        onChange={(e) => setQuotaForm((f) => ({ ...f, alertThresholdPct: e.target.value }))}
                        data-testid="input-alert-threshold-pct"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Enforcement</Label>
                      <Select value={quotaForm.enforcement} onValueChange={(v) => setQuotaForm((f) => ({ ...f, enforcement: v }))}>
                        <SelectTrigger data-testid="select-enforcement">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="warn">Warn only</SelectItem>
                          <SelectItem value="block">Block tasks</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setQuotaOpen(false)}>Cancel</Button>
                  <Button onClick={() => saveQuotaMutation.mutate()} disabled={saveQuotaMutation.isPending}>
                    {saveQuotaMutation.isPending ? "Saving…" : "Save Quota"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {quotaData ? (
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between text-sm mb-1.5">
                  <span className="text-muted-foreground">Monthly token usage</span>
                  <span className="font-mono text-xs">
                    {fmt(quotaData.usage.totalTokens)}
                    {quotaData.quota?.monthlyTokenLimit ? ` / ${fmt(quotaData.quota.monthlyTokenLimit)}` : " / Unlimited"}
                  </span>
                </div>
                {quotaData.quota?.monthlyTokenLimit ? (
                  <Progress
                    value={Math.min(100, (quotaData.usage.totalTokens / quotaData.quota.monthlyTokenLimit) * 100)}
                    className="h-2"
                    data-testid="progress-monthly-tokens"
                  />
                ) : (
                  <div className="h-2 rounded-full bg-muted/40" />
                )}
              </div>
              {quotaData.quota && (
                <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                  <span>Enforcement: <span className="font-medium text-foreground capitalize">{quotaData.quota.enforcement}</span></span>
                  <span>Alert at: <span className="font-medium text-foreground">{quotaData.quota.alertThresholdPct}%</span></span>
                  {quotaData.quota.dailyTokenLimit && (
                    <span>Daily limit: <span className="font-medium text-foreground">{fmt(quotaData.quota.dailyTokenLimit)}</span></span>
                  )}
                </div>
              )}
              {!quotaData.quota && (
                <p className="text-xs text-muted-foreground">No limits set — usage is unrestricted. Click "Edit Limits" to configure.</p>
              )}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">Loading quota data…</p>
          )}
        </CardContent>
      </Card>

      {/* ── Platform API Keys ───────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Key className="w-4 h-4 text-primary" />
            Platform API Keys
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Create new key */}
          <div className="flex gap-2">
            <Input
              placeholder="Key name (e.g. CI Deploy)"
              value={newKeyName}
              onChange={(e) => setNewKeyName(e.target.value)}
              className="flex-1 h-9 text-sm"
              data-testid="input-api-key-name"
              onKeyDown={(e) => { if (e.key === "Enter" && newKeyName.trim()) createKeyMutation.mutate(); }}
            />
            <Button
              size="sm"
              className="h-9 gap-1.5"
              disabled={!newKeyName.trim() || createKeyMutation.isPending}
              onClick={() => createKeyMutation.mutate()}
              data-testid="button-create-api-key"
            >
              <Plus className="w-3.5 h-3.5" />
              Generate
            </Button>
          </div>

          {/* Newly created key display */}
          {newKeySecret && (
            <div className="rounded-lg border border-green-500/30 bg-green-500/5 p-3 space-y-2">
              <div className="flex items-center gap-1.5 text-green-400 text-xs font-medium">
                <CheckCircle className="w-3.5 h-3.5" /> Key created — copy it now, it won't be shown again
              </div>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-xs font-mono bg-muted/50 rounded px-2 py-1.5 break-all" data-testid="text-new-api-key">
                  {newKeySecret}
                </code>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8 shrink-0"
                  onClick={() => { navigator.clipboard.writeText(newKeySecret); toast({ title: "Copied to clipboard" }); }}
                  data-testid="button-copy-api-key"
                >
                  <Copy className="w-3.5 h-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0"
                  onClick={() => setNewKeySecret(null)}
                >
                  ✕
                </Button>
              </div>
            </div>
          )}

          {/* Keys list */}
          {!Array.isArray(apiKeys) || apiKeys.length === 0 ? (
            <div className="text-center py-6 text-xs text-muted-foreground">
              No API keys yet. Generate one above to enable programmatic access.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 font-medium text-muted-foreground text-xs">Name</th>
                    <th className="text-left py-2 font-medium text-muted-foreground text-xs">Prefix</th>
                    <th className="text-left py-2 font-medium text-muted-foreground text-xs">Created</th>
                    <th className="text-left py-2 font-medium text-muted-foreground text-xs">Last Used</th>
                    <th className="text-right py-2" />
                  </tr>
                </thead>
                <tbody>
                  {apiKeys.map((k, i) => (
                    <tr key={k.id} className="border-b last:border-0" data-testid={`row-apikey-${i}`}>
                      <td className="py-2 font-medium">{k.name}</td>
                      <td className="py-2 font-mono text-xs text-muted-foreground">{k.keyPrefix}…</td>
                      <td className="py-2 text-xs text-muted-foreground">{format(new Date(k.createdAt), "MMM d, yyyy")}</td>
                      <td className="py-2 text-xs text-muted-foreground">
                        {k.lastUsedAt ? format(new Date(k.lastUsedAt), "MMM d, yyyy") : "Never"}
                      </td>
                      <td className="py-2 text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-red-400"
                          onClick={() => revokeKeyMutation.mutate(k.id)}
                          disabled={revokeKeyMutation.isPending}
                          data-testid={`button-revoke-key-${i}`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Utilization Alert Settings ────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Bell className="w-4 h-4 text-primary" /> Utilization Alert Settings
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Token Threshold (optional)</Label>
              <Input
                type="number"
                placeholder="e.g. 100000"
                value={alertThreshold}
                onChange={(e) => setAlertThreshold(e.target.value)}
                data-testid="input-alert-threshold"
              />
              <p className="text-xs text-muted-foreground">
                Send an alert when total tokens used in a task run exceeds this number.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label>Alert Channel</Label>
              <Select value={alertChannelId} onValueChange={setAlertChannelId}>
                <SelectTrigger data-testid="select-alert-channel">
                  <SelectValue placeholder="Select a channel" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None — disabled</SelectItem>
                  {outboundChannels.map((ch) => (
                    <SelectItem key={ch.id} value={ch.id}>{ch.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Channel to notify when the token threshold is exceeded.
              </p>
            </div>
          </div>
          <div className="flex justify-end">
            <Button
              onClick={() => updateConfigMutation.mutate()}
              disabled={updateConfigMutation.isPending}
              data-testid="button-save-alert-settings"
            >
              {updateConfigMutation.isPending ? "Saving…" : "Save Alert Settings"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
