export { useSessionStore, type AuthStatus } from "./auth/session-store";
export { useAuth, useAuthBootstrap } from "./auth/use-auth";
export {
  useTasks,
  useGroupedTasks,
  useCreateTask,
  useToggleTask,
  useUpdateTask,
  useDeleteTask,
  useDeleteTaskSeries,
  useEnsureOccurrences,
  useRunCarryover,
  useSkippedOccurrences,
} from "./tasks/use-tasks";
export { groupTasks, type GroupedTasks } from "./tasks/group-tasks";
export { nextOccurrenceDate, occursOn, shiftReminders, templatesNeedingOccurrence } from "./tasks/recurrence";
export { carryoverTaskIds } from "./tasks/carryover";
export { autoSchedule, checkPlan, findFreeSlot, minutesToTime, tasksOnDay, timeToMinutes, type PlacedTask, type PlannedTask, type SlotOptions } from "./tasks/day-plan";
export { parseQuickAdd, type QuickAddField, type QuickAddResult } from "./tasks/parse-quick-add";
export { taskKeys } from "./tasks/task-keys";
export { belongsInInbox, inboxItems, withInboxExit, type InboxItem, type InboxSource } from "./inbox/inbox";
export { DEFAULT_CALENDAR, usePrefs, type CalendarPrefs, type HeadingFont, type NotifKey } from "./prefs/prefs-store";
export { useThemeColors, useThemeVars } from "./prefs/use-theme-colors";
export {
  useIdeas,
  useCreateIdea,
  useUpdateIdea,
  useSetIdeaStatus,
  useArchiveIdea,
  useDeleteIdea,
} from "./ideas/use-ideas";
export { ideaKeys } from "./ideas/idea-keys";
export {
  useNotes,
  useCreateNote,
  useUpdateNote,
  useSetNotePinned,
  useArchiveNote,
  useDeleteNote,
} from "./notes/use-notes";
export {
  useFolders,
  useCreateFolder,
  useRenameFolder,
  useDeleteFolder,
} from "./notes/use-folders";
export { noteKeys, folderKeys } from "./notes/note-keys";
export {
  useResources,
  useCreateResource,
  useUpdateResource,
  useArchiveResource,
  useDeleteResource,
} from "./resources/use-resources";
export { useTags, useCreateTag, useDeleteTag, useUpdateTag } from "./resources/use-tags";
export { resourceKeys, tagKeys } from "./resources/resource-keys";
export { useRealtimeSync } from "./sync/use-realtime-sync";
export { registerMutationDefaults } from "./sync/mutation-registry";
export { useSyncStatus } from "./sync/use-sync-status";
export {
  spaceKeys,
  templateKeys,
  useSpaces,
  useCreateSpace,
  useUpdateSpace,
  useDeleteSpace,
  useTemplates,
  useCreateTemplate,
  useDeleteTemplate,
} from "./spaces/use-spaces";
export {
  backlinks,
  matchTargets,
  openLinkQuery,
  openSlashQuery,
  withoutSlashQuery,
  outgoingRefs,
  parseRef,
  refBlock,
  refKindLabel,
  refKinds,
  refUrl,
  withoutLinkQuery,
  type LinkTarget,
  type LinkingPage,
  type Ref,
  type RefKind,
} from "./links/refs";
export {
  DEFAULT_WIDGET,
  WIDGET_SECTION_LABEL,
  buildWidgetSnapshot,
  normalizeWidgetConfig,
  widgetSectionKeys,
  type WidgetConfig,
  type WidgetSection,
  type WidgetSectionKey,
  type WidgetSnapshot,
  type WidgetTaskRow,
} from "./widget/widget";
