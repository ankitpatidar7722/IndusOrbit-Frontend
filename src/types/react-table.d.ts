// Module augmentation for @tanstack/react-table's ColumnMeta.
//
// indas-ui's DataGrid reads these per-column `meta` fields to drive the
// filter row (inputType/filterType), global search (skipSearch), and the
// internal system columns (isActionColumn / isSelectColumn / isExpandColumn).
// react-table ships ColumnMeta as an empty interface; declaring the fields
// here makes `meta: { inputType: "text" }` type-checked instead of `any`.
import "@tanstack/react-table";

declare module "@tanstack/react-table" {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ColumnMeta<TData extends unknown, TValue> {
    /** Input type used by the per-column filter row + inline editing. */
    inputType?: "text" | "email" | "number" | "date" | "select" | "boolean";
    /** Filter comparator used by the advanced/filter-row UI. */
    filterType?: "text" | "number" | "date" | "select" | "boolean";
    /** Cell value type (used by summary/aggregation + rendering). */
    type?: "text" | "number" | "date" | "boolean" | "currency";
    /** Exclude this column from the grid's global search index. */
    skipSearch?: boolean;
    /** Human label for UIs that can't render a non-string `header` (e.g. mobile CardView field label,
     *  advanced-filter column list) — set when `header` is a function/component. */
    title?: string;
    /** Internal marker: this is the actions (view/edit/delete) column. */
    isActionColumn?: boolean;
    /** Internal marker: this is the row-selection checkbox column. */
    isSelectColumn?: boolean;
    /** Internal marker: this is the expand/collapse toggle column. */
    isExpandColumn?: boolean;
    /** Intelligent column sizing hints (createIntelligentColumn / useIntelligentColumnSizing). */
    minWidth?: number;
    maxWidth?: number;
    priority?: "compact" | "comfortable" | "spacious";
  }
}
