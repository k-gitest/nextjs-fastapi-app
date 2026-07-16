"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus } from "lucide-react";
import { createAlbumSchema, type CreateAlbumSchemaInput } from "@/features/albums/schemas";

interface AlbumCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: CreateAlbumSchemaInput) => void | Promise<void>;
  isLoading?: boolean;
}

/**
 * Album作成ダイアログ
 *
 * TodoCreateFormと同様、Dialogの開閉に応じてBodyをkeyで再マウントし、
 * 閉じる→開くのたびにフォーム状態（react-hook-form）を初期状態から始める。
 * Dialog/DialogContent自体にはkeyを付けず、Radixの内部状態には影響させない。
 */
export const AlbumCreateDialog = ({ open, onOpenChange, onSubmit, isLoading }: AlbumCreateDialogProps) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="mr-2 h-4 w-4" /> 新規アルバム
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>新しいアルバムを作成</DialogTitle>
        </DialogHeader>
        <DialogDescription className="sr-only">アルバム名を入力してください。</DialogDescription>

        <AlbumCreateDialogBody
          key={open ? "dialog-open" : "dialog-closed"}
          onSubmit={onSubmit}
          onSuccess={() => onOpenChange(false)}
          isLoading={isLoading}
        />
      </DialogContent>
    </Dialog>
  );
};

type AlbumCreateDialogBodyProps = {
  onSubmit: (values: CreateAlbumSchemaInput) => void | Promise<void>;
  onSuccess: () => void;
  isLoading?: boolean;
};

const AlbumCreateDialogBody = ({ onSubmit, onSuccess, isLoading }: AlbumCreateDialogBodyProps) => {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CreateAlbumSchemaInput>({
    resolver: zodResolver(createAlbumSchema),
    defaultValues: { name: "" },
  });

  const submit = async (values: CreateAlbumSchemaInput) => {
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
        <Label htmlFor="album-create-name">アルバム名</Label>
        <Input id="album-create-name" {...register("name")} disabled={isLoading} />
        {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
      </div>
      <Button type="submit" disabled={isLoading} className="w-full">
        作成
      </Button>
    </form>
  );
};