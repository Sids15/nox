/** Ready-made spaces: a name, a mark and a pipeline for the board. Everything is editable after. */
export interface SpacePreset {
  key: string;
  label: string;
  icon: string;
  stages: string[];
  hint: string;
}

export const SPACE_PRESETS: SpacePreset[] = [
  { key: "youtube", label: "YouTube channel", icon: "🎬", stages: ["Idea", "Script", "Film", "Edit", "Scheduled", "Published"], hint: "Video ideas through to published" },
  { key: "project", label: "Project", icon: "🚀", stages: ["Backlog", "In progress", "Review", "Done"], hint: "Briefs, PRDs, tasks and links" },
  { key: "docs", label: "Docs & PRDs", icon: "📝", stages: ["Draft", "In review", "Approved", "Shipped"], hint: "Specs moving to sign-off" },
  { key: "blank", label: "Blank", icon: "", stages: [], hint: "No pipeline; add stages later" },
];

/** Space marks to pick from (any emoji works; these are a quick start). */
export const SPACE_EMOJI = ["🎬", "🚀", "📝", "💼", "🎓", "💡", "🎮", "📚", "🏠", "💪", "✈️", "💰"];
