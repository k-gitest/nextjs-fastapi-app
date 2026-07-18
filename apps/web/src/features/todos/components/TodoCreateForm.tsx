"use client";

import { useState } from "react";
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
import { AlbumSelector } from "@/features/albums/components/AlbumSelector";
import { useAlbums } from "@/features/albums/hooks/useAlbums";

interface TodoCreateFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // 画像（保存後の最終状態のスナップショット）とalbumId（Todo単位で選択したAlbum。
  // null=未所属のまま保存）を第2・第3引数として渡す
  onSubmit: (
    values: TodoFormValues,
    images: CreateImageListInput,
    albumId: string | null,
  ) => void | Promise<void>;
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
 * - Album選択もTodoFormの外（このDialog層）で管理する
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
          これによりuseImageListの状態（items等）・Album選択状態が
          必ず初期状態から始まることを保証する。
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
  onSubmit: (
    values: TodoFormValues,
    images: CreateImageListInput,
    albumId: string | null,
  ) => void | Promise<void>;
  onSuccess: () => void;
  isLoading?: boolean;
  disabled?: boolean;
};

/**
 * useImageList・ImageGallery・AlbumSelector・TodoFormをまとめたフォーム本体。
 * TodoCreateFormからkey付きで描画されることで、Dialogの開閉ごとに
 * useImageListの状態・Album選択状態を含めてまるごと初期化される
 * （useImageList自体にreset()は持たせず、再マウントによる初期化に統一している）。
 *
 * useAlbums()はAlbumPanel（TodoIndex内に常設）が既にページ表示時にfetch済みのため、
 * ここではTanStack Queryのキャッシュから即座に解決される想定
 * （Dialogを開くたびに新規にSuspenseで待たされることはない）。
 */
const TodoCreateFormBody = ({
  onSubmit,
  onSuccess,
  isLoading,
  disabled,
}: TodoCreateFormBodyProps) => {
  const imageList = useImageList();
  const { albums } = useAlbums();
  // albumOverride: ユーザーが明示的にAlbumSelectorを操作した場合のみ値が入る。
  // undefined = まだ触れていない（albums到着前の初期表示を含む）。
  //
  // albumsは後から非同期に反映されうる（例: Dialogを開いた直後はまだfetch中、
  // または別操作でAlbumPanel側のinvalidateQueriesが走った直後）ため、
  // 「albums[0]をデフォルト選択にする」という値はuseStateで一度だけ確定させず、
  // レンダーのたびにalbumsから導出する（＝useEffectでの同期は不要な派生値）。
  // ユーザーが一度でも操作すればalbumOverrideが優先され、以降albumsが変化しても
  // 上書きされない。
  const [albumOverride, setAlbumOverride] = useState<string | null | undefined>(undefined);
  const albumId = albumOverride !== undefined ? albumOverride : (albums[0]?.id ?? null);

  const handleSubmit = async (values: TodoFormValues) => {
    // TodoForm側のisLoading連動によるボタンdisabledでも防いでいるが、
    // 二重防御としてここでも確認する（アップロード中・エラー残存時は送信しない）。
    if (!imageList.canSave) {
      return;
    }
    await onSubmit(values, imageList.toCreateImageListInput(), albumId);
    onSuccess();
  };

  return (
    <>
      <AlbumSelector
        albums={albums}
        value={albumId}
        onChange={setAlbumOverride}
        disabled={disabled || isLoading}
      />

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