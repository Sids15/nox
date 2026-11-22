import { AiRepository } from "@nox/api";
import { useCreateTask, useIdeas } from "@nox/features";
import type { ContentBlock, Idea } from "@nox/types";
import { useEffect } from "react";
import { Text, View } from "react-native";
import { useAiCall } from "../../lib/use-ai";
import { AiAction, AiBullet, AiButton, AiPanel } from "./ai-ui";
import { docText } from "./doc-assist";

/** "Coach me": the questions and next steps that would move an idea to its next stage. */
export function useIdeaCoach(idea: Idea | undefined) {
  const call = useAiCall(AiRepository.ideaCoach);
  useEffect(() => call.reset(), [idea?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  return call;
}

export function IdeaCoachButton({ coach, idea, blocks }: { coach: ReturnType<typeof useIdeaCoach>; idea: Idea; blocks: ContentBlock[] }) {
  const { data: ideas = [] } = useIdeas();
  return (
    <AiButton
      label="Coach me"
      busy={coach.busy}
      onPress={() =>
        void coach.run(
          { title: idea.title, body: docText(blocks), status: idea.status, priority: idea.priority },
          ideas
            .filter((i) => i.id !== idea.id && !i.deleted && !i.is_archived)
            .slice(0, 40)
            .map((i) => ({ id: i.id, title: i.title.slice(0, 120) })),
        )
      }
    />
  );
}

export function IdeaCoachPanel({
  coach,
  idea,
  onAddToIdea,
  onOpenIdea,
}: {
  coach: ReturnType<typeof useIdeaCoach>;
  idea: Idea;
  /** Append blocks to the idea's document. */
  onAddToIdea: (blocks: ContentBlock[]) => void;
  onOpenIdea?: (id: string) => void;
}) {
  const { data: ideas = [] } = useIdeas();
  const createTask = useCreateTask();
  const r = coach.result;
  if (!r) return null;
  const related = r.related.map((id) => ideas.find((i) => i.id === id)).filter((i): i is Idea => !!i);

  return (
    <AiPanel
      title="Coach"
      onClose={coach.reset}
      footer={
        <>
          {r.questions.length > 0 && (
            <AiAction
              label="Add questions to idea"
              onPress={() => {
                onAddToIdea([
                  { type: "heading", level: 2, text: "Questions to answer" },
                  ...r.questions.map((q): ContentBlock => ({ type: "paragraph", text: `• ${q}` })),
                ]);
                coach.reset();
              }}
            />
          )}
          {r.next_steps.length > 0 && (
            <AiAction
              primary
              label={`Add ${r.next_steps.length} next step${r.next_steps.length === 1 ? "" : "s"} as tasks`}
              onPress={() => {
                for (const step of r.next_steps)
                  createTask.create({
                    title: step.slice(0, 200),
                    notes: `For the idea “${idea.title.slice(0, 120)}”`,
                    due_date: null,
                    due_time: null,
                    reminder_times: [],
                    priority: "medium",
                    repeat: "none",
                    repeat_config: null,
                  });
                coach.reset();
              }}
            />
          )}
        </>
      }
    >
      {r.verdict ? <Text className="text-ink text-[14px] font-medium leading-[21px]">{r.verdict}</Text> : null}
      {r.questions.length > 0 && (
        <View className="mt-2.5">
          <Text className="text-ink-3 mb-0.5 text-[12px] font-semibold">Questions to answer</Text>
          {r.questions.map((q, i) => (
            <AiBullet key={i}>{q}</AiBullet>
          ))}
        </View>
      )}
      {r.next_steps.length > 0 && (
        <View className="mt-2.5">
          <Text className="text-ink-3 mb-0.5 text-[12px] font-semibold">Next steps this week</Text>
          {r.next_steps.map((s, i) => (
            <AiBullet key={i}>{s}</AiBullet>
          ))}
        </View>
      )}
      {related.length > 0 && (
        <View className="mt-2.5">
          <Text className="text-ink-3 mb-0.5 text-[12px] font-semibold">Related ideas</Text>
          {related.map((i) => (
            <Text
              key={i.id}
              onPress={onOpenIdea ? () => onOpenIdea(i.id) : undefined}
              className={`text-[14px] leading-[22px] ${onOpenIdea ? "text-accent font-medium" : "text-ink-2"}`}
            >
              {i.title}
            </Text>
          ))}
        </View>
      )}
    </AiPanel>
  );
}
