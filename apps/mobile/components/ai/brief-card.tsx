import { AiRepository } from "@nox/api";
import { useTasks } from "@nox/features";
import type { Task } from "@nox/types";
import { addDays } from "@nox/utils";
import { useState } from "react";
import { Text, View } from "react-native";
import { useAiCall, useAiEnabled } from "../../lib/use-ai";
import { AiButton, AiPanel } from "./ai-ui";

type Kind = "daily" | "weekly";

/** Briefs already written this session, so reopening Tasks doesn't spend another request. */
const cache = new Map<string, string>();

const brief = (t: Task) => ({
  title: t.title.slice(0, 100),
  priority: t.priority,
  ...(t.due_date ? { due: t.due_date } : {}),
  ...(t.due_time ? { time: t.due_time.slice(0, 5) } : {}),
});

/** What a brief is written from: small, and only titles, days and priorities — no notes. */
function dataFor(kind: Kind, tasks: Task[], today: string) {
  const live = tasks.filter((t) => !t.deleted && !(t.repeat !== "none" && t.origin_task_id === null));
  const open = live.filter((t) => t.status !== "complete");
  if (kind === "daily") {
    return {
      today_open: open.filter((t) => t.due_date === today || t.due_date === null).slice(0, 25).map(brief),
      overdue: open.filter((t) => t.due_date !== null && t.due_date < today).slice(0, 15).map(brief),
      done_today: live.filter((t) => t.status === "complete" && t.updated_at.slice(0, 10) === today).length,
      tomorrow_count: open.filter((t) => t.due_date === addDays(today, 1)).length,
    };
  }
  const weekAgo = addDays(today, -7);
  return {
    done_this_week: live
      .filter((t) => t.status === "complete" && t.updated_at.slice(0, 10) > weekAgo)
      .slice(0, 30)
      .map((t) => t.title.slice(0, 100)),
    still_overdue: open.filter((t) => t.due_date !== null && t.due_date < today).slice(0, 15).map(brief),
    carried_over: live.filter((t) => t.status === "carried_over").length,
    next_week: open.filter((t) => t.due_date !== null && t.due_date >= today && t.due_date <= addDays(today, 7)).slice(0, 25).map(brief),
  };
}

/**
 * "Brief me" and "Weekly review" under the Today header: a few lines from Nox AI about the day or the
 * week, written from task titles, days and priorities only. Each is cached for the day.
 */
export function BriefCard({ today }: { today: string }) {
  const aiOn = useAiEnabled();
  const { data: tasks = [] } = useTasks();
  const call = useAiCall(AiRepository.brief);
  const [shown, setShown] = useState<{ kind: Kind; text: string } | null>(null);
  const [running, setRunning] = useState<Kind | null>(null);

  if (!aiOn || tasks.length === 0) return null;

  const run = async (kind: Kind) => {
    const key = `${kind}:${today}`;
    const hit = cache.get(key);
    if (hit) {
      setShown({ kind, text: hit });
      return;
    }
    setRunning(kind);
    const res = await call.run(kind, today, dataFor(kind, tasks, today));
    setRunning(null);
    if (res?.text) {
      cache.set(key, res.text);
      setShown({ kind, text: res.text });
    }
  };

  if (shown) {
    const lines = shown.text
      .split("\n")
      .map((l) => l.replace(/^\s*[•\-*]\s*/, "").trim())
      .filter(Boolean);
    return (
      <View className="mt-3">
        <AiPanel title={shown.kind === "daily" ? "Your day" : "Your week"} onClose={() => setShown(null)}>
          {lines.map((l, i) => (
            <View key={i} className="flex-row gap-2 py-0.5">
              <Text className="text-ink-3 text-[14px] leading-[21px]">•</Text>
              <Text className="text-ink-2 flex-1 text-[14px] leading-[21px]">{l}</Text>
            </View>
          ))}
        </AiPanel>
      </View>
    );
  }

  return (
    <View className="mt-3 flex-row flex-wrap items-center gap-2">
      <AiButton label="Brief me" onPress={() => void run("daily")} busy={running === "daily"} disabled={running === "weekly"} />
      <AiButton label="Weekly review" onPress={() => void run("weekly")} busy={running === "weekly"} disabled={running === "daily"} />
      {call.error ? <Text className="text-high flex-1 text-[13px]">{call.error}</Text> : null}
    </View>
  );
}
