"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateAlbumSchema, type UpdateAlbumSchemaInput } from "@/features/albums/schemas";
import type { Album } from "@/features/albums/types";

interface AlbumEditDialogProps {
  // nullなら閉じている状態を表す。トリガーボタンはAlbumItem側にあるため
  // TodoCreateFormのようなDialogTriggerは持たず、外部のopen状態のみで制御する。
  album: Album | null;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: UpdateAlbumSchemaInput) => void | Promise<void>;
  isLoading?: boolean;
}

export const AlbumEditDialog = ({ album, onOpenChange, onSubmit, isLoading }: AlbumEditDialogProps) => {
  return (
    <Dialog open={album !== null} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>アルバム名を変更</DialogTitle>
        </DialogHeader>
        <DialogDescription className="sr-only">新しいアルバム名を入力してください。</DialogDescription>

        {/* albumがnullの間はBodyを描画しない。keyをalbum.idにすることで、
            別のAlbumの編集に切り替わった場合もdefaultValuesが正しく再初期化される。 */}
        {album && (
          <AlbumEditDialogBody
            key={album.id}
            album={album}
            onSubmit={onSubmit}
            onSuccess={() => onOpenChange(false)}
            isLoading={isLoading}
          />
        )}
      </DialogContent>
    </Dialog>
  );
};

type AlbumEditDialogBodyProps = {
  album: Album;
  onSubmit: (values: UpdateAlbumSchemaInput) => void | Promise<void>;
  onSuccess: () => void;
  isLoading?: boolean;
};

const AlbumEditDialogBody = ({ album, onSubmit, onSuccess, isLoading }: AlbumEditDialogBodyProps) => {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<UpdateAlbumSchemaInput>({
    resolver: zodResolver(updateAlbumSchema),
    defaultValues: { name: album.name },
  });

  const submit = async (values: UpdateAlbumSchemaInput) => {
    // 409（重複名）等はonSubmit内でthrowされerrorHandlerに委譲される。
    // catchでは何もしない（トースト表示済み）が、成功時のみダイアログを閉じる意図を明示するために書く。
    try {
      await onSubmit(values);
      onSuccess();
    } catch {
      // errorHandlerへ委譲済み。ここでは何もしない。
    }
  };

  return (
    <form onSubmit={handleSubmit(submit)} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="album-edit-name">アルバム名</Label>
        <Input id="album-edit-name" autoComplete="off" {...register("name")} disabled={isLoading} />
        {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
      </div>
      <Button type="submit" disabled={isLoading} className="w-full">
        保存
      </Button>
    </form>
  );
};