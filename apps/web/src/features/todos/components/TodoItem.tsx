import { memo } from "react";
import { Priority } from "@repo/db";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { MoreHorizontal, Pencil, Trash2, Sparkles } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface TodoItemProps {
  id: number | string; // REST: number, Relay: string(GlobalID)
  title: string;
  priority: "HIGH" | "MEDIUM" | "LOW";
  progress: number;
  updatedAt?: Date; // ✅ 検索結果には無い場合があるためオプショナルに
  disabled?: boolean;
  onToggleComplete?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  showActions?: boolean;
  // ✅ 検索用の追加Props
  isSearchMode?: boolean;
  score?: number;
}

// 優先度設定
const PRIORITY_CONFIG: Record<
  Priority,
  {
    variant: "destructive" | "default" | "secondary" | "outline";
    label: string;
  }
> = {
  HIGH: { variant: "destructive", label: "高" },
  MEDIUM: { variant: "default", label: "中" },
  LOW: { variant: "secondary", label: "低" },
};

export const TodoItem = memo(
  ({
    id,
    title,
    priority,
    progress,
    updatedAt,
    disabled = false,
    onToggleComplete,
    onEdit,
    onDelete,
    showActions = true,
    isSearchMode = false,
    score,
  }: TodoItemProps) => {
    const isCompleted = progress === 100;
    const priorityConfig = PRIORITY_CONFIG[priority || "MEDIUM"];

    return (
      <Card
        className={`w-full ${disabled ? "opacity-50 pointer-events-none" : ""}`}
      >
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <div className="flex items-center space-x-2">
            {showActions && onToggleComplete && (
              <Checkbox
                checked={isCompleted}
                onCheckedChange={() => onToggleComplete()}
                id={`todo-${id}`}
                disabled={disabled}
              />
            )}
            <CardTitle
              className={`text-lg ${isCompleted ? "line-through text-gray-500" : ""}`}
            >
              {/* showActionsがなければラベルのhtmlForも不要に */}
              <label htmlFor={showActions ? `todo-${id}` : undefined}>
                {title}
              </label>
            </CardTitle>
            {/* ✅ 検索モード時のみスコアバッジを表示 */}
            {isSearchMode && score !== undefined && (
              <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 gap-1">
                <Sparkles className="w-3 h-3" />
                {Math.round(score * 100)}% Match
              </Badge>
            )}
          </div>
          {/* ✅ アクション表示時のみメニュー（編集・削除）を出す */}
          {showActions && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="h-8 w-8 p-0">
                  <span className="sr-only">Open menu</span>
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onEdit?.()}>
                  <Pencil className="mr-2 h-4 w-4" />
                  編集
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => onDelete?.()}
                  className="text-red-600 focus:text-red-600"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  削除
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </CardHeader>
        <CardContent className="space-y-2">
          <Badge variant={priorityConfig.variant}>{priorityConfig.label}</Badge>
          <Progress value={progress} className="h-2" />
        </CardContent>
        <CardFooter className="flex justify-between text-sm text-gray-500">
          <span>進捗: {progress}%</span>
          <span suppressHydrationWarning>
            更新:{" "}
            {updatedAt
              ? new Date(updatedAt).toLocaleDateString("ja-JP")
              : "---"}
          </span>
        </CardFooter>
      </Card>
    );
  },
);

// React DevToolsでの表示名
TodoItem.displayName = "TodoItem";
