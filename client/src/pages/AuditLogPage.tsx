import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { ClipboardList, Search, RefreshCw, User, Shield, Wrench, FileText } from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { cn } from "@/lib/utils";

interface AuditEntry {
  id: string;
  workspaceId: string | null;
  userId: string | null;
  username: string | null;
  action: string;
  resourceType: string | null;
  resourceId: string | null;
  resourceName: string | null;
  details: Record<string, unknown> | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
}

const ACTION_STYLES: Record<string, { color: string; label: string }> = {
  create: { color: "bg-green-500/15 text-green-400 border-green-500/30", label: "Create" },
  update: { color: "bg-blue-500/15 text-blue-400 border-blue-500/30", label: "Update" },
  delete: { color: "bg-red-500/15 text-red-400 border-red-500/30", label: "Delete" },
  login:  { color: "bg-purple-500/15 text-purple-400 border-purple-500/30", label: "Login" },
  logout: { color: "bg-gray-500/15 text-gray-400 border-gray-500/30", label: "Logout" },
  execute:{ color: "bg-orange-500/15 text-orange-400 border-orange-500/30", label: "Execute" },
};

function getActionStyle(action: string) {
  const key = action.toLowerCase().split("_")[0];
  return ACTION_STYLES[key] ?? { color: "bg-muted text-muted-foreground border-border", label: action };
}

function ActionBadge({ action }: { action: string }) {
  const style = getActionStyle(action);
  return (
    <Badge variant="outline" className={cn("text-[10px] font-mono shrink-0", style.color)}>
      {action}
    </Badge>
  );
}

const RESOURCE_ICONS: Record<string, any> = {
  workspace: Shield,
  agent: User,
  orchestrator: Wrench,
  task: FileText,
};

