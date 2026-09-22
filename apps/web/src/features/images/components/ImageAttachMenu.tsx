"use client";

import { useMemo, useRef, useState } from "react";
import { ImagePlus } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { InputGroupButton } from "@/components/ui/input-group";
import { LibraryImagePicker } from "./LibraryImagePicker";
import { MAX_IMAGES_PER_TODO } from "@/features/images/schemas";
import type {
  AddFilesRejectionReason,
  AddFilesResult,
  ImageItem,
  ImageSummary,
} from "@/features/images/types";

// LibraryImagePicker.tsxのADD_ERROR_MESSAGEと内容は同一だが、
// 呼び出し元（addFilesの検証エラー表示）が別コンポーネントのため個別に持つ。
// 3箇所目の重複が発生した時点で共有モジュールへの切り出しを検討する。
const ADD_FILES_ERROR_MESSAGE: Record<AddFilesRejectionReason, string> = {
  too_many: `添付できる画像は最大${MAX_IMAGES_PER_TODO}枚です`,
  too_large: "画像の合計サイズが上限を超えています",
};

type ImageAttachMenuProps = {
  items: ImageItem[];
  addFiles: (files: File[]) => AddFilesResult;
  addExistingImages: (images: ImageSummary[]) => AddFilesResult;
  disabled?: boolean;
};

/**
 * タイトル欄（InputGroupAddon内）に添える画像追加の入口。アイコンを押すと
 * ドロップダウンが開き、「ファイルを追加」（ローカルファイル選択）と
 * 「ライブラリから追加」（既存Imageの選択ダイアログ）を選べる。
 *
 * トリガーは InputGroupButton（InputGroup配下での配置を前提としたボタン
 * variant）を使う。単体のButtonではなくInputGroupButtonにしているのは、
 * InputGroupAddon内でのサイズ・余白がInputGroup全体のスタイルと揃うようにする
 * ため（input-group.tsx参照）。
 *
 * どちらの選択肢も、選んだ直後にDropdownMenuItemのonSelectで直接
 * input.click() / setLibraryOpen(true) を呼ばず、setTimeoutで1マクロタスク
 * 遅延させてから実行する。DropdownMenuのクローズ処理（フォーカスの返却）と、
 * ネイティブファイル選択ダイアログの表示・LibraryImagePicker（Dialog）の
 * オープン処理（フォーカスの捕捉）が同一フレームで競合するのを避けるため。
 * LibraryImagePicker自体は元々Todo作成/編集ダイアログの中にネストして
 * 問題なく動作していたため、Dialog自体のネストは踏襲している。
 *
 * addFilesの検証エラー（枚数・合計サイズ超過）はこのコンポーネント直下に表示する。
 * addExistingImagesの検証エラーはLibraryImagePicker自身が表示するため、
 * ここでは扱わない。
 */
export const ImageAttachMenu = ({
  items,
  addFiles,
  addExistingImages,
  disabled,
}: ImageAttachMenuProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const attachedImageIds = useMemo(
    () =>
      new Set(items.map((item) => item.imageId).filter((id): id is string => !!id)),
    [items],
  );

  const reachedLimit = items.length >= MAX_IMAGES_PER_TODO;
  const isDisabled = disabled || reachedLimit;

  const handleFilesSelected = (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) {
      return;
    }
    const result = addFiles(Array.from(fileList));
    setError(result.ok ? null : ADD_FILES_ERROR_MESSAGE[result.reason]);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        id="todo-image-upload"
        name="todo-image-upload"
        accept="image/jpeg,image/png,image/gif,image/webp"
        multiple
        className="hidden"
        onChange={(e) => handleFilesSelected(e.target.files)}
      />

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <InputGroupButton
            size="icon-sm"
            disabled={isDisabled}
            aria-label="画像を添付"
          >
            <ImagePlus className="h-4 w-4" />
          </InputGroupButton>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuItem
            onSelect={() => setTimeout(() => fileInputRef.current?.click(), 0)}
          >
            ファイルを追加
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setTimeout(() => setLibraryOpen(true), 0)}>
            ライブラリから追加
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {reachedLimit && (
        <p className="text-sm text-muted-foreground">
          添付できる画像は最大{MAX_IMAGES_PER_TODO}枚です
        </p>
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}

      <LibraryImagePicker
        open={libraryOpen}
        onOpenChange={setLibraryOpen}
        attachedImageIds={attachedImageIds}
        onAdd={addExistingImages}
      />
    </>
  );
};