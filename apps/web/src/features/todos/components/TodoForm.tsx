"use client";

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { todoSchema, type TodoFormValues } from '../schemas';
import { Button } from '@/components/ui/button';
import { FormWrapper, FormSelect } from '@/components/form/form-parts';
import { FormField, FormItem, FormLabel, FormControl } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { cn } from '@/lib/utils';
import { TodoTitleField } from './TodoTitleField';
import { ImageGallery } from '@/features/images/components/ImageGallery';
import type { AddFilesResult, ImageItem, ImageSummary } from '@/features/images/types';

type ImageAttachmentProps = {
  items: ImageItem[];
  addFiles: (files: File[]) => AddFilesResult;
  addExistingImages: (images: ImageSummary[]) => AddFilesResult;
  removeItem: (id: string) => void;
  disabled?: boolean;
};

interface TodoFormProps {
  onSubmit: (values: TodoFormValues) => Promise<void>;
  defaultValues?: Partial<TodoFormValues>;
  submitLabel?: string;
  onCancel?: () => void;
  isLoading?: boolean;
  disabled?: boolean;
  // 呼び出し元（TodoCreateForm/TodoEditModal）が useImageList を渡す。
  // 渡されない場合は画像添付UI自体を描画しない（TodoFormの再利用性を保つ）。
  imageAttachment?: ImageAttachmentProps;
}

export const TodoForm = ({
  onSubmit,
  defaultValues,
  submitLabel = '保存',
  onCancel,
  isLoading,
  disabled,
  imageAttachment,
}: TodoFormProps) => {
  const form = useForm<TodoFormValues>({
    resolver: zodResolver(todoSchema),
    defaultValues: {
      todo_title: defaultValues?.todo_title ?? '',
      priority: defaultValues?.priority ?? 'MEDIUM',
      progress: defaultValues?.progress ?? 0,
    },
  });

  const [isDraggingOver, setIsDraggingOver] = useState(false);

  const handleSubmit = async (values: TodoFormValues) => {
    try {
      await onSubmit(values);
      form.reset();
    } catch (error) {
      console.error('Failed to submit todo:', error);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDraggingOver(false);
    if (!imageAttachment) return;
    const files = Array.from(e.dataTransfer.files).filter((file) =>
      file.type.startsWith('image/'),
    );
    if (files.length > 0) {
      imageAttachment.addFiles(files);
    }
  };

  // isPending: ボタン文言（「保存中...」）を出し分けるためだけの状態
  const isPending = form.formState.isSubmitting || isLoading;
  // isDisabled: 押せるかどうか。isPendingに加え、呼び出し元から渡された
  // 任意の理由（画像アップロード中・エラー等）でも無効化できる
  const isDisabled = isPending || disabled;

  return (
    <FormWrapper onSubmit={handleSubmit} form={form}>
      {/* タイトル欄（+画像添付アイコン）。DnD受付領域はこのdivのみに限定する
          （ImageGalleryのサムネイル一覧はDnD対象に含めない。既存サムネイル上への
          ドロップでhandleDropが発火し、受付領域が意図より広がるのを避けるため）。 */}
      <div
        className={cn(
          'rounded-md p-1 -m-1 transition-colors',
          isDraggingOver && 'ring-2 ring-primary bg-primary/5',
        )}
        onDragOver={(e) => {
          if (!imageAttachment) return;
          e.preventDefault();
          setIsDraggingOver(true);
        }}
        onDragLeave={() => setIsDraggingOver(false)}
        onDrop={handleDrop}
      >
        <TodoTitleField imageAttachment={imageAttachment} />
      </div>

      {/* サムネイル一覧。DnD対象外（上のタイトル欄divとは別要素） */}
      {imageAttachment && (
        <ImageGallery
          items={imageAttachment.items}
          removeItem={imageAttachment.removeItem}
        />
      )}

      {/* 優先度 */}
      <FormSelect
        label="優先度"
        name="priority"
        options={[
          { value: 'LOW', label: '低' },
          { value: 'MEDIUM', label: '中' },
          { value: 'HIGH', label: '高' },
        ]}
        placeholder="優先度を選択"
      />

      {/* 進捗率（Slider + 数値入力の組み合わせ） */}
      <FormField
        control={form.control}
        name="progress"
        render={({ field }) => (
          <FormItem>
            <FormLabel>進捗 ({field.value}%)</FormLabel>
            <FormControl>
              {/* 主コントロール: 数値入力。FormControlのSlotがid/aria-describedby/
                  aria-invalidを直接の子に付与するため、Inputを唯一の子にする */}
              <Input
                type="number"
                min={0}
                max={100}
                {...field}
                autoComplete="off"
                onChange={(e) => {
                  const val = parseInt(e.target.value);
                  // 空欄の場合は0、範囲外の場合は制限（既存挙動を維持）
                  if (isNaN(val)) {
                    field.onChange(0);
                  } else if (val < 0) {
                    field.onChange(0);
                  } else if (val > 100) {
                    field.onChange(100);
                  } else {
                    field.onChange(val);
                  }
                }}
              />
             </FormControl>
            {/* 補助UI: Sliderは同じ値を操作する副次コントロール。
                FormControlの外に置き、フォームフィールドとしては扱わせない。
                ラベルはFormLabel（数値inputに関連付け済み）と同じ意味のため
                aria-labelで簡潔に示す */}
            <Slider
              min={0}
              max={100}
              step={1}
              value={[field.value]}
              onValueChange={(value) => field.onChange(value[0])}
              name="progress-slider"
              aria-label="進捗"
              className="w-full"
            />
          </FormItem>
        )}
      />

      {/* ボタンエリア */}
      <div className="flex gap-2">
        {onCancel && (
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            className="flex-1"
          >
            キャンセル
          </Button>
        )}
        <Button
          type="submit"
          className={onCancel ? 'flex-1' : 'w-full'}
          disabled={isDisabled}
        >
          {isPending ? '保存中...' : submitLabel}
        </Button>
      </div>
    </FormWrapper>
  );
};