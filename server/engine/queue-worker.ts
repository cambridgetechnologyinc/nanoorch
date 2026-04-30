import { storage } from "../storage";
import type { JobQueueItem } from "@shared/schema";

let workerRunning = false;
let workerTimer: ReturnType<typeof setInterval> | null = null;

const POLL_INTERVAL_MS = 3000;
const MAX_CONCURRENT = 5;
let activeCount = 0;

async function processItem(item: JobQueueItem): Promise<void> {
  try {
    await storage.updateJobQueueItem(item.id, { status: "running", startedAt: new Date() });

    const orchestrator = await storage.getOrchestrator(item.orchestratorId);
    if (!orchestrator || orchestrator.status === "paused") {
      await storage.updateJobQueueItem(item.id, {
        status: "failed",
        error: "Orchestrator is paused or not found",
        completedAt: new Date(),
      });
      return;
    }

    const task = await storage.createTask({
      orchestratorId: item.orchestratorId,
      agentId: item.agentId ?? undefined,
      input: item.prompt,
      status: "pending",
      priority: item.priority ?? 5,
      intent: "conversational",
      bypassApproval: false,
    });

    await storage.updateJobQueueItem(item.id, {
      status: "completed",
      taskId: task.id,
      completedAt: new Date(),
    });

    console.log(`[queue-worker] Processed item ${item.id} → task ${task.id} (source: ${item.source})`);
  } catch (err: any) {
    console.error(`[queue-worker] Failed to process item ${item.id}:`, err);
    await storage.updateJobQueueItem(item.id, {
      status: "failed",
      error: err?.message ?? "Unknown error",
      completedAt: new Date(),
    });
  } finally {
    activeCount--;
  }
}

async function pollQueue(): Promise<void> {
  if (activeCount >= MAX_CONCURRENT) return;

  const available = MAX_CONCURRENT - activeCount;
  const items = await storage.dequeuePendingItems(available);

  for (const item of items) {
    activeCount++;
    processItem(item).catch(console.error);
  }
}

export async function startQueueWorker(): Promise<void> {
  if (workerRunning) return;
  workerRunning = true;

  workerTimer = setInterval(() => {
    pollQueue().catch(console.error);
  }, POLL_INTERVAL_MS);

  console.log("[queue-worker] Started");
}

export function stopQueueWorker(): void {
  if (workerTimer) {
    clearInterval(workerTimer);
    workerTimer = null;
  }
  workerRunning = false;
  console.log("[queue-worker] Stopped");
}
