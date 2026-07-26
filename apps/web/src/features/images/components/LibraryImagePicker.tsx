"use client";

import { useCallback, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ComponentAsyncBoundary } from "@/components/async-boundary";
import { useAlbums } from "@/features/albums/hooks/useAlbums";
import { useAlbumDetail } from "@/features/albums/hooks/useAlbumDetail";
import { useUnassignedImages } from "@/features/images/hooks/useUnassignedImages";
import { LibraryImageGrid } from "./LibraryImageGrid";
import { MAX_IMAGES_PER_TODO } from "@/features/images/schemas";
import type {
  AddFilesRejectionReason,
  AddFilesResult,
  ImageSummary,
} from "@/features/images/types";

// ImageGallery.tsxのADD_FILES_ERROR_MESSAGEと内容は同一だが、
// 呼び出し元（Picker内の「追加」確定）が別コンポーネントのため個別に持つ。
// 3箇所目の重複が発生した時点で共有モジュールへの切り出しを検討する。
const ADD_ERROR_MESSAGE: Record<AddFilesRejectionReason, string> = {
  too_many: `添付できる画像は最大${MAX_IMAGES_PER_TODO}枚です`,
  too_large: "画像の合計サイズが上限を超えています",
};

const UNASSIGNED_TAB = "unassigned" as const;
type ActiveTab = typeof UNASSIGNED_TAB | string; // string = albumId

type LibraryImagePickerProps = {
  attachedImageIds: Set<string>;
  onAdd: (images: ImageSummary[]) => AddFilesResult;
  disabled?: boolean;
};

/**
 * Library（既存Image）からTodoへ画像を追加するためのPicker。
 *
 * 責務: Album/未所属タブの表示・画像の選択状態管理・「追加」確定操作のみ。
 * 選択されたImageをTodoImageとして紐付ける実処理（枚数・合計サイズ検証、
 * ImageItem生成）はuseImageList.addExistingImages()（onAddとして注入される）
 * に完全に委譲する。ここではDB/Prismaは一切扱わない
 * （UI → hook → serviceの層を越境しない）。
 *
 * データ取得は既存のuseAlbums/useAlbumDetail/useUnassignedImagesをそのまま再利用する
 * （新規APIエンドポイントは追加しない）。
 *
 * TodoCreateForm/TodoEditModalのkey付き再マウントパターンに倣い、Dialogが開くたびに
 * LibraryImagePickerBodyを再生成することで選択状態を初期化する
 * （Body自体にreset()は持たせない）。
 */
export const LibraryImagePicker = ({
  attachedImageIds,
  onAdd,
  disabled,
}: LibraryImagePickerProps) => {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm" disabled={disabled}>
          ライブラリから選択
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>ライブラリから画像を選択</DialogTitle>
        </DialogHeader>
        <DialogDescription className="sr-only">
          既存の画像をアルバムまたは未所属から選択してTodoに追加します。
        </DialogDescription>

        <LibraryImagePickerBody
          key={open ? "picker-open" : "picker-closed"}
          attachedImageIds={attachedImageIds}
          onAdd={onAdd}
          onClose={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  );
};

type LibraryImagePickerBodyProps = {
  attachedImageIds: Set<string>;
  onAdd: (images: ImageSummary[]) => AddFilesResult;
  onClose: () => void;
};

const LibraryImagePickerBody = ({
  attachedImageIds,
  onAdd,
  onClose,
}: LibraryImagePickerBodyProps) => {
  const [activeTab, setActiveTab] = useState<ActiveTab>(UNASSIGNED_TAB);
  // タブを跨いで選択を保持するため、idだけでなくImageSummary本体をMapで保持する
  // （確定時にonAddへ渡すImageSummary[]を、選択元タブによらず組み立てるため）。
  const [selectedImages, setSelectedImages] = useState<Map<string, ImageSummary>>(new Map());
  const [error, setError] = useState<string | null>(null);

  const selectedImageIds = useMemo(
    () => new Set(selectedImages.keys()),
    [selectedImages],
  );

  const toggleSelection = useCallback((image: ImageSummary) => {
    setError(null);
    setSelectedImages((prev) => {
      const next = new Map(prev);
      if (next.has(image.id)) {
        next.delete(image.id);
      } else {
        next.set(image.id, image);
      }
      return next;
    });
  }, []);

  const handleAdd = () => {
    const images = Array.from(selectedImages.values());
    const result = onAdd(images);
    if (result.ok) {
      onClose();
      return;
    }
    setError(ADD_ERROR_MESSAGE[result.reason]);
  };

  return (
    <div className="space-y-3">
      <ComponentAsyncBoundary componentName="LibraryImagePickerTabs">
        <LibraryImagePickerTabBar activeTab={activeTab} onSelectTab={setActiveTab} />
      </ComponentAsyncBoundary>

      <ComponentAsyncBoundary componentName="LibraryImagePickerContent">
        <LibraryImagePickerTabContent
          activeTab={activeTab}
          selectedImageIds={selectedImageIds}
          attachedImageIds={attachedImageIds}
          onToggle={toggleSelection}
        />
      </ComponentAsyncBoundary>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <DialogFooter>
        <Button type="button" variant="ghost" onClick={onClose}>
          キャンセル
        </Button>
        <Button type="button" onClick={handleAdd} disabled={selectedImages.size === 0}>
          追加{selectedImages.size > 0 ? `（${selectedImages.size}件）` : ""}
        </Button>
      </DialogFooter>
    </div>
  );
};

type TabBarProps = {
  activeTab: ActiveTab;
  onSelectTab: (tab: ActiveTab) => void;
};

// Album一覧取得（useAlbums）はSuspenseクエリのため、タブバー自体をBody側で
// ComponentAsyncBoundaryに包む必要がある（タブ内容の読み込みとは別のSuspense境界）。
const LibraryImagePickerTabBar = ({ activeTab, onSelectTab }: TabBarProps) => {
  const { albums } = useAlbums();

  const tabClass = (isActive: boolean) =>
    cn(
      "shrink-0 rounded-full border px-3 py-1 text-sm",
      isActive
        ? "border-primary bg-primary text-primary-foreground"
        : "border-input bg-background hover:bg-muted",
    );

  return (
    <div className="flex flex-wrap gap-1 border-b pb-2">
      <button
        type="button"
        onClick={() => onSelectTab(UNASSIGNED_TAB)}
        className={tabClass(activeTab === UNASSIGNED_TAB)}
      >
        未所属
      </button>
      {albums.map((album) => (
        <button
          key={album.id}
          type="button"
          onClick={() => onSelectTab(album.id)}
          className={tabClass(activeTab === album.id)}
        >
          {album.name}
        </button>
      ))}
    </div>
  );
};

type TabContentProps = {
  activeTab: ActiveTab;
  selectedImageIds: Set<string>;
  attachedImageIds: Set<string>;
  onToggle: (image: ImageSummary) => void;
};

const LibraryImagePickerTabContent = ({
  activeTab,
  selectedImageIds,
  attachedImageIds,
  onToggle,
}: TabContentProps) => {
  if (activeTab === UNASSIGNED_TAB) {
    return (
      <LibraryUnassignedTab
        selectedImageIds={selectedImageIds}
        attachedImageIds={attachedImageIds}
        onToggle={onToggle}
      />
    );
  }
  return (
    <LibraryAlbumTab
      albumId={activeTab}
      selectedImageIds={selectedImageIds}
      attachedImageIds={attachedImageIds}
      onToggle={onToggle}
    />
  );
};

type TabPanelProps = {
  selectedImageIds: Set<string>;
  attachedImageIds: Set<string>;
  onToggle: (image: ImageSummary) => void;
};

const LibraryUnassignedTab = ({
  selectedImageIds,
  attachedImageIds,
  onToggle,
}: TabPanelProps) => {
  const { images } = useUnassignedImages();
  return (
    <LibraryImageGrid
      images={images}
      selectedImageIds={selectedImageIds}
      attachedImageIds={attachedImageIds}
      onToggle={(imageId) => {
        const image = images.find((i) => i.id === imageId);
        if (image) onToggle(image);
      }}
    />
  );
};

const LibraryAlbumTab = ({
  albumId,
  selectedImageIds,
  attachedImageIds,
  onToggle,
}: TabPanelProps & { albumId: string }) => {
  const { album } = useAlbumDetail(albumId);
  return (
    <LibraryImageGrid
      images={album.images}
      selectedImageIds={selectedImageIds}
      attachedImageIds={attachedImageIds}
      onToggle={(imageId) => {
        const image = album.images.find((i) => i.id === imageId);
        if (image) onToggle(image);
      }}
    />
  );
};