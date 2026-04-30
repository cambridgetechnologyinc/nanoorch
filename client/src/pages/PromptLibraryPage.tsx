import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  BookOpen, Plus, Search, Tag, Copy, Pencil, Trash2,
  SlidersHorizontal, X, Loader2, CheckCircle2, Star,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";


const CATEGORIES = [
  { value: "__all__", label: "All Categories" },
  { value: "general", label: "General" },
  { value: "code", label: "Code" },
  { value: "analysis", label: "Analysis" },
  { value: "writing", label: "Writing" },
  { value: "support", label: "Support" },
  { value: "devops", label: "DevOps" },
  { value: "security", label: "Security" },
  { value: "data", label: "Data" },
];

const templateSchema = z.object({
  name: z.string().min(1, "Name required"),
  description: z.string().optional(),
  category: z.string().min(1, "Category required"),
  content: z.string().min(1, "Content required"),
  tags: z.string().optional(),
  isShared: z.boolean().default(false),
});
type TemplateForm = z.infer<typeof templateSchema>;

interface PromptTemplate {
  id: string;
  name: string;
  description?: string;
  category: string;
  content: string;
  tags: string[];
  isShared: boolean;
  usageCount: number;
  createdAt: string;
}

interface Props { workspaceId: string }

export default function PromptLibraryPage({ workspaceId }: Props) {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("__all__");
  const [editTarget, setEditTarget] = useState<PromptTemplate | null>(null);
  const [showDialog, setShowDialog] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<PromptTemplate | null>(null);
  const [previewTarget, setPreviewTarget] = useState<PromptTemplate | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const { data: templates = [], isLoading } = useQuery<PromptTemplate[]>({
    queryKey: [`/api/workspaces/${workspaceId}/prompt-templates`],
  });

  const filtered = templates.filter((t) => {
    const matchCat = category === "__all__" || t.category === category;
    const q = search.toLowerCase();
    const matchSearch = !q || t.name.toLowerCase().includes(q) || (t.description ?? "").toLowerCase().includes(q) || t.content.toLowerCase().includes(q) || (t.tags ?? []).some((tag: string) => tag.toLowerCase().includes(q));
    return matchCat && matchSearch;
  });

  const form = useForm<TemplateForm>({
    resolver: zodResolver(templateSchema),
    defaultValues: { name: "", description: "", category: "general", content: "", tags: "", isShared: false },
  });

  const openCreate = () => {
    setEditTarget(null);
    form.reset({ name: "", description: "", category: "general", content: "", tags: "", isShared: false });
    setShowDialog(true);
  };

  const openEdit = (t: PromptTemplate) => {
    setEditTarget(t);
    form.reset({
      name: t.name,
      description: t.description ?? "",
      category: t.category,
      content: t.content,
      tags: (t.tags ?? []).join(", "),
      isShared: t.isShared,
    });
    setShowDialog(true);
  };

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", `/api/workspaces/${workspaceId}/prompt-templates`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/workspaces/${workspaceId}/prompt-templates`] });
      setShowDialog(false);
      toast({ title: "Template created" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      apiRequest("PATCH", `/api/workspaces/${workspaceId}/prompt-templates/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/workspaces/${workspaceId}/prompt-templates`] });
      setShowDialog(false);
      toast({ title: "Template updated" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/workspaces/${workspaceId}/prompt-templates/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/workspaces/${workspaceId}/prompt-templates`] });
      setDeleteTarget(null);
      toast({ title: "Template deleted" });
    },
  });

  const trackUsageMutation = useMutation({
    mutationFn: (id: string) => apiRequest("POST", `/api/workspaces/${workspaceId}/prompt-templates/${id}/use`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [`/api/workspaces/${workspaceId}/prompt-templates`] }),
  });

  const onSubmit = (values: TemplateForm) => {
    const tags = values.tags ? values.tags.split(",").map((t) => t.trim()).filter(Boolean) : [];
    const payload = { ...values, tags };
    if (editTarget) {
      updateMutation.mutate({ id: editTarget.id, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const handleCopy = async (t: PromptTemplate) => {
    await navigator.clipboard.writeText(t.content);
    trackUsageMutation.mutate(t.id);
    setCopiedId(t.id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const CATEGORY_COLORS: Record<string, string> = {
    general: "bg-slate-500/15 text-slate-400 border-slate-500/20",
    code: "bg-blue-500/15 text-blue-400 border-blue-500/20",
    analysis: "bg-violet-500/15 text-violet-400 border-violet-500/20",
    writing: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
    support: "bg-amber-500/15 text-amber-400 border-amber-500/20",
    devops: "bg-orange-500/15 text-orange-400 border-orange-500/20",
    security: "bg-red-500/15 text-red-400 border-red-500/20",
    data: "bg-cyan-500/15 text-cyan-400 border-cyan-500/20",
  };

  return (
    <div className="flex flex-col h-full">
        {/* Header */}
        <div className="border-b bg-background px-6 py-4 flex items-center gap-4">
          <BookOpen className="w-5 h-5 text-primary" />
          <div>
            <h1 className="text-lg font-semibold">Prompt Library</h1>
            <p className="text-sm text-muted-foreground">Reusable prompt templates for your agents</p>
          </div>
          <Button className="ml-auto" onClick={openCreate} data-testid="button-create-template">
            <Plus className="w-4 h-4 mr-2" /> New Template
          </Button>
        </div>

        {/* Filters */}
        <div className="border-b bg-background/60 px-6 py-3 flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-52">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search templates…"
              className="pl-9 h-8 text-sm"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              data-testid="input-search-templates"
            />
            {search && (
              <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="h-8 text-sm w-44" data-testid="select-category-filter">
              <SlidersHorizontal className="w-3.5 h-3.5 mr-1.5" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CATEGORIES.map((c) => (
                <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-xs text-muted-foreground">{filtered.length} template{filtered.length !== 1 ? "s" : ""}</span>
        </div>

        {/* Grid */}
        <div className="flex-1 overflow-auto p-6">
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <Card key={i} className="animate-pulse">
                  <CardHeader className="pb-2">
                    <div className="h-4 bg-muted rounded w-3/4 mb-2" />
                    <div className="h-3 bg-muted rounded w-1/2" />
                  </CardHeader>
                  <CardContent>
                    <div className="h-16 bg-muted rounded" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 gap-3 text-muted-foreground">
              <BookOpen className="w-10 h-10 opacity-30" />
              <p className="text-sm">{search || category !== "__all__" ? "No templates match your filter" : "No prompt templates yet — create your first one"}</p>
              {!search && category === "__all__" && (
                <Button size="sm" variant="outline" onClick={openCreate}>
                  <Plus className="w-4 h-4 mr-1" /> Create Template
                </Button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filtered.map((t) => (
                <Card
                  key={t.id}
                  data-testid={`card-template-${t.id}`}
                  className="group flex flex-col hover:shadow-md transition-shadow cursor-pointer border-border/60"
                  onClick={() => setPreviewTarget(t)}
                >
                  <CardHeader className="pb-2 flex-row items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-sm font-semibold truncate">{t.name}</CardTitle>
                      {t.description && (
                        <CardDescription className="text-xs mt-0.5 line-clamp-1">{t.description}</CardDescription>
                      )}
                    </div>
                    <Badge className={`text-[10px] px-1.5 py-0.5 border shrink-0 ${CATEGORY_COLORS[t.category] ?? CATEGORY_COLORS.general}`}>
                      {t.category}
                    </Badge>
                  </CardHeader>
                  <CardContent className="flex-1 flex flex-col gap-2">
                    <pre className="text-xs text-muted-foreground bg-muted/50 rounded p-2 line-clamp-3 whitespace-pre-wrap font-mono overflow-hidden">
                      {t.content}
                    </pre>
                    {t.tags && t.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {t.tags.slice(0, 4).map((tag: string) => (
                          <span key={tag} className="flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                            <Tag className="w-2.5 h-2.5" />{tag}
                          </span>
                        ))}
                        {t.tags.length > 4 && <span className="text-[10px] text-muted-foreground">+{t.tags.length - 4}</span>}
                      </div>
                    )}
                    <div className="flex items-center gap-1 mt-auto pt-1 border-t border-border/40">
                      <span className="text-[10px] text-muted-foreground flex items-center gap-1 mr-auto">
                        <Star className="w-2.5 h-2.5" /> {t.usageCount ?? 0} uses
                      </span>
                      {t.isShared && (
                        <Badge variant="outline" className="text-[10px] py-0 px-1.5 border-emerald-500/30 text-emerald-400">shared</Badge>
                      )}
                      <Button
                        size="icon"
                        variant="ghost"
                        className="w-7 h-7 opacity-0 group-hover:opacity-100"
                        data-testid={`button-copy-${t.id}`}
                        onClick={(e) => { e.stopPropagation(); handleCopy(t); }}
                      >
                        {copiedId === t.id ? <CheckCircle2 className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="w-7 h-7 opacity-0 group-hover:opacity-100"
                        data-testid={`button-edit-${t.id}`}
                        onClick={(e) => { e.stopPropagation(); openEdit(t); }}
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="w-7 h-7 opacity-0 group-hover:opacity-100 hover:text-red-400"
                        data-testid={`button-delete-${t.id}`}
                        onClick={(e) => { e.stopPropagation(); setDeleteTarget(t); }}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

      {/* Create / Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editTarget ? "Edit Template" : "New Prompt Template"}</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <FormField control={form.control} name="name" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Template name" {...field} data-testid="input-template-name" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="category" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Category</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger data-testid="select-template-category">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {CATEGORIES.slice(1).map((c) => (
                          <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
              <FormField control={form.control} name="description" render={({ field }) => (
                <FormItem>
                  <FormLabel>Description <span className="text-muted-foreground font-normal">(optional)</span></FormLabel>
                  <FormControl>
                    <Input placeholder="Brief description" {...field} data-testid="input-template-description" />
                  </FormControl>
                </FormItem>
              )} />
              <FormField control={form.control} name="content" render={({ field }) => (
                <FormItem>
                  <FormLabel>Prompt Content</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Write your prompt template here. Use {{variable}} for placeholders."
                      className="font-mono text-sm min-h-40 resize-y"
                      {...field}
                      data-testid="textarea-template-content"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="tags" render={({ field }) => (
                <FormItem>
                  <FormLabel>Tags <span className="text-muted-foreground font-normal">(comma-separated)</span></FormLabel>
                  <FormControl>
                    <Input placeholder="rag, summarize, structured-output" {...field} data-testid="input-template-tags" />
                  </FormControl>
                </FormItem>
              )} />
              <FormField control={form.control} name="isShared" render={({ field }) => (
                <FormItem className="flex items-center gap-3">
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} data-testid="switch-template-shared" />
                  </FormControl>
                  <FormLabel className="!mt-0">Share with all workspace members</FormLabel>
                </FormItem>
              )} />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setShowDialog(false)}>Cancel</Button>
                <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending} data-testid="button-submit-template">
                  {(createMutation.isPending || updateMutation.isPending) && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  {editTarget ? "Save Changes" : "Create Template"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      {previewTarget && (
        <Dialog open onOpenChange={() => setPreviewTarget(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {previewTarget.name}
                <Badge className={`text-[10px] px-1.5 py-0.5 border ml-1 ${CATEGORY_COLORS[previewTarget.category] ?? CATEGORY_COLORS.general}`}>
                  {previewTarget.category}
                </Badge>
              </DialogTitle>
              {previewTarget.description && (
                <p className="text-sm text-muted-foreground">{previewTarget.description}</p>
              )}
            </DialogHeader>
            <pre className="text-sm bg-muted/40 rounded-lg p-4 whitespace-pre-wrap font-mono max-h-96 overflow-auto border border-border/40">
              {previewTarget.content}
            </pre>
            {previewTarget.tags && previewTarget.tags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {previewTarget.tags.map((tag: string) => (
                  <span key={tag} className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">{tag}</span>
                ))}
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => { openEdit(previewTarget); setPreviewTarget(null); }}>
                <Pencil className="w-4 h-4 mr-2" /> Edit
              </Button>
              <Button onClick={() => { handleCopy(previewTarget); setPreviewTarget(null); }}>
                <Copy className="w-4 h-4 mr-2" />
                {copiedId === previewTarget.id ? "Copied!" : "Copy Content"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Delete Confirm */}
      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Template</AlertDialogTitle>
            <AlertDialogDescription>
              Delete <strong>{deleteTarget?.name}</strong>? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
              data-testid="button-confirm-delete-template"
            >
              {deleteMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
