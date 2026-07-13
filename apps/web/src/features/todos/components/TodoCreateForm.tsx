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
import type { CreateImageListInput } from "@/features/images/schemas";

interface TodoCreateFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // 画像（保存後の最終状態のスナップショット）を第2引数として渡す
  onSubmit: (values: TodoFormValues, images: CreateImageListInput) => void | Promise<void>;
  isLoading?: boolean;
  disabled?: boolean;
}

/**
 * Todo作成ダイアログ
 *
 * DialogとTodoFormを統合したコンポーネント
 * - 外部から開閉状態を制御（排他制御のため）
 * - フォーム送信成功後にDialogを閉じる
 * - 画像はTodoFormの外（このDialog層）で useImageList により状態管理する
 */
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

        {/*
          Dialogの開閉（open）に応じてkeyを変えることで、
          閉じる→開くのたびにBodyを丸ごとアンマウント/再マウントする。
          これによりuseImageListの状態（items等）が必ず初期状態から始まることを保証する。
          Dialog/DialogContent自体にはkeyを付けず、Radixのアニメーション・
          フォーカストラップ等の内部状態には影響させない。
        */}
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
  onSubmit: (values: TodoFormValues, images: CreateImageListInput) => void | Promise<void>;
  onSuccess: () => void;
  isLoading?: boolean;
  disabled?: boolean;
};

/**
 * useImageList・ImageGallery・TodoFormをまとめたフォーム本体。
 * TodoCreateFormからkey付きで描画されることで、Dialogの開閉ごとに
 * useImageListの状態を含めてまるごと初期化される
 * （useImageList自体にreset()は持たせず、再マウントによる初期化に統一している）。
 */
const TodoCreateFormBody = ({
  onSubmit,
  onSuccess,
  isLoading,
  disabled,
}: TodoCreateFormBodyProps) => {
  const imageList = useImageList();

  const handleSubmit = async (values: TodoFormValues) => {
    // TodoForm側のisLoading連動によるボタンdisabledでも防いでいるが、
    // 二重防御としてここでも確認する（アップロード中・エラー残存時は送信しない）。
    if (!imageList.canSave) {
      return;
    }
    await onSubmit(values, imageList.toCreateImageListInput());
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
        submitLabel={isLoading ? "作成中..." : "タスクを作成"}
        // NOTE: TodoForm.tsx は現状 disabled と loading（表示文言）を分離しておらず、
        // isLoading=true のときは常に「保存中...」を表示する仕様になっている。
        // そのため isLoading || !imageList.canSave を渡すと、アップロード中・
        // エラー残存時も「保存中...」と表示される（実際にはAPI送信中ではない）。
        // 意味的にはやや不正確だが、今回のPRはTodoForm.tsx自体の改修をスコープ外とし、
        // 既存コンポーネントを変更しない方針を優先した。
        // 将来 disabled と isLoading（表示文言用）を分離する改善余地がある
        // （例: disabled={isLoading || !canSave} / isLoading={isLoading} を別々に渡す）。
        isLoading={isLoading || !imageList.canSave}
      />
    </>
  );
};