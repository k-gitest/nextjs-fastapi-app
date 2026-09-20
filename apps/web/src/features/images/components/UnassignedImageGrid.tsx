"use client";

import { useMemo, useState } from "react";
import { ImageIcon, Trash2, GripVertical, MoreVertical } from "lucide-react";
import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import type { ImageSummary } from "@/features/images/types";
import type { Album } from "@/features/albums/types";

type UnassignedImageGridProps = {
  images: ImageSummary[];
  albums: Album[];
  onDelete: (imageId: string, onSuccess: () => void) => void;
  onUpdateAlbum: (imageId: string, albumId: string) => void;
  deleting?: boolean;
  assigning?: boolean;
};

/**
 * 未所属画像（albumId = null）一覧グリッド（Presentational Component）。
 *
 * 削除・Album移動に加え、各画像をドラッグしてAlbumへドロップすることでも
 * Album所属を変更できる。DndContextはAlbumPanelが提供する。
 *
 * 画像下の常時表示は廃止し、右上のドロップダウンメニュー（移動／削除）に
 * 統合した。「移動」はDropdownMenuSubで展開し、内部の検索は素の<input>と
 * .filter()による自前実装とする（AlbumImageGrid参照。Select・Commandいずれも
 * DropdownMenuへのネストでdismiss判定と衝突する不具合が出たため採用しない）。
 * 削除操作は誤操作防止・ホバー非対応環境への配慮から、左上の単独アイコンと
 * メニュー項目の両方から実行できる。
 */
export const UnassignedImageGrid = ({
  images,
  albums,
  onDelete,
  onUpdateAlbum,
  deleting,
  assigning,
}: UnassignedImageGridProps) => {
  const [confirmTarget, setConfirmTarget] = useState<ImageSummary | null>(null);

  if (images.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">未所属の画像はありません</p>
    );
  }

  const handleConfirmDelete = () => {
    if (!confirmTarget) return;
    onDelete(confirmTarget.id, () => setConfirmTarget(null));
  };

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {images.map((image) => (
          <DraggableUnassignedImageCard
            key={image.id}
            image={image}
            albums={albums}
            onDeleteClick={() => setConfirmTarget(image)}
            onUpdateAlbum={onUpdateAlbum}
            deleting={deleting}
            assigning={assigning}
          />
        ))}
      </div>

      <AlertDialog
        open={confirmTarget !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <ImageIcon className="h-4 w-4" />
              画像を削除しますか？
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmTarget && confirmTarget.usageCount > 0 ? (
                <>
                  この画像は{confirmTarget.usageCount}
                  件のTodoで使用されています。削除すると、これらのTodoからも画像の添付が削除されます。この操作は取り消せません。
                </>
              ) : (
                <>この画像を削除します。この操作は取り消せません。</>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <Button
              variant="destructive"
              onClick={handleConfirmDelete}
              disabled={deleting}
            >
              削除する
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

type DraggableUnassignedImageCardProps = {
  image: ImageSummary;
  albums: Album[];
  onDeleteClick: () => void;
  onUpdateAlbum: (imageId: string, albumId: string) => void;
  deleting?: boolean;
  assigning?: boolean;
};

const DraggableUnassignedImageCard = ({
  image,
  albums,
  onDeleteClick,
  onUpdateAlbum,
  deleting,
  assigning,
}: DraggableUnassignedImageCardProps) => {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: `image-${image.id}`,
      data: { type: "unassigned-image", imageId: image.id },
      disabled: deleting || assigning,
    });

  const [menuOpen, setMenuOpen] = useState(false);
  const [moveQuery, setMoveQuery] = useState("");

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.4 : 1,
  };

  const previewUrl = `/api/images/${image.id}/view`;
  const hasAlbums = albums.length > 0;

  const filteredAlbums = useMemo(() => {
    const q = moveQuery.trim();
    if (!q) return albums;
    return albums.filter((album) => album.name.includes(q));
  }, [moveQuery, albums]);

  const handleMenuOpenChange = (open: boolean) => {
    setMenuOpen(open);
    if (!open) setMoveQuery("");
  };

  const handleMove = (albumId: string) => {
    onUpdateAlbum(image.id, albumId);
    setMenuOpen(false);
  };

  return (
    <div ref={setNodeRef} style={style} className="w-24 space-y-1">
      <div className="group relative h-24 w-24 overflow-hidden rounded-md border">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={previewUrl}
          alt={image.originalFileName}
          className="h-full w-full object-cover"
        />

        {image.usageCount > 0 && (
          <span className="absolute bottom-1 right-1 rounded bg-black/70 px-1.5 py-0.5 text-xs text-white">
            {image.usageCount}件で使用中
          </span>
        )}

        <button
          {...attributes}
          {...listeners}
          type="button"
          aria-label={`${image.originalFileName}をドラッグしてアルバムへ移動`}
          className="absolute bottom-1 left-1 flex h-6 w-6 cursor-grab items-center justify-center rounded bg-black/70 opacity-0 transition-opacity hover:bg-black/80 group-hover:opacity-100 active:cursor-grabbing"
        >
          <GripVertical className="h-3.5 w-3.5 text-white" />
        </button>

        <Button
          variant="ghost"
          size="icon"
          onClick={onDeleteClick}
          disabled={deleting}
          aria-label={`${image.originalFileName}を削除`}
          className="absolute left-1 top-1 h-6 w-6 bg-black/70 opacity-0 transition-opacity hover:bg-black/80 group-hover:opacity-100"
        >
          <Trash2 className="h-3.5 w-3.5 text-white" />
        </Button>

        <DropdownMenu open={menuOpen} onOpenChange={handleMenuOpenChange}>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              disabled={assigning}
              aria-label={`${image.originalFileName}の操作メニュー`}
              className="absolute right-1 top-1 h-6 w-6 bg-black/70 opacity-0 transition-opacity hover:bg-black/80 group-hover:opacity-100 data-[state=open]:opacity-100"
            >
              <MoreVertical className="h-3.5 w-3.5 text-white" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-max">
            <DropdownMenuSub>
              <DropdownMenuSubTrigger
                disabled={!hasAlbums}
                className="whitespace-nowrap"
              >
                アルバムへ移動
              </DropdownMenuSubTrigger>

              <DropdownMenuSubContent sideOffset={6} className="w-48 p-1">
                <input
                  type="text"
                  value={moveQuery}
                  onChange={(event) => setMoveQuery(event.target.value)}
                  onKeyDown={(event) => event.stopPropagation()}
                  placeholder="アルバムを検索..."
                  className="mb-1 h-8 w-full rounded-md border bg-transparent px-2 text-xs outline-none focus:ring-1 focus:ring-ring"
                />
                <div className="max-h-48 overflow-y-auto">
                  {filteredAlbums.map((album) => (
                    <DropdownMenuItem
                      key={album.id}
                      onSelect={() => handleMove(album.id)}
                      className="text-xs"
                    >
                      {album.name}
                    </DropdownMenuItem>
                  ))}
                  {filteredAlbums.length === 0 && (
                    <p className="px-2 py-1.5 text-xs text-muted-foreground">
                      見つかりません
                    </p>
                  )}
                </div>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
            <DropdownMenuItem
              onSelect={() => {
                setMenuOpen(false);
                onDeleteClick();
              }}
            >
              削除
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
};