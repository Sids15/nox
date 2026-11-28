import type { ContentBlock, Idea, IdeaInput, Note, NoteInput, Resource, ResourceInput, Space, SpaceInput, Task, TaskInput } from "@nox/types";

export interface SpaceCopy {
  space: SpaceInput;
  /** Inputs without `space_id`: it's filled in once the new space is saved. */
  tasks: Omit<TaskInput, "space_id">[];
  notes: Omit<NoteInput, "space_id">[];
  ideas: Omit<IdeaInput, "space_id">[];
  resources: Omit<ResourceInput, "space_id">[];
  /** Pictures, recordings and sketches left out (their files belong to the original). */
  mediaLeftOut: number;
}

/** Text blocks only: a copy pointing at the original's stored files would break when either is deleted. */
function textOnly(blocks: ContentBlock[]): { blocks: ContentBlock[]; dropped: number } {
  const kept = blocks.filter((b) => b.type === "paragraph" || b.type === "heading" || b.type === "link");
  return { blocks: kept.length ? kept : [{ type: "paragraph", text: "" }], dropped: blocks.length - kept.length };
}

const isTemplateTask = (t: Task) => t.repeat !== "none" && t.origin_task_id === null;

/**
 * Everything needed to copy a space as a fresh start ("New video", "Next launch"): its name + " copy",
 * mark, goal and pipeline; every task, open, with its day, time and reminders cleared (repeating tasks
 * keep their rule); its notes, ideas and links as they are, minus stored media.
 */
export function duplicateSpace(
  space: Space,
  all: { tasks: Task[]; notes: Note[]; ideas: Idea[]; resources: Resource[] },
): SpaceCopy {
  let mediaLeftOut = 0;
  const tasks = all.tasks
    // One-off tasks, and the rule of a repeating task (not each of its occurrences).
    .filter((t) => t.space_id === space.id && !t.deleted && (t.repeat === "none" || isTemplateTask(t)))
    .sort((a, b) => a.sort_order - b.sort_order || a.created_at.localeCompare(b.created_at))
    .map(
      (t): Omit<TaskInput, "space_id"> => ({
        title: t.title,
        notes: t.notes,
        due_date: null,
        due_time: null,
        ...(t.duration_minutes ? { duration_minutes: t.duration_minutes } : {}),
        reminder_times: [],
        priority: t.priority,
        repeat: t.repeat,
        repeat_config: t.repeat_config,
      }),
    );
  const notes = all.notes
    .filter((n) => n.space_id === space.id && !n.deleted && !n.is_archived)
    .map((n): Omit<NoteInput, "space_id"> => {
      const { blocks, dropped } = textOnly(n.content);
      mediaLeftOut += dropped;
      return { title: n.title, type: "text", content: blocks, folder_id: n.folder_id, tags: n.tags, properties: n.properties, stage: n.stage };
    });
  const ideas = all.ideas
    .filter((i) => i.space_id === space.id && !i.deleted && !i.is_archived)
    .map((i): Omit<IdeaInput, "space_id"> => {
      const { blocks, dropped } = textOnly(i.content);
      mediaLeftOut += dropped;
      return { title: i.title, description: i.description, content: blocks, priority: i.priority, status: "raw", tags: i.tags, properties: i.properties, stage: i.stage };
    });
  const resources = all.resources
    .filter((r) => r.space_id === space.id && !r.deleted && !r.is_archived && (r.type === "link" || r.type === "video" || r.type === "text"))
    .map(
      (r): Omit<ResourceInput, "space_id"> => ({
        type: r.type,
        url: r.url,
        title: r.title,
        domain: r.domain,
        thumbnail_url: r.thumbnail_url,
        duration: r.duration,
        body: r.body,
        tag_ids: r.tag_ids,
      }),
    );
  mediaLeftOut += all.resources.filter((r) => r.space_id === space.id && !r.deleted && !r.is_archived && r.type === "image").length;

  return {
    space: {
      name: `${space.name} copy`.slice(0, 80),
      icon: space.icon,
      color: space.color,
      description: space.description,
      stages: space.stages,
      archived: false,
      due_date: null,
    },
    tasks,
    notes,
    ideas,
    resources,
    mediaLeftOut,
  };
}
