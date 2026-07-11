"use client";

import { useState, useCallback } from "react";
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
import { ImageUploader } from "@/features/images/components/ImageUploader";
import type { AttachImageInput, ImageInput } from "@/features/images/schemas";

interface TodoCreateFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // 画像（未添付ならundefined）を第2引数として渡す
  onSubmit: (values: TodoFormValues, image: ImageInput) => void | Promise<void>;
  isLoading?: boolean;
  disabled?: boolean;
}

/**
 * Todo作成ダイアログ
 *
 * DialogとTodoFormを統合したコンポーネント
 * - 外部から開閉状態を制御（排他制御のため）
 * - フォーム送信成功後にDialogを閉じる
 * - 画像はTodoFormの外（このDialog層）でローカル状態として保持する
 */
export const TodoCreateForm = ({
  open,
  onOpenChange,
  onSubmit,
  isLoading,
  disabled,
}: TodoCreateFormProps) => {
  const [image, setImage] = useState<AttachImageInput | null | undefined>(
    undefined,
  );

  const handleSubmit = async (values: TodoFormValues) => {
    try {
      await onSubmit(values, image);
      // 成功時のみリセットして閉じる
      setImage(undefined);
      onOpenChange(false);
    } catch (error) {
      // エラー表示は呼び出し元（Container）に委ねる。Dialogは開いたままにする
      throw error;
    }
  };

  // キャンセル（Dialogを閉じる）でも画像状態をリセットする
  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen) {
        setImage(undefined);
      }
      onOpenChange(nextOpen);
    },
    [onOpenChange],
  );

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
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

        {/*
          Dialogの開閉（open）に応じてkeyを変えることで、
          閉じる→開くのたびにImageUploaderを強制的にアンマウント/再マウントする。
          これによりuseImageUpload内部のアップロード状態（done等）が
          必ず初期状態から始まることを保証する。
          ImageUploader自身はDialogの存在を一切知らない（疎結合を維持するため、
          resetSignal等の専用propは持たせない）。
          reset()はコンポーネント内の「添付取り消し」ボタン専用として別に残っている。
        */}
        <ImageUploader
          key={open ? "dialog-open" : "dialog-closed"}
          value={image}
          onChange={setImage}
          disabled={disabled || isLoading}
        />

        <TodoForm
          onSubmit={handleSubmit}
          submitLabel={isLoading ? "作成中..." : "タスクを作成"}
          isLoading={isLoading}
        />
      </DialogContent>
    </Dialog>
  );
};