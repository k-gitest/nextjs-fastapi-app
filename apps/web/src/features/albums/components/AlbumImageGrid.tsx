"use client";

import { useMemo, useState } from "react";
import { ImageIcon, Trash2, GripVertical, MoreVertical } from "lucide-react";
import {
  SortableContext,
  rectSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
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
import type { AlbumImageItem, Album } from "@/features/albums/types";

type AlbumImageGridProps = {
  albumId: string;
  images: AlbumImageItem[];
  otherAlbums: Album[];
  onDelete: (imageId: string, onSuccess: () => void) => void;
  onMove: (imageId: string, albumId: string | null) => void;
  deleting?: boolean;
  moving?: boolean;
};

/**
 * Album詳細画面用の画像一覧グリッド(Presentational Component)。
 *
 * DndContext・sensors・並び替えロジック(旧handleDragEnd)は持たない
 *
 * DnDの当たり判定は同一Album内の画像同士だけでなく、他Albumとの間でも
 * 成立する必要があるため、DndContextはAlbumPanelが一元的に持つ。
 *
 * 画像下の常時表示は廃止し、右上のドロップダウンメニュー（移動／削除）に
 * 統合した。「移動」はDropdownMenuSubで展開し、内部の検索は素の<input>と
 * .filter()による自前実装とする。SelectやCommand（cmdk）のような、独自の
 * フォーカス管理・ポータルを持つコンポーネントをDropdownMenuの内側にネスト
 * すると、親メニューのdismiss判定と衝突してクリック・入力の瞬間にメニュー
 * ごと閉じる不具合が繰り返し発生したため、DropdownMenuItemのみで完結させる
 * 方針に倒している。削除操作は誤操作防止・ホバー非対応環境への配慮から、
 * 左上の単独アイコンとメニュー項目の両方から実行できる。
 */
export const AlbumImageGrid = ({
  albumId,
  images,
  otherAlbums,
  onDelete,
  onMove,
  deleting,
  moving,
}: AlbumImageGridProps) => {
  const [confirmTarget, setConfirmTarget] = useState<AlbumImageItem | null>(
    null,
  );

  if (images.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        このアルバムにはまだ画像がありません
      </p>
    );
  }

  const handleConfirmDelete = () => {
    if (!confirmTarget) return;
    onDelete(confirmTarget.id, () => setConfirmTarget(null));
  };

  return (
    <>
      <SortableContext
        items={images.map((img) => img.id)}
        strategy={rectSortingStrategy}
      >
        <div className="flex flex-wrap gap-2">
          {images.map((image) => (
            <SortableImageCard
              key={image.id}
              image={image}
              albumId={albumId}
              onDeleteClick={() => setConfirmTarget(image)}
              onMove={onMove}
              otherAlbums={otherAlbums}
              deleting={deleting}
              moving={moving}
            />
          ))}
        </div>
      </SortableContext>

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

type SortableImageCardProps = {
  image: AlbumImageItem;
  albumId: string;
  onDeleteClick: () => void;
  onMove: (imageId: string, albumId: string | null) => void;
  otherAlbums: Album[];
  deleting?: boolean;
  moving?: boolean;
};

const SortableImageCard = ({
  image,
  albumId,
  onDeleteClick,
  onMove,
  otherAlbums,
  deleting,
  moving,
}: SortableImageCardProps) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: image.id,
    data: {
      type: "album-image",
      imageId: image.id,
      sourceAlbumId: albumId,
    },
  });

  const [menuOpen, setMenuOpen] = useState(false);
  const [moveQuery, setMoveQuery] = useState("");

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const previewUrl = `/api/images/${image.id}/view`;

  const filteredAlbums = useMemo(() => {
    const q = moveQuery.trim();
    if (!q) return otherAlbums;
    return otherAlbums.filter((album) => album.name.includes(q));
  }, [moveQuery, otherAlbums]);

  const handleMenuOpenChange = (open: boolean) => {
    setMenuOpen(open);
    if (!open) setMoveQuery("");
  };

  const handleMove = (albumId: string | null) => {
    onMove(image.id, albumId);
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
          aria-label={`${image.originalFileName}を並び替え`}
          className="absolute bottom-1 left-1 flex h-6 w-6 cursor-grab items-center justify-center rounded bg-black/70 opacity-0 transition-opacity hover:bg-black/80 group-hover:opacity-100 active:cursor-grabbing"
        >
          <GripVertical className="h-3.5 w-3.5 text-white" />
        </button>

        {/*
          削除は左上の単独アイコンからも実行できる。ホバーでしか見えないUIに削除操作だけを閉じ込めると、
          ホバー操作に頼れない環境（タッチデバイス等）で発見しづらくなるため、
          右上メニュー内の「削除」項目と併存させている。
        */}
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
              disabled={moving}
              aria-label={`${image.originalFileName}の操作メニュー`}
              className="absolute right-1 top-1 h-6 w-6 bg-black/70 opacity-0 transition-opacity hover:bg-black/80 group-hover:opacity-100 data-[state=open]:opacity-100"
            >
              <MoreVertical className="h-3.5 w-3.5 text-white" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-max">
            <DropdownMenuSub>
              <DropdownMenuSubTrigger className="whitespace-nowrap">
                他のアルバムへ移動
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
                  <DropdownMenuItem
                    onSelect={() => handleMove(null)}
                    className="text-xs"
                  >
                    未所属に戻す
                  </DropdownMenuItem>
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