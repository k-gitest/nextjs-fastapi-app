"use client";

import { useState } from "react";
import { useFormContext } from "react-hook-form";
import TextareaAutosize from "react-textarea-autosize";
import {
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/components/ui/form";
import { InputGroup, InputGroupAddon } from "@/components/ui/input-group";
import { ImageAttachMenu } from "@/features/images/components/ImageAttachMenu";
import type { AddFilesResult, ImageItem, ImageSummary } from "@/features/images/types";
import type { TodoFormValues } from "../schemas";

type ImageAttachmentProps = {
  items: ImageItem[];
  addFiles: (files: File[]) => AddFilesResult;
  addExistingImages: (images: ImageSummary[]) => AddFilesResult;
  disabled?: boolean;
};

type TodoTitleFieldProps = {
  imageAttachment?: ImageAttachmentProps;
};

// 初回の1行分の高さを基準とし、それを超えたらexpandedへ遷移する
// （誤差の許容差であり、ヒステリシスの意図はない）。
// expandedからcompactへの復帰は高さでは判定せず、空文字になった場合のみ行う。
const LINE_HEIGHT_EPSILON_PX = 2;

/**
 * タイトル入力欄。
 * 1行時は添付アイコンを入力欄と同じ行に配置し、
 * 複数行になるとアイコンを最下段へ移動する。
 *
 * 高さの自動拡張は react-textarea-autosize に委譲し、
 * expanded状態は高さの増加で判定し、空文字になった場合のみcompactへ戻す。
 *
 * FormControlはTextareaAutosizeを直接包み、InputGroupはその外側に配置する。
 * これにより、フォームのlabelと実際のtextareaを正しく関連付けつつ、
 * InputGroupのDOM構造も維持する。
 */
export const TodoTitleField = ({ imageAttachment }: TodoTitleFieldProps) => {
  const { control } = useFormContext<TodoFormValues>();
  const [isExpanded, setIsExpanded] = useState(false);
  const [singleLineHeight, setSingleLineHeight] = useState<number | null>(null);

  const handleHeightChange = (height: number) => {
    if (singleLineHeight === null) {
      // 初回高さを1行分の基準として保持する
      setSingleLineHeight(height);
      return;
    }
    if (height > singleLineHeight + LINE_HEIGHT_EPSILON_PX) {
      setIsExpanded(true);
    }
  };

  return (
    <FormField
      control={control}
      name="todo_title"
      render={({ field }) => (
        <FormItem>
          <FormLabel>タイトル</FormLabel>
          <InputGroup>
            <FormControl>
              <TextareaAutosize
                {...field}
                data-slot="input-group-control"
                minRows={1}
                maxRows={6}
                onHeightChange={handleHeightChange}
                onChange={(e) => {
                  field.onChange(e);
                  if (e.target.value === "") {
                    setIsExpanded(false);
                  }
                }}
                autoComplete="off"
                placeholder="例: レポートを作成する"
                className="flex w-full resize-none rounded-none border-0 bg-transparent px-2.5 py-2 text-base shadow-none outline-none ring-0 transition-colors placeholder:text-muted-foreground focus-visible:ring-0 disabled:cursor-not-allowed disabled:bg-transparent disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-0 md:text-sm dark:bg-transparent dark:disabled:bg-transparent dark:aria-invalid:border-destructive/50"
              />
            </FormControl>
            {imageAttachment && (
              <InputGroupAddon align={isExpanded ? "block-end" : "inline-start"}>
                <ImageAttachMenu
                  items={imageAttachment.items}
                  addFiles={imageAttachment.addFiles}
                  addExistingImages={imageAttachment.addExistingImages}
                  disabled={imageAttachment.disabled}
                />
              </InputGroupAddon>
            )}
          </InputGroup>
          <FormMessage />
        </FormItem>
      )}
    />
  );
};