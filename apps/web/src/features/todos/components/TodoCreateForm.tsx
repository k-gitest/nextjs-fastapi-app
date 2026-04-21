import * as VisuallyHidden from "@radix-ui/react-visually-hidden";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { TodoForm } from "./TodoForm";
import type { TodoFormValues } from "../schemas";

interface TodoCreateFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: TodoFormValues) => void | Promise<void>;
  isLoading?: boolean;
  disabled?: boolean;
}

/**
 * Todo作成ダイアログ
 *
 * DialogとTodoFormを統合したコンポーネント
 * - 外部から開閉状態を制御（排他制御のため）
 * - フォーム送信後にDialogを閉じる
 */
export const TodoCreateForm = ({
  open,
  onOpenChange,
  onSubmit,
  isLoading,
  disabled,
}: TodoCreateFormProps) => {
  const handleSubmit = async (values: TodoFormValues) => {
    await onSubmit(values);
    onOpenChange(false); // フォーム送信成功後にDialogを閉じる
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button disabled={disabled}>
          <Plus className="mr-2 h-4 w-4" /> 新規タスク追加
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>新しいタスクを作成</DialogTitle>
        </DialogHeader>
        <VisuallyHidden.Root>
          <DialogDescription>
            新しいタスクの情報を入力してください。
          </DialogDescription>
        </VisuallyHidden.Root>
        <TodoForm
          onSubmit={handleSubmit}
          submitLabel={isLoading ? "作成中..." : "タスクを作成"}
          isLoading={isLoading}
        />
      </DialogContent>
    </Dialog>
  );
};