export default function AuditLogPage() {
  const [search, setSearch] = useState("");
  const [resourceType, setResourceType] = useState("__all__");
  const [action, setAction] = useState("__all__");
  const [limit, setLimit] = useState("100");

  const params = new URLSearchParams({ limit });
  if (resourceType !== "__all__") params.set("resourceType", resourceType);
  if (action !== "__all__") params.set("action", action);

  const { data: entries = [], isLoading, refetch, isFetching, isError } = useQuery<AuditEntry[]>({
    queryKey: [`/api/admin/audit-log`, resourceType, action, limit],
    queryFn: async () => {
      const res = await fetch(`/api/admin/audit-log?${params}`, { credentials: "include" });
      if (!res.ok) throw new Error(`Failed to load audit log: ${res.status}`);
      const json = await res.json();
      // API returns { entries: [...], total: N } — extract the array
      return Array.isArray(json) ? json : (json.entries ?? []);
    },
  });

  const filtered = search.trim()
    ? entries.filter((e) =>
        [e.username, e.action, e.resourceType, e.resourceId, e.resourceName, e.ipAddress]
          .some((v) => v?.toLowerCase().includes(search.toLowerCase()))
      )
    : entries;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ClipboardList className="w-6 h-6 text-primary" />
            Audit Log
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Platform-wide record of all mutating actions.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          disabled={isFetching}
          data-testid="button-refresh-audit-log"
        >
          <RefreshCw className={cn("w-3.5 h-3.5 mr-1.5", isFetching && "animate-spin")} />
          Refresh
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            placeholder="Search user, action, resource…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-9 text-sm"
            data-testid="input-audit-search"
          />
        </div>
        <Select value={resourceType} onValueChange={setResourceType}>
          <SelectTrigger className="w-44 h-9 text-sm" data-testid="select-resource-type">
            <SelectValue placeholder="Resource type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All resources</SelectItem>
            <SelectItem value="workspace">Workspace</SelectItem>
            <SelectItem value="agent">Agent</SelectItem>
            <SelectItem value="orchestrator">Orchestrator</SelectItem>
            <SelectItem value="task">Task</SelectItem>
            <SelectItem value="channel">Channel</SelectItem>
            <SelectItem value="provider_key">Provider Key</SelectItem>
            <SelectItem value="api_key">API Key</SelectItem>
          </SelectContent>
        </Select>
        <Select value={action} onValueChange={setAction}>
          <SelectTrigger className="w-40 h-9 text-sm" data-testid="select-action-filter">
            <SelectValue placeholder="Action" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All actions</SelectItem>
            <SelectItem value="create">Create</SelectItem>
            <SelectItem value="update">Update</SelectItem>
            <SelectItem value="delete">Delete</SelectItem>
            <SelectItem value="execute">Execute</SelectItem>
            <SelectItem value="login">Login</SelectItem>
          </SelectContent>
        </Select>
        <Select value={limit} onValueChange={setLimit}>
          <SelectTrigger className="w-28 h-9 text-sm" data-testid="select-limit">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="50">50 rows</SelectItem>
            <SelectItem value="100">100 rows</SelectItem>
            <SelectItem value="250">250 rows</SelectItem>
            <SelectItem value="500">500 rows</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Summary */}
      <div className="text-xs text-muted-foreground">
        {isLoading ? "Loading…" : isError ? "Failed to load audit log — check your connection or permissions." : `${filtered.length} entr${filtered.length === 1 ? "y" : "ies"}${search ? " (filtered)" : ""}`}
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground text-xs">Timestamp</th>
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground text-xs">User</th>
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground text-xs">Action</th>
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground text-xs">Resource</th>
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground text-xs">IP</th>
                </tr>
              </thead>
              <tbody>
                {isLoading && (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-muted-foreground text-xs">Loading audit entries…</td>
                  </tr>
                )}
                {!isLoading && filtered.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-16 text-center">
                      <ClipboardList className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                      <div className="text-sm text-muted-foreground">No audit entries found</div>
                      <div className="text-xs text-muted-foreground/60 mt-1">
                        {search ? "Try adjusting your search filters" : "Audit entries will appear here as actions are performed"}
                      </div>
                    </td>
                  </tr>
                )}
                {filtered.map((entry, i) => {
                  const ResourceIcon = RESOURCE_ICONS[entry.resourceType ?? ""] ?? FileText;
                  return (
                    <tr
                      key={entry.id}
                      className="border-b last:border-0 hover:bg-muted/20 transition-colors"
                      data-testid={`row-audit-${i}`}
                    >
                      <td className="px-4 py-2.5">
                        <div className="font-mono text-xs text-foreground">
                          {format(new Date(entry.createdAt), "MM/dd HH:mm:ss")}
                        </div>
                        <div className="text-[10px] text-muted-foreground/60 mt-0.5">
                          {formatDistanceToNow(new Date(entry.createdAt), { addSuffix: true })}
                        </div>
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-1.5">
                          <div className="w-5 h-5 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
                            <span className="text-[9px] font-bold text-primary">
                              {(entry.username ?? "?")[0].toUpperCase()}
                            </span>
                          </div>
                          <span className="text-xs font-medium" data-testid={`text-audit-user-${i}`}>
                            {entry.username ?? <span className="text-muted-foreground italic">System</span>}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-2.5">
                        <ActionBadge action={entry.action} />
                      </td>
                      <td className="px-4 py-2.5">
                        {entry.resourceType ? (
                          <div className="flex items-center gap-1.5">
                            <ResourceIcon className="w-3 h-3 text-muted-foreground shrink-0" />
                            <div>
                              <span className="text-xs text-muted-foreground">{entry.resourceType}</span>
                              {entry.resourceName && (
                                <span className="mx-1 text-xs text-foreground font-medium">{entry.resourceName}</span>
                              )}
                              {entry.resourceId && (
                                <span className="text-[10px] font-mono text-muted-foreground/60">
                                  {entry.resourceId.slice(0, 8)}
                                </span>
                              )}
                            </div>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5">
                        <span className="text-[10px] font-mono text-muted-foreground">
                          {entry.ipAddress ?? "—"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
