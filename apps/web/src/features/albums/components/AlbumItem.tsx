"use client";

import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Pencil, Trash2 } from "lucide-react";
import type { Album } from "@/features/albums/types";

interface AlbumItemProps {
  album: Album;
  onEdit: (album: Album) => void;
  onDelete: (album: Album) => void;
  disabled?: boolean;
}

export const AlbumItem = ({ album, onEdit, onDelete, disabled }: AlbumItemProps) => {
  return (
    <div className="flex items-center justify-between rounded-md border px-4 py-2">
      <span className="truncate">{album.name}</span>
      <div className="flex gap-1">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onEdit(album)}
          disabled={disabled}
          aria-label={`${album.name}を編集`}
        >
          <Pencil className="h-4 w-4" />
        </Button>

        {/* 削除は取り消せない操作のため、AlertDialogで確認を挟んでからonDeleteを呼ぶ。
            画像が残っている場合の409は呼び出し先（AlbumPanel→errorHandler）でトースト表示される。 */}
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="ghost" size="icon" disabled={disabled} aria-label={`${album.name}を削除`}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>アルバムを削除しますか？</AlertDialogTitle>
              <AlertDialogDescription>
                「{album.name}」を削除します。この操作は取り消せません。画像が含まれるアルバムは削除できません。
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>キャンセル</AlertDialogCancel>
              <AlertDialogAction onClick={() => onDelete(album)}>削除</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
};