"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import type { TodoListFilters, TodoSortOrder } from "../types";
import { Priority } from "@repo/db";

interface TodoSortFilterControlsProps {
  filters: TodoListFilters;
  onChange: (filters: TodoListFilters) => void;
  // startTransition中かどうか。trueの間はUI全体を薄く表示し、
  // バックグラウンドでの再取得中であることを示す。
  isPending?: boolean;
}

const PRIORITY_ALL = "ALL" as const;

const isTodoSortOrder = (value: string): value is TodoSortOrder =>
  value === "asc" || value === "desc";

const isPriority = (value: string): value is Priority =>
  value === "HIGH" || value === "MEDIUM" || value === "LOW";

export const TodoSortFilterControls = ({
  filters,
  onChange,
  isPending = false,
}: TodoSortFilterControlsProps) => {
  const handleSortOrderChange = (value: string) => {
    if (!isTodoSortOrder(value)) return;
    onChange({ ...filters, sortOrder: value });
  };

  const handlePriorityChange = (value: string) => {
    onChange({
      ...filters,
      priority: value === PRIORITY_ALL ? undefined : isPriority(value) ? value : undefined,
    });
  };

  return (
    <div
      className={`flex flex-wrap items-center gap-4 transition-opacity ${isPending ? "opacity-60" : ""}`}
    >
      <div className="flex items-center gap-2">
        <Label htmlFor="todo-sort-order" className="text-sm text-muted-foreground">
          並び順
        </Label>
        <Select value={filters.sortOrder} onValueChange={handleSortOrderChange}>
          <SelectTrigger id="todo-sort-order" className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="desc">新しい順</SelectItem>
            <SelectItem value="asc">古い順</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center gap-2">
        <Label htmlFor="todo-priority-filter" className="text-sm text-muted-foreground">
          優先度
        </Label>
        <Select value={filters.priority ?? PRIORITY_ALL} onValueChange={handlePriorityChange}>
          <SelectTrigger id="todo-priority-filter" className="w-28">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={PRIORITY_ALL}>すべて</SelectItem>
            <SelectItem value="HIGH">高</SelectItem>
            <SelectItem value="MEDIUM">中</SelectItem>
            <SelectItem value="LOW">低</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center gap-2">
        <Checkbox
          id="todo-completed-only"
          checked={filters.completedOnly}
          onCheckedChange={(checked) => onChange({ ...filters, completedOnly: checked === true })}
        />
        <Label htmlFor="todo-completed-only" className="text-sm text-muted-foreground">
          完了のみ表示
        </Label>
      </div>
    </div>
  );
};