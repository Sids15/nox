/** Query-key factory for the tasks module. One list per user is scoped by RLS, so a single
 *  top-level key is enough; detail/filtered keys can branch off `all` when the UI needs them. */
export const taskKeys = {
  all: ["tasks"] as const,
};
