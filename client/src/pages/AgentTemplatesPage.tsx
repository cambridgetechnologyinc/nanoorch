import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import {
  Search, Wrench, ChevronRight, Loader2, LayoutTemplate, ArrowLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { AgentTemplate } from "@/components/TemplateGalleryDialog";

interface Props {
  workspaceId: string;
}

const CATEGORIES = [
  { id: "all",            label: "All" },
  { id: "infrastructure", label: "Infrastructure" },
  { id: "data",           label: "Data" },
  { id: "security",       label: "Security" },
  { id: "communication",  label: "Communication" },
  { id: "engineering",    label: "Engineering" },
  { id: "general",        label: "General" },
];

const CATEGORY_COLORS: Record<string, string> = {
  infrastructure: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  devops:         "bg-blue-500/15 text-blue-400 border-blue-500/30",
  data:           "bg-violet-500/15 text-violet-400 border-violet-500/30",
  security:       "bg-red-500/15 text-red-400 border-red-500/30",
  communication:  "bg-green-500/15 text-green-400 border-green-500/30",
  engineering:    "bg-orange-500/15 text-orange-400 border-orange-500/30",
  general:        "bg-muted text-muted-foreground border-border",
};

const ROLE_COLORS: Record<string, string> = {
  devops:       "bg-blue-500/15 text-blue-400 border-blue-500/30",
  data_analyst: "bg-violet-500/15 text-violet-400 border-violet-500/30",
  support:      "bg-green-500/15 text-green-400 border-green-500/30",
  code_review:  "bg-orange-500/15 text-orange-400 border-orange-500/30",
  security:     "bg-red-500/15 text-red-400 border-red-500/30",
  git_ops:      "bg-cyan-500/15 text-cyan-400 border-cyan-500/30",
  monitoring:   "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
};

const ROLE_LABELS: Record<string, string> = {
  devops:       "DevOps",
  data_analyst: "Data Analyst",
  support:      "Support",
  code_review:  "Code Review",
  security:     "Security",
  git_ops:      "GitOps",
  monitoring:   "Monitoring",
  custom:       "Custom",
};

function TemplateCard({ template }: { template: AgentTemplate }) {
  const categoryColor = CATEGORY_COLORS[template.category] ?? CATEGORY_COLORS.general;
  const roleColor = ROLE_COLORS[template.role] ?? "bg-muted text-muted-foreground border-border";
  const roleLabel = ROLE_LABELS[template.role] ?? template.role;

  return (
    <Card
      className="group flex flex-col gap-0 hover:border-primary/30 hover:shadow-sm transition-all duration-150 cursor-default"
      data-testid={`card-template-${template.id}`}
    >
      <CardContent className="p-5 flex flex-col gap-3 flex-1">
        <div className="flex items-start justify-between">
          <div className="text-3xl leading-none select-none">{template.icon}</div>
          <div className="flex gap-1.5 flex-wrap justify-end">
            <Badge variant="outline" className={cn("text-[10px] border", categoryColor)}>
              {template.categoryLabel}
            </Badge>
            {template.role && template.role !== "custom" && (
              <Badge variant="outline" className={cn("text-[10px] border", roleColor)}>
                {roleLabel}
              </Badge>
            )}
          </div>
        </div>

        <div className="flex-1">
          <div className="font-semibold text-sm leading-snug mb-1">{template.name}</div>
          <div className="text-xs text-muted-foreground leading-relaxed">{template.description}</div>
        </div>

        {template.tools.length > 0 && (
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <Wrench className="w-3 h-3 shrink-0" />
            <span className="font-medium">{template.tools.length} tool{template.tools.length !== 1 ? "s" : ""}</span>
            <span className="mx-1 opacity-40">·</span>
            <span className="truncate" title={template.tools.join(", ")}>
              {template.tools.slice(0, 4).join(", ")}{template.tools.length > 4 ? `…` : ""}
            </span>
          </div>
        )}

        {template.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {template.tags.slice(0, 5).map((tag) => (
              <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{tag}</span>
            ))}
          </div>
        )}

        <div className="pt-1 border-t border-border">
          <div className="text-[10px] text-muted-foreground mb-1 font-medium uppercase tracking-wide">System Prompt preview</div>
          <pre className="text-[10px] text-muted-foreground/80 font-mono line-clamp-3 whitespace-pre-wrap leading-relaxed">
            {template.systemPrompt.slice(0, 200)}{template.systemPrompt.length > 200 ? "…" : ""}
          </pre>
        </div>

        <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-1">
          <span>Temp: {(template.defaultTemperature / 100).toFixed(2)}</span>
          <span>{template.defaultMaxTokens.toLocaleString()} max tokens</span>
        </div>
      </CardContent>
    </Card>
  );
}

export default function AgentTemplatesPage({ workspaceId }: Props) {
  const [, navigate] = useLocation();
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("all");

  const { data: templates = [], isLoading } = useQuery<AgentTemplate[]>({
    queryKey: ["/api/agent-templates"],
  });

  const filtered = templates.filter((t) => {
    const matchCat = activeCategory === "all" || t.category === activeCategory;
    const q = search.toLowerCase();
    const matchSearch = !q
      || t.name.toLowerCase().includes(q)
      || t.description.toLowerCase().includes(q)
      || t.tags.some((tag) => tag.toLowerCase().includes(q))
      || t.tools.some((tool) => tool.toLowerCase().includes(q));
    return matchCat && matchSearch;
  });

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(`/workspaces/${workspaceId}`)}
            className="h-8 w-8"
            data-testid="button-back"
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <LayoutTemplate className="w-6 h-6 text-primary" /> Agent Templates
            </h1>
            <p className="text-muted-foreground mt-0.5">
              Built-in role templates — pick one and pre-fill your agent configuration
            </p>
          </div>
        </div>
        <div className="text-sm text-muted-foreground">
          {isLoading ? "Loading…" : `${filtered.length} / ${templates.length} templates`}
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search templates, tools, tags…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
            data-testid="input-template-search"
          />
        </div>
      </div>

      <div className="flex gap-1.5 overflow-x-auto pb-3 scrollbar-none mb-5">
        {CATEGORIES.map((cat) => {
          const count = cat.id === "all"
            ? templates.length
            : templates.filter((t) => t.category === cat.id).length;
          return (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              data-testid={`tab-template-cat-${cat.id}`}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm whitespace-nowrap transition-colors shrink-0",
                activeCategory === cat.id
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
              )}
            >
              {cat.label}
              <span className={cn(
                "text-[10px] rounded-full px-1.5 py-0.5 font-medium",
                activeCategory === cat.id ? "bg-white/20" : "bg-muted"
              )}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-48 gap-2 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin" /> Loading templates…
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
          <Search className="w-10 h-10 mb-2 opacity-30" />
          <div className="font-medium">No templates match your search</div>
          <div className="text-sm mt-1">Try a different keyword or category</div>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((template) => (
            <TemplateCard key={template.id} template={template} />
          ))}
        </div>
      )}

      <div className="mt-6 p-4 rounded-xl border border-primary/20 bg-primary/5 flex items-center gap-3">
        <LayoutTemplate className="w-5 h-5 text-primary shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium">Ready to use a template?</div>
          <div className="text-xs text-muted-foreground">
            Go to an orchestrator's Agents page and click <strong>From Template</strong> to create an agent pre-configured with any template above.
          </div>
        </div>
        <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
      </div>
    </div>
  );
}
