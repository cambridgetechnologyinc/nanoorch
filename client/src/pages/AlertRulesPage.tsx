import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Bell, Plus, Trash2, Pencil, Loader2, ToggleLeft,
  ToggleRight, AlertTriangle, CheckCircle2, Clock, Zap,
  Activity, BellRing,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription,
} from "@/components/ui/form";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

import type { Channel } from "@shared/schema";

const TRIGGER_TYPES = [
  { value: "task_failed", label: "Task Failed", icon: AlertTriangle, color: "text-red-400" },
  { value: "task_completed", label: "Task Completed", icon: CheckCircle2, color: "text-green-400" },
  { value: "agent_error", label: "Agent Error", icon: Zap, color: "text-orange-400" },
  { value: "queue_depth", label: "Queue Depth Threshold", icon: Activity, color: "text-blue-400" },
  { value: "task_timeout", label: "Task Timeout", icon: Clock, color: "text-yellow-400" },
  { value: "pipeline_failed", label: "Pipeline Failed", icon: AlertTriangle, color: "text-red-400" },
];

const ruleSchema = z.object({
  name: z.string().min(1, "Name required"),
  triggerType: z.string().min(1, "Trigger type required"),
  channelId: z.string().optional(),
  enabled: z.boolean().default(true),
  threshold: z.string().optional(),
});
type RuleForm = z.infer<typeof ruleSchema>;

interface AlertRule {
  id: string;
  name: string;
  triggerType: string;
  conditions?: Record<string, any>;
  channelId?: string;
  enabled: boolean;
  lastTriggeredAt?: string;
  triggerCount: number;
  createdAt: string;
}

