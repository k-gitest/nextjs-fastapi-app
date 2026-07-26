"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ImageSummary } from "@/features/images/types";

type LibraryImageGridProps = {
  images: ImageSummary[];
  selectedImageIds: Set<string>;
  attachedImageIds: Set<string>;
  onToggle: (imageId: string) => void;
};

/**
 * ライブラリ画像の選択グリッド（Presentational Component）。
 *
 * LibraryImagePickerの現在タブ（Album詳細 or 未所属）の画像一覧を受け取り、
 * チェックボックス的なトグル選択UIを提供するだけの表示専用コンポーネント。
 *
 * 上限（枚数・合計サイズ）の計算・検証は一切持たない（合意通り、それは
 * useImageList.addExistingImages() の責務）。ここでの役割は選択状態の
 * トグルとattachedImageIdsによる無効化表示のみ。
 *
 * サムネイル全体をクリック領域とするため、shadcn Checkbox（内部的に<button>）は使わず、
 * div要素にrole="checkbox"を付与して実装する
 * （<button>の中に<button>をネストするとHTML的に不正になるため）。
 */
export const LibraryImageGrid = ({
  images,
  selectedImageIds,
  attachedImageIds,
  onToggle,
}: LibraryImageGridProps) => {
  if (images.length === 0) {
    return <p className="text-sm text-muted-foreground">画像がありません</p>;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {images.map((image) => {
        const attached = attachedImageIds.has(image.id);
        const selected = selectedImageIds.has(image.id);
        const previewUrl = `/api/images/${image.id}/view`;

        const handleActivate = () => {
          if (attached) return;
          onToggle(image.id);
        };

        return (
          <div
            key={image.id}
            role="checkbox"
            aria-checked={selected}
            aria-disabled={attached}
            aria-label={
              attached
                ? `${image.originalFileName}は追加済みです`
                : `${image.originalFileName}を選択`
            }
            tabIndex={attached ? -1 : 0}
            onClick={handleActivate}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                handleActivate();
              }
            }}
            className={cn(
              "group relative h-24 w-24 overflow-hidden rounded-md border outline-none",
              attached
                ? "cursor-not-allowed opacity-50"
                : "cursor-pointer focus-visible:ring-2 focus-visible:ring-ring",
              selected && !attached && "ring-2 ring-primary",
            )}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewUrl}
              alt={image.originalFileName}
              className="h-full w-full object-cover"
            />

            <div
              className={cn(
                "absolute left-1 top-1 flex h-5 w-5 items-center justify-center rounded border bg-white/90",
                selected && !attached && "border-primary bg-primary text-primary-foreground",
              )}
            >
              {selected && !attached && <Check className="h-3.5 w-3.5" />}
            </div>

            {attached && (
              <span className="absolute inset-x-0 bottom-0 bg-black/70 py-0.5 text-center text-[10px] text-white">
                追加済み
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
};