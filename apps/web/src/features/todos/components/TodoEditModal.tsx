"use client";

import { Priority } from "@repo/db";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import type { TodoFormValues } from "../schemas";
import { TodoForm } from "./TodoForm";
import { ImageGallery } from "@/features/images/components/ImageGallery";
import {
  useImageList,
  type ExistingImageSource,
} from "@/features/images/hooks/useImageList";
import type { ImageListInput } from "@/features/images/schemas";

interface TodoEditModalProps {
  title: string;
  priority: Priority;
  progress: number;
  existingImages?: ExistingImageSource[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: TodoFormValues, images: ImageListInput) => Promise<void>;
  isSubmitting?: boolean;
}

export const TodoEditModal = ({
  title,
  priority,
  progress,
  existingImages = [],
  open,
  onOpenChange,
  onSubmit,
  isSubmitting,
}: TodoEditModalProps) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>タスクを編集</DialogTitle>
        </DialogHeader>
        <DialogDescription className="sr-only">
          タスクの情報を編集してください。
        </DialogDescription>

        <TodoEditModalBody
          key={open ? "dialog-open" : "dialog-closed"}
          title={title}
          priority={priority}
          progress={progress}
          existingImages={existingImages}
          onSubmit={onSubmit}
          onSuccess={() => onOpenChange(false)}
          isSubmitting={isSubmitting}
        />
      </DialogContent>
    </Dialog>
  );
};

type TodoEditModalBodyProps = {
  title: string;
  priority: Priority;
  progress: number;
  existingImages: ExistingImageSource[];
  onSubmit: (values: TodoFormValues, images: ImageListInput) => Promise<void>;
  onSuccess: () => void;
  isSubmitting?: boolean;
};

const TodoEditModalBody = ({
  title,
  priority,
  progress,
  existingImages,
  onSubmit,
  onSuccess,
  isSubmitting,
}: TodoEditModalBodyProps) => {
  const imageList = useImageList(existingImages);

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
        addExistingImages={imageList.addExistingImages}
        removeItem={imageList.removeItem}
        disabled={isSubmitting}
      />

      <TodoForm
        defaultValues={{
          todo_title: title,
          priority: priority,
          progress: progress,
        }}
        onSubmit={handleSubmit}
        isLoading={isSubmitting}
        disabled={isSubmitting || !imageList.canSave}
        submitLabel="変更を保存"
      />
    </>
  );
};