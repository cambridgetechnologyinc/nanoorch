import { useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Download, FileImage, ArrowLeft } from "lucide-react";
import { Link } from "wouter";

const W = 1100;
const H = 620;

const C = {
  bg: "#07091a",
  card: "#0d1225",
  titleBg: "#0a0f22",
  orange: "#f97316",
  red: "#ef4444",
  green: "#10b981",
  cyan: "#06b6d4",
  purple: "#a855f7",
  amber: "#f59e0b",
  engine: "#8b5cf6",
  emerald: "#22c55e",
  blue: "#3b82f6",
  pink: "#ec4899",
  sky: "#38bdf8",
  text: "#f1f5f9",
  sub: "#94a3b8",
  dim: "#475569",
  gridLine: "#131929",
};

interface BoxDef {
  x: number; y: number; w: number; h: number;
  color: string; title: string; icon: string; items: string[];
}

function Box({ x, y, w, h, color, title, icon, items }: BoxDef) {
  const lineH = 12.5;
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={5} fill={C.card} stroke={color} strokeWidth={1.4} />
      <rect x={x} y={y} width={w} height={20} rx={5} fill={color} opacity={0.18} />
      <rect x={x} y={y + 15} width={w} height={5} fill={color} opacity={0.18} />
      <rect x={x} y={y} width={3} height={h} rx={2} fill={color} opacity={0.7} />
      <text x={x + 10} y={y + 13.5} fill={color} fontSize={9} fontWeight="800"
        fontFamily="system-ui,-apple-system,sans-serif" letterSpacing="0.06em">
        {icon}  {title.toUpperCase()}
      </text>
      {items.map((item, i) => (
        <text key={i} x={x + 10} y={y + 26 + i * lineH}
          fill={C.sub} fontSize={8.5} fontFamily="system-ui,-apple-system,sans-serif">
          · {item}
        </text>
      ))}
    </g>
  );
}

function Arrow({ d, color, dashed }: { d: string; color: string; dashed?: boolean }) {
  const id = `arr${color.replace("#", "")}`;
  return (
    <>
      <defs>
        <marker id={id} markerWidth={6} markerHeight={6} refX={5} refY={3} orient="auto">
          <path d="M0,0 L6,3 L0,6 Z" fill={color} opacity={0.85} />
        </marker>
      </defs>
      <path d={d} fill="none" stroke={color} strokeWidth={1.3}
        strokeDasharray={dashed ? "5,3" : undefined}
        markerEnd={`url(#${id})`} opacity={0.75} />
    </>
  );
}

function Dot({ cx, cy, color }: { cx: number; cy: number; color: string }) {
  return <circle cx={cx} cy={cy} r={3.5} fill={color} opacity={0.9} />;
}

export default function ArchitecturePage() {
  const svgRef = useRef<SVGSVGElement>(null);

  const downloadSVG = useCallback(() => {
    if (!svgRef.current) return;
    const clone = svgRef.current.cloneNode(true) as SVGSVGElement;
    clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    const src = new XMLSerializer().serializeToString(clone);
    const blob = new Blob([src], { type: "image/svg+xml;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "nanoorch-architecture.svg";
    a.click();
    URL.revokeObjectURL(a.href);
  }, []);

  const downloadPNG = useCallback(() => {
    if (!svgRef.current) return;
    const clone = svgRef.current.cloneNode(true) as SVGSVGElement;
    clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    const src = new XMLSerializer().serializeToString(clone);
    const blob = new Blob([src], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const scale = 2;
    const canvas = document.createElement("canvas");
    canvas.width = W * scale;
    canvas.height = H * scale;
    const ctx = canvas.getContext("2d")!;
    const img = new window.Image();
    img.onload = () => {
      ctx.scale(scale, scale);
      ctx.drawImage(img, 0, 0);
      const a = document.createElement("a");
      a.href = canvas.toDataURL("image/png");
      a.download = "nanoorch-architecture.png";
      a.click();
      URL.revokeObjectURL(url);
    };
    img.src = url;
  }, []);

  const L = { x: 8, w: 178 };
  const CE = { x: 194, w: 262 };
  const CR = { x: 464, w: 228 };
  const FR1 = { x: 700, w: 190 };
  const FR2 = { x: 898, w: 194 };

  const TOP = 63;
  const BOT = 543;
  const SPAN = BOT - TOP;

  const leftBoxH = (SPAN - 4 * 6) / 5;
  const crBoxH = (SPAN - 3 * 6) / 4;

  const lY = (i: number) => TOP + i * (leftBoxH + 6);
  const crY = (i: number) => TOP + i * (crBoxH + 6);

  const engTop = TOP + leftBoxH + 6;
  const engH = BOT - engTop;

  const MX = CE.x + CE.w / 2;

  return (
    <div className="min-h-screen bg-[#07091a] flex flex-col items-center py-5 px-3">
      <div className="flex items-center justify-between w-full max-w-[1100px] mb-3">
        <Link href="/workspaces">
          <Button variant="ghost" size="sm" className="text-slate-400 hover:text-white gap-1">
            <ArrowLeft className="w-3.5 h-3.5" /> Back
          </Button>
        </Link>
        <h1 className="text-white font-bold text-base tracking-wide">NanoOrch Architecture</h1>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={downloadSVG}
            className="border-slate-700 text-slate-300 hover:text-white gap-1.5">
            <Download className="w-3.5 h-3.5" /> SVG
          </Button>
          <Button variant="outline" size="sm" onClick={downloadPNG}
            className="border-slate-700 text-slate-300 hover:text-white gap-1.5">
            <FileImage className="w-3.5 h-3.5" /> PNG
          </Button>
        </div>
      </div>

      <div className="overflow-auto w-full flex justify-center">
        <svg ref={svgRef} xmlns="http://www.w3.org/2000/svg"
          width={W} height={H} viewBox={`0 0 ${W} ${H}`}
          style={{ display: "block", maxWidth: "100%" }}>

          <defs>
            <linearGradient id="titleGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#a855f7" />
              <stop offset="50%" stopColor="#6366f1" />
              <stop offset="100%" stopColor="#06b6d4" />
            </linearGradient>
            <linearGradient id="engineGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#1a103a" />
              <stop offset="100%" stopColor="#0d1225" />
            </linearGradient>
            <filter id="glow">
              <feGaussianBlur stdDeviation="2" result="coloredBlur" />
              <feMerge>
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Background */}
          <rect width={W} height={H} fill={C.bg} />

          {/* Subtle grid */}
          {Array.from({ length: 22 }).map((_, i) => (
            <line key={`gx${i}`} x1={i * 52} y1={0} x2={i * 52} y2={H}
              stroke={C.gridLine} strokeWidth={0.5} />
          ))}
          {Array.from({ length: 13 }).map((_, i) => (
            <line key={`gy${i}`} x1={0} y1={i * 52} x2={W} y2={i * 52}
              stroke={C.gridLine} strokeWidth={0.5} />
          ))}

          {/* ── Title bar ── */}
          <rect x={0} y={0} width={W} height={56} fill={C.titleBg} />
          <rect x={0} y={53} width={W} height={2} fill="url(#titleGrad)" opacity={0.6} />

          <text x={W / 2} y={24} textAnchor="middle"
            fill="url(#titleGrad)" fontSize={22} fontWeight="900"
            fontFamily="system-ui,-apple-system,sans-serif" letterSpacing="0.12em">
            NANOORCH
          </text>
          <text x={W / 2} y={43} textAnchor="middle"
            fill={C.sub} fontSize={10} fontFamily="system-ui,-apple-system,sans-serif"
            letterSpacing="0.18em" fontWeight="500">
            AI AGENT ORCHESTRATION PLATFORM · ARCHITECTURE
          </text>

          {/* ── Column labels ── */}
          {[
            { x: L.x + L.w / 2, label: "SUPPORT SYSTEMS" },
            { x: CE.x + CE.w / 2, label: "CORE ENGINE" },
            { x: CR.x + CR.w / 2, label: "DATA LAYER" },
            { x: FR1.x + FR1.w / 2, label: "INPUTS & PROVIDERS" },
            { x: FR2.x + FR2.w / 2, label: "OUTPUTS & INFRA" },
          ].map(({ x, label }) => (
            <text key={label} x={x} y={TOP - 6} textAnchor="middle"
              fill={C.dim} fontSize={7} fontFamily="system-ui,-apple-system,sans-serif"
              letterSpacing="0.14em" fontWeight="700">
              {label}
            </text>
          ))}

          {/* ══════════════════════════════════════════════
              LEFT COLUMN — Support Systems
          ══════════════════════════════════════════════ */}

          <Box x={L.x} y={lY(0)} w={L.w} h={leftBoxH} color={C.orange} icon="◈" title="Memory"
            items={["Conversation History", "Agent Memory Keys", "last_chat_output", "last_task_output", "In-Process KV Store"]} />

          <Box x={L.x} y={lY(1)} w={L.w} h={leftBoxH} color={C.red} icon="◈" title="Security & RBAC"
            items={["SuperAdmin / Admin / Member", "OIDC / SAML 2.0 SSO", "AES-256 Credential Encryption", "Per-Workspace BYOK Override", "JWT Session Management"]} />

          <Box x={L.x} y={lY(2)} w={L.w} h={leftBoxH} color={C.green} icon="◈" title="Deployment"
            items={["Docker / Docker Compose", "K3s / Kubernetes", "gVisor Kernel Sandbox", "Docker Secrets (no inspect leak)", "Enterprise V8 Bytecode Build"]} />

          <Box x={L.x} y={lY(3)} w={L.w} h={leftBoxH} color={C.cyan} icon="◈" title="Monitoring"
            items={["SSE Real-Time Trace Stream", "Visual Trace Graph", "Observability Dashboard", "Agent Job Logs", "Heartbeat Health Checks"]} />

          <Box x={L.x} y={lY(4)} w={L.w} h={leftBoxH} color={C.purple} icon="◈" title="Enterprise Dist."
            items={["V8 Bytecode (Bytenode)", "Zero-Source Docker Image", "Docker Secrets Integration", "deploy/ Self-Contained Pkg", "3-Stage Dockerfile Build"]} />

          {/* ══════════════════════════════════════════════
              CENTER COLUMN — Tool Integration + Engine
          ══════════════════════════════════════════════ */}

          <Box x={CE.x} y={TOP} w={CE.w} h={leftBoxH} color={C.amber} icon="⬡" title="Tool Integration"
            items={["44+ PostgreSQL DB Tools", "45 Kubernetes Cloud Tools", "Docker Sandbox Executor", "MCP Protocol Compatible", "Git Repo Tool Runner"]} />

          {/* Engine — main box */}
          <rect x={CE.x} y={engTop} width={CE.w} height={engH} rx={6}
            fill="url(#engineGrad)" stroke={C.engine} strokeWidth={2} />
          <rect x={CE.x} y={engTop} width={CE.w} height={22} rx={6}
            fill={C.engine} opacity={0.22} />
          <rect x={CE.x} y={engTop + 17} width={CE.w} height={5}
            fill={C.engine} opacity={0.22} />
          <rect x={CE.x} y={engTop} width={4} height={engH} rx={2}
            fill={C.engine} opacity={0.8} />
          <rect x={CE.x + CE.w - 4} y={engTop} width={4} height={engH} rx={2}
            fill={C.engine} opacity={0.4} />

          <text x={CE.x + 10} y={engTop + 14.5}
            fill={C.engine} fontSize={9.5} fontWeight="900"
            fontFamily="system-ui,-apple-system,sans-serif" letterSpacing="0.1em"
            filter="url(#glow)">
            ⬡  ORCHESTRATION ENGINE
          </text>

          {[
            "Agent Scheduler & Dispatcher",
            "Pipeline Execution Engine",
            "Git Agent Auto-Runner",
            "Memory Manager",
            "Tool Dispatcher (PG / K8s / Docker)",
            "Human Approval Workflow",
            "Job Heartbeat & Recovery",
            "BYOK Provider Key Resolution",
            "Multi-LLM Routing (OpenAI / Claude / Gemini / vLLM)",
            "Real-Time Trace Collector",
            "Webhook Event Processor",
            "Multi-Tenant Workspace Isolation",
          ].map((item, i) => (
            <text key={i} x={CE.x + 10} y={engTop + 30 + i * 13.5}
              fill={i === 0 ? C.text : C.sub} fontSize={8.8}
              fontFamily="system-ui,-apple-system,sans-serif"
              fontWeight={i === 0 ? "600" : "400"}>
              {i === 0 ? "▸ " : "· "}{item}
            </text>
          ))}

          {/* ══════════════════════════════════════════════
              CENTER-RIGHT COLUMN — Data Layer
          ══════════════════════════════════════════════ */}

          <Box x={CR.x} y={crY(0)} w={CR.w} h={crBoxH} color={C.blue} icon="◈" title="Input Sources"
            items={["Chat UI (React + SSE)", "GitHub / GitLab Webhooks", "Slack / Teams / Google Chat", "REST API / HTTP Webhooks", "Scheduled Cron Triggers", "Approval Gate Events"]} />

          <Box x={CR.x} y={crY(1)} w={CR.w} h={crBoxH} color={C.amber} icon="◈" title="Data Processing"
            items={["Pipeline Definitions & Steps", "Event-Driven Trigger System", "Scheduled Job Dispatcher", "Approval Gate Routing", "Webhook Signature Verification", "Rate Limiting & Queuing"]} />

          <Box x={CR.x} y={crY(2)} w={CR.w} h={crBoxH} color={C.orange} icon="◈" title="Memory & Context"
            items={["Per-Conversation History", "Agent Memory Key Store", "last_chat_output / last_task_output", "Cross-Agent Memory Sharing", "Context Window Management", "Token Budget Tracking"]} />

          <Box x={CR.x} y={crY(3)} w={CR.w} h={crBoxH} color={C.green} icon="◈" title="Knowledge Store"
            items={["PostgreSQL Primary Store (44+ tools)", "Git Repository Index", "Code Execution Results", "File / Document Store", "Migration Version Tracking", "Session & Auth Store"]} />

          {/* ══════════════════════════════════════════════
              FAR-RIGHT COLUMN 1 — Inputs & Providers
          ══════════════════════════════════════════════ */}

          <Box x={FR1.x} y={crY(0)} w={FR1.w} h={crBoxH} color={C.amber} icon="⬡" title="Input Channels"
            items={["Web Chat (React UI)", "GitHub / GitLab Push/PR", "Slack Events API", "Microsoft Teams Bot", "Google Chat Webhook", "Generic HTTP Webhook"]} />

          <Box x={FR1.x} y={crY(1)} w={FR1.w} h={crBoxH} color={C.blue} icon="⬡" title="Model Providers"
            items={["OpenAI (GPT-4o / mini)", "Anthropic (Claude 3.x / Haiku)", "Google Gemini 1.5/2.0", "vLLM On-Prem GPU Server", "BYOK per-workspace override", "Global superadmin key fallback"]} />

          <Box x={FR1.x} y={crY(2)} w={FR1.w} h={crBoxH} color={C.pink} icon="⬡" title="Multi-Tenant"
            items={["Workspace Isolation", "Per-Workspace Limits (agents, runs)", "Member Role Management", "Usage & Job Tracking", "White-Label Branding", "Per-WS Custom Domain (SSO)"]} />

          <Box x={FR1.x} y={crY(3)} w={FR1.w} h={crBoxH} color={C.green} icon="⬡" title="GitOps Agents"
            items={["Auto PR Code Review", "Branch Deploy Automation", "Release Note Generation", "Commit Summarizer Agent", "Repo-triggered Pipelines", "HMAC Signature Verification"]} />

          {/* ══════════════════════════════════════════════
              FAR-RIGHT COLUMN 2 — Outputs & Infra
          ══════════════════════════════════════════════ */}

          <Box x={FR2.x} y={crY(0)} w={FR2.w} h={crBoxH} color={C.sky} icon="⬡" title="K8s Cloud (45 Tools)"
            items={["K3s / EKS / GKE / AKS", "Pod & Deployment Mgmt", "Namespace & RBAC", "ConfigMap / Secret Ops", "Helm Read (list/status)", "Log Streaming & Events"]} />

          <Box x={FR2.x} y={crY(1)} w={FR2.w} h={crBoxH} color={C.red} icon="⬡" title="Sandbox Execution"
            items={["Docker Container Runner", "gVisor Kernel Isolation", "Seccomp Hardened Profile", "Code Execution Sandbox", "Network-Isolated Tasks", "Agent Action Containers"]} />

          <Box x={FR2.x} y={crY(2)} w={FR2.w} h={crBoxH} color={C.purple} icon="⬡" title="SSO & Identity"
            items={["OIDC / OAuth2 Provider", "SAML 2.0 IDP Support", "ACS / Callback URL Mgmt", "JWT Session Validation", "Admin User Seeding", "Org-wide SSO Enforcement"]} />

          <Box x={FR2.x} y={crY(3)} w={FR2.w} h={crBoxH} color={C.emerald} icon="⬡" title="Outputs"
            items={["Chat UI Responses (SSE)", "REST API JSON Results", "Real-Time Trace Streams", "Webhook Event Dispatch", "Pipeline Run Reports", "Approval Notifications"]} />

          {/* ══════════════════════════════════════════════
              ARROWS — Primary Processing Flow
          ══════════════════════════════════════════════ */}

          {/* Tool Integration → Engine (vertical) */}
          <Arrow d={`M ${MX},${TOP + leftBoxH} L ${MX},${engTop}`} color={C.engine} />
          <Dot cx={MX} cy={TOP + leftBoxH} color={C.engine} />

          {/* Engine → Outputs (horizontal out right, at 75% down engine) */}
          <Arrow d={`M ${CE.x + CE.w},${engTop + engH * 0.75} L ${FR2.x},${engTop + engH * 0.75}`}
            color={C.emerald} />
          <Dot cx={CE.x + CE.w} cy={engTop + engH * 0.75} color={C.emerald} />

          {/* Input Sources (CR col 0) → engine right side */}
          <Arrow d={`M ${CR.x},${crY(0) + crBoxH * 0.5} L ${CE.x + CE.w},${crY(0) + crBoxH * 0.5}`}
            color={C.blue} />
          <Dot cx={CR.x} cy={crY(0) + crBoxH * 0.5} color={C.blue} />

          {/* Data Processing (CR col 1) → engine right side */}
          <Arrow d={`M ${CR.x},${crY(1) + crBoxH * 0.5} L ${CE.x + CE.w},${crY(1) + crBoxH * 0.5}`}
            color={C.amber} />
          <Dot cx={CR.x} cy={crY(1) + crBoxH * 0.5} color={C.amber} />

          {/* Memory (CR col 2) → engine right side */}
          <Arrow d={`M ${CR.x},${crY(2) + crBoxH * 0.5} L ${CE.x + CE.w},${crY(2) + crBoxH * 0.5}`}
            color={C.orange} />
          <Dot cx={CR.x} cy={crY(2) + crBoxH * 0.5} color={C.orange} />

          {/* Knowledge (CR col 3) → engine right side */}
          <Arrow d={`M ${CR.x},${crY(3) + crBoxH * 0.5} L ${CE.x + CE.w},${crY(3) + crBoxH * 0.5}`}
            color={C.green} />
          <Dot cx={CR.x} cy={crY(3) + crBoxH * 0.5} color={C.green} />

          {/* ══════════════════════════════════════════════
              ARROWS — Support Systems (left → engine)
          ══════════════════════════════════════════════ */}

          {[
            { y: lY(0) + leftBoxH * 0.5, color: C.orange },
            { y: lY(1) + leftBoxH * 0.5, color: C.red },
            { y: lY(2) + leftBoxH * 0.5, color: C.green },
            { y: lY(3) + leftBoxH * 0.5, color: C.cyan },
            { y: lY(4) + leftBoxH * 0.5, color: C.purple },
          ].map(({ y, color }, i) => (
            <g key={i}>
              <Dot cx={L.x + L.w} cy={y} color={color} />
              <Arrow d={`M ${L.x + L.w + 3},${y} L ${CE.x - 1},${y}`}
                color={color} dashed />
              <Dot cx={CE.x} cy={y} color={color} />
            </g>
          ))}

          {/* ══════════════════════════════════════════════
              ARROWS — Far-right providers → engine (routed above)
          ══════════════════════════════════════════════ */}

          {/* Input Channels (FR1 col0) → Tool Integration top via above-diagram path */}
          <Arrow
            d={`M ${FR1.x + FR1.w / 2},${crY(0)} L ${FR1.x + FR1.w / 2},${TOP - 10} L ${CE.x + CE.w / 2},${TOP - 10} L ${CE.x + CE.w / 2},${TOP}`}
            color={C.amber} />
          <Dot cx={FR1.x + FR1.w / 2} cy={crY(0)} color={C.amber} />

          {/* Model Providers → engine (path routed through top) */}
          <Arrow
            d={`M ${FR1.x + FR1.w / 2},${crY(1)} L ${FR1.x + FR1.w / 2},${TOP - 18} L ${MX + 15},${TOP - 18} L ${MX + 15},${engTop}`}
            color={C.blue} dashed />
          <Dot cx={FR1.x + FR1.w / 2} cy={crY(1)} color={C.blue} />

          {/* K8s Tools (FR2 col0) → engine via above path */}
          <Arrow
            d={`M ${FR2.x + FR2.w / 2},${crY(0)} L ${FR2.x + FR2.w / 2},${TOP - 26} L ${MX + 28},${TOP - 26} L ${MX + 28},${engTop}`}
            color={C.sky} dashed />
          <Dot cx={FR2.x + FR2.w / 2} cy={crY(0)} color={C.sky} />

          {/* Sandbox → engine (route via bottom) */}
          <Arrow
            d={`M ${FR2.x + FR2.w / 2},${crY(1) + crBoxH} L ${FR2.x + FR2.w / 2},${BOT + 12} L ${MX - 18},${BOT + 12} L ${MX - 18},${engTop + engH}`}
            color={C.red} dashed />
          <Dot cx={FR2.x + FR2.w / 2} cy={crY(1) + crBoxH} color={C.red} />

          {/* GitOps → engine bottom */}
          <Arrow
            d={`M ${FR1.x + FR1.w / 2},${crY(3) + crBoxH} L ${FR1.x + FR1.w / 2},${BOT + 20} L ${MX + 5},${BOT + 20} L ${MX + 5},${engTop + engH}`}
            color={C.green} dashed />
          <Dot cx={FR1.x + FR1.w / 2} cy={crY(3) + crBoxH} color={C.green} />

          {/* ══════════════════════════════════════════════
              LEGEND
          ══════════════════════════════════════════════ */}
          <rect x={8} y={H - 52} width={W - 16} height={44} rx={5}
            fill={C.card} stroke={C.dim} strokeWidth={0.8} opacity={0.85} />
          <text x={22} y={H - 36} fill={C.dim} fontSize={8}
            fontFamily="system-ui,-apple-system,sans-serif" fontWeight="700" letterSpacing="0.1em">
            DATA FLOW LEGEND
          </text>

          {[
            { x: 22, color: C.engine, label: "Primary Processing Flow", dashed: false },
            { x: 230, color: C.dim, label: "Support System Connection", dashed: true },
            { x: 448, color: C.blue, label: "Data Input Connection", dashed: false },
            { x: 650, color: C.red, label: "Feedback / Indirect Path", dashed: true },
            { x: 862, color: C.emerald, label: "Output / Result Flow", dashed: false },
          ].map(({ x, color, label, dashed }, i) => (
            <g key={i}>
              <line x1={x} y1={H - 20} x2={x + 30} y2={H - 20}
                stroke={color} strokeWidth={1.5}
                strokeDasharray={dashed ? "5,3" : undefined} />
              <path d={`M ${x + 27},${H - 23} L ${x + 33},${H - 20} L ${x + 27},${H - 17} Z`}
                fill={color} opacity={0.8} />
              <text x={x + 37} y={H - 17} fill={C.sub} fontSize={8}
                fontFamily="system-ui,-apple-system,sans-serif">
                {label}
              </text>
            </g>
          ))}

          {/* Version badge */}
          <rect x={W - 88} y={H - 52} width={80} height={18} rx={4}
            fill={C.engine} opacity={0.15} />
          <text x={W - 48} y={H - 40} textAnchor="middle"
            fill={C.engine} fontSize={7.5} fontFamily="system-ui,-apple-system,sans-serif"
            letterSpacing="0.08em" fontWeight="700">
            nanoorch.io
          </text>

        </svg>
      </div>
    </div>
  );
}