interface LiveStats {
  runningTasks: number;
  pendingTasks: number;
  completedToday: number;
  failedToday: number;
  activeAgents: number;
  totalAgents: number;
  alertRules: number;
  memoryEntries: number;
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

function LiveStatsStrip({ workspaceId }: { workspaceId: string }) {
  const { data: stats, isLoading } = useQuery<LiveStats>({
    queryKey: [`/api/workspaces/${workspaceId}/live-stats`],
    refetchInterval: 15000,
  });

  const items = [
    { label: "Running", value: stats?.runningTasks ?? 0, color: "text-blue-400", bg: "bg-blue-400/10", pulse: true },
    { label: "Pending", value: stats?.pendingTasks ?? 0, color: "text-yellow-400", bg: "bg-yellow-400/10" },
    { label: "Done Today", value: stats?.completedToday ?? 0, color: "text-green-400", bg: "bg-green-400/10" },
    { label: "Failed Today", value: stats?.failedToday ?? 0, color: "text-red-400", bg: "bg-red-400/10" },
    { label: "Active Agents", value: stats?.activeAgents ?? 0, color: "text-primary", bg: "bg-primary/10" },
    { label: "Memory Entries", value: stats?.memoryEntries ?? 0, color: "text-violet-400", bg: "bg-violet-400/10" },
  ];

  return (
    <div className="border-b bg-muted/30 px-6 py-3">
      <div className="flex items-center gap-2 mb-2">
        <Activity className="w-3.5 h-3.5 text-muted-foreground" />
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Live Platform Status</span>
        <span className="ml-auto text-[10px] text-muted-foreground">Auto-refreshes every 15s</span>
      </div>
      <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
        {items.map((item) => (
          <div
            key={item.label}
            className={`flex items-center gap-2 rounded-md px-3 py-2 ${item.bg}`}
            data-testid={`stat-live-${item.label.toLowerCase().replace(/\s+/g, "-")}`}
          >
            {item.pulse && (item.value > 0) && (
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse shrink-0" />
            )}
            <div className="min-w-0">
              {isLoading ? (
                <div className="h-4 w-6 bg-muted rounded animate-pulse mb-0.5" />
              ) : (
                <div className={`text-base font-bold leading-none ${item.color}`}>{item.value}</div>
              )}
              <div className="text-[10px] text-muted-foreground truncate mt-0.5">{item.label}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function AlertRulesPage({ workspaceId }: Props) {
  const { toast } = useToast();
  const [showDialog, setShowDialog] = useState(false);
  const [editTarget, setEditTarget] = useState<AlertRule | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AlertRule | null>(null);

  const { data: rules = [], isLoading } = useQuery<AlertRule[]>({
    queryKey: [`/api/workspaces/${workspaceId}/alert-rules`],
  });

  const { data: channels = [] } = useQuery<Channel[]>({
    queryKey: [`/api/workspaces/${workspaceId}/channels`],
  });

  const form = useForm<RuleForm>({
    resolver: zodResolver(ruleSchema),
    defaultValues: { name: "", triggerType: "task_failed", channelId: "__none__", enabled: true, threshold: "" },
  });

  const openCreate = () => {
    setEditTarget(null);
    form.reset({ name: "", triggerType: "task_failed", channelId: "__none__", enabled: true, threshold: "" });
    setShowDialog(true);
  };

  const openEdit = (rule: AlertRule) => {
    setEditTarget(rule);
    form.reset({
      name: rule.name,
      triggerType: rule.triggerType,
      channelId: rule.channelId || "__none__",
      enabled: rule.enabled,
      threshold: rule.conditions?.threshold?.toString() ?? "",
    });
    setShowDialog(true);
  };

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", `/api/workspaces/${workspaceId}/alert-rules`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/workspaces/${workspaceId}/alert-rules`] });
      setShowDialog(false);
      toast({ title: "Alert rule created" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      apiRequest("PATCH", `/api/workspaces/${workspaceId}/alert-rules/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/workspaces/${workspaceId}/alert-rules`] });
      setShowDialog(false);
      toast({ title: "Alert rule updated" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/workspaces/${workspaceId}/alert-rules/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/workspaces/${workspaceId}/alert-rules`] });
      setDeleteTarget(null);
      toast({ title: "Alert rule deleted" });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) =>
      apiRequest("PATCH", `/api/workspaces/${workspaceId}/alert-rules/${id}`, { enabled }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [`/api/workspaces/${workspaceId}/alert-rules`] }),
  });

  const onSubmit = (values: RuleForm) => {
    const conditions: Record<string, any> = {};
    if (values.threshold) conditions.threshold = parseInt(values.threshold);
    const payload = {
      name: values.name,
      triggerType: values.triggerType,
      channelId: values.channelId === "__none__" ? null : values.channelId,
      enabled: values.enabled,
      conditions,
    };
    if (editTarget) {
      updateMutation.mutate({ id: editTarget.id, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const getTriggerInfo = (type: string) => TRIGGER_TYPES.find((t) => t.value === type) ?? TRIGGER_TYPES[0];
  const watchTriggerType = form.watch("triggerType");

  return (
    <div className="flex flex-col h-full">
        {/* Header */}
        <div className="border-b bg-background px-6 py-4 flex items-center gap-4">
          <BellRing className="w-5 h-5 text-primary" />
          <div>
            <h1 className="text-lg font-semibold">Alert Rules</h1>
            <p className="text-sm text-muted-foreground">Configure notifications for task, agent, and pipeline events</p>
          </div>
          <Button className="ml-auto" onClick={openCreate} data-testid="button-create-rule">
            <Plus className="w-4 h-4 mr-2" /> New Rule
          </Button>
        </div>

        {/* Live stats strip */}
        <LiveStatsStrip workspaceId={workspaceId} />

        {/* Rules list */}
        <div className="flex-1 overflow-auto p-6">
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Card key={i} className="animate-pulse">
                  <CardContent className="p-4 h-16" />
                </Card>
              ))}
            </div>
          ) : rules.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 gap-3 text-muted-foreground">
              <Bell className="w-10 h-10 opacity-30" />
              <p className="text-sm">No alert rules configured yet</p>
              <p className="text-xs opacity-60">Create a rule to receive notifications when specific events occur</p>
              <Button size="sm" variant="outline" onClick={openCreate}>
                <Plus className="w-4 h-4 mr-1" /> Create First Rule
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {rules.map((rule) => {
                const triggerInfo = getTriggerInfo(rule.triggerType);
                const TriggerIcon = triggerInfo.icon;
                const channel = channels.find((c) => c.id === rule.channelId);
                return (
                  <Card
                    key={rule.id}
                    data-testid={`card-rule-${rule.id}`}
                    className={`group transition-all ${rule.enabled ? "border-border/60" : "border-border/30 opacity-60"}`}
                  >
                    <CardContent className="p-4 flex items-center gap-4">
                      <div className={`w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0`}>
                        <TriggerIcon className={`w-4 h-4 ${triggerInfo.color}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-sm">{rule.name}</span>
                          <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${triggerInfo.color} border-current/30`}>
                            {triggerInfo.label}
                          </Badge>
                          {channel && (
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-muted-foreground">
                              → {channel.name}
                            </Badge>
                          )}
                          {rule.conditions?.threshold != null && (
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-amber-400 border-amber-500/30">
                              threshold: {rule.conditions.threshold}
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-0.5">
                          {rule.triggerCount > 0 && (
                            <span className="text-[10px] text-muted-foreground">
                              Triggered {rule.triggerCount} time{rule.triggerCount !== 1 ? "s" : ""}
                            </span>
                          )}
                          {rule.lastTriggeredAt && (
                            <span className="text-[10px] text-muted-foreground">
                              Last: {timeAgo(rule.lastTriggeredAt)}
                            </span>
                          )}
                          {rule.triggerCount === 0 && !rule.lastTriggeredAt && (
                            <span className="text-[10px] text-muted-foreground">Never triggered</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="w-8 h-8"
                          onClick={() => toggleMutation.mutate({ id: rule.id, enabled: !rule.enabled })}
                          data-testid={`button-toggle-rule-${rule.id}`}
                        >
                          {rule.enabled
                            ? <ToggleRight className="w-5 h-5 text-green-400" />
                            : <ToggleLeft className="w-5 h-5 text-muted-foreground" />
                          }
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="w-7 h-7 opacity-0 group-hover:opacity-100"
                          onClick={() => openEdit(rule)}
                          data-testid={`button-edit-rule-${rule.id}`}
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="w-7 h-7 opacity-0 group-hover:opacity-100 hover:text-red-400"
                          onClick={() => setDeleteTarget(rule)}
                          data-testid={`button-delete-rule-${rule.id}`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

      {/* Create / Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editTarget ? "Edit Alert Rule" : "New Alert Rule"}</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField control={form.control} name="name" render={({ field }) => (
                <FormItem>
                  <FormLabel>Rule Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Notify on task failure" {...field} data-testid="input-rule-name" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="triggerType" render={({ field }) => (
                <FormItem>
                  <FormLabel>Trigger Event</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger data-testid="select-trigger-type">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {TRIGGER_TYPES.map((t) => {
                        const Icon = t.icon;
                        return (
                          <SelectItem key={t.value} value={t.value}>
                            <span className="flex items-center gap-2">
                              <Icon className={`w-3.5 h-3.5 ${t.color}`} />
                              {t.label}
                            </span>
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />

              {watchTriggerType === "queue_depth" && (
                <FormField control={form.control} name="threshold" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Queue Depth Threshold</FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="e.g. 10" {...field} data-testid="input-threshold" />
                    </FormControl>
                    <FormDescription>Trigger when queue exceeds this number of pending tasks</FormDescription>
                  </FormItem>
                )} />
              )}

              <FormField control={form.control} name="channelId" render={({ field }) => (
                <FormItem>
                  <FormLabel>Delivery Channel <span className="text-muted-foreground font-normal">(optional)</span></FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger data-testid="select-channel">
                        <SelectValue placeholder="Select a channel…" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="__none__">No channel</SelectItem>
                      {channels.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription>Where to send the notification</FormDescription>
                </FormItem>
              )} />

              <FormField control={form.control} name="enabled" render={({ field }) => (
                <FormItem className="flex items-center gap-3">
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} data-testid="switch-rule-enabled" />
                  </FormControl>
                  <FormLabel className="!mt-0">Enable this rule</FormLabel>
                </FormItem>
              )} />

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setShowDialog(false)}>Cancel</Button>
                <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending} data-testid="button-submit-rule">
                  {(createMutation.isPending || updateMutation.isPending) && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  {editTarget ? "Save Changes" : "Create Rule"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Alert Rule</AlertDialogTitle>
            <AlertDialogDescription>
              Delete <strong>{deleteTarget?.name}</strong>? This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
              data-testid="button-confirm-delete-rule"
            >
              {deleteMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
