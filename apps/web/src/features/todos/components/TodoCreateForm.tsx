"use client";

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
import { ImageGallery } from "@/features/images/components/ImageGallery";
import { useImageList } from "@/features/images/hooks/useImageList";
import type { ImageListInput } from "@/features/images/schemas";

interface TodoCreateFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // 画像（保存後の最終状態のスナップショット。imageIdの配列）を第2引数として渡す
  onSubmit: (values: TodoFormValues, images: ImageListInput) => void | Promise<void>;
  isLoading?: boolean;
  disabled?: boolean;
}

export const TodoCreateForm = ({
  open,
  onOpenChange,
  onSubmit,
  isLoading,
  disabled,
}: TodoCreateFormProps) => {
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
        <DialogDescription className="sr-only">
          新しいタスクの情報を入力してください。
        </DialogDescription>

        <TodoCreateFormBody
          key={open ? "dialog-open" : "dialog-closed"}
          onSubmit={onSubmit}
          onSuccess={() => onOpenChange(false)}
          isLoading={isLoading}
          disabled={disabled}
        />
      </DialogContent>
    </Dialog>
  );
};

type TodoCreateFormBodyProps = {
  onSubmit: (values: TodoFormValues, images: ImageListInput) => void | Promise<void>;
  onSuccess: () => void;
  isLoading?: boolean;
  disabled?: boolean;
};

const TodoCreateFormBody = ({
  onSubmit,
  onSuccess,
  isLoading,
  disabled,
}: TodoCreateFormBodyProps) => {
  const imageList = useImageList();

  const handleSubmit = async (values: TodoFormValues) => {
    if (!imageList.canSave) {
      return;
    }
    await onSubmit(values, imageList.toImageIds());
    onSuccess();
  };

  return (
    <>
      <ImageGallery
        items={imageList.items}
        addFiles={imageList.addFiles}
        removeItem={imageList.removeItem}
        disabled={disabled || isLoading}
      />

      <TodoForm
        onSubmit={handleSubmit}
        submitLabel="タスクを作成"
        isLoading={isLoading}
        disabled={disabled || isLoading || !imageList.canSave}
      />
    </>
  );
};