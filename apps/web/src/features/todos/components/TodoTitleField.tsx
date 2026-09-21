"use client";

import { useEffect, useRef, useState } from "react";
import { useFormContext } from "react-hook-form";
import {
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/components/ui/form";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupTextarea,
} from "@/components/ui/input-group";
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

// 実測誤差（サブピクセルの丸め等）を吸収するための許容差。
// 意図的な発振防止（ヒステリシス）ではなく、あくまで計測誤差対策の値。
const LINE_HEIGHT_EPSILON_PX = 2;

/**
 * 「1行分の高さ」をCSSから実測する。決め打ちのpx値を使わず、
 * line-height・padding・borderの実際の計算値から求める
 * （min-h-8等のTailwindクラス値が変わっても追従できるようにするため）。
 */
const measureSingleLineHeight = (el: HTMLTextAreaElement): number => {
  const style = window.getComputedStyle(el);
  const lineHeight = parseFloat(style.lineHeight);
  const paddingTop = parseFloat(style.paddingTop);
  const paddingBottom = parseFloat(style.paddingBottom);
  const borderTop = parseFloat(style.borderTopWidth);
  const borderBottom = parseFloat(style.borderBottomWidth);
  return lineHeight + paddingTop + paddingBottom + borderTop + borderBottom;
};

/**
 * タイトル入力欄。チャット入力欄と同様のレイアウト（1行時はアイコンと
 * テキストが同じ行、複数行時はアイコンが最下段固定）を実現する。
 *
 * 表示が1行か複数行かは、ResizeObserverでtextarea要素の実際の高さ変化を
 * 監視し、「1行分の高さ」を超えたかどうかで判定する。改行文字の有無
 * （value.includes("\n")）では、横幅による自動折り返しを検知できないため、
 * 実際の描画結果（高さ）を見る方式を採用している。
 *
 * 【既知の制約・今後の課題】
 * inline-start（アイコンが横に並ぶ）とblock-end（アイコンが下段）では、
 * アイコン分の横幅の有無によりtextarea自体の使える幅が変わり、
 * それによって折り返し位置＝行数判定自体が変化しうる（レイアウト変更が
 * 判定条件に影響するフィードバック構造を持つ）。境界値付近では実際の
 * チャットアプリ同様、切り替えのタイミングが完全に安定しない場合があるが、
 * 現時点ではヒステリシス（上げ下げで異なる閾値を使う等の発振防止）は
 * 未実装。まずは見た目の2状態（1行/複数行）を成立させることを優先し、
 * 境界の安定化は別途対応する。
 *
 * auto-grow（高さ自体の自動拡張）はJSで行わない。ui/textarea.tsx の
 * Textarea ベースクラスに `field-sizing-content`（ネイティブCSSの
 * field-sizing: content）が含まれており、ブラウザが自動で高さを調整する。
 * ここでのResizeObserverは、その結果として変化した高さを「観測するだけ」
 * であり、高さ自体をJSから操作することはしない。
 *
 * todoSchema（z.string().min(1).max(255)）は改行を禁止していないため、
 * 複数行入力自体はバリデーション上問題ない。
 */
export const TodoTitleField = ({ imageAttachment }: TodoTitleFieldProps) => {
  const { control } = useFormContext<TodoFormValues>();
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [isMultiline, setIsMultiline] = useState(false);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;

    const singleLineHeight = measureSingleLineHeight(el);

    const observer = new ResizeObserver(() => {
      const currentHeight = el.getBoundingClientRect().height;
      setIsMultiline(currentHeight > singleLineHeight + LINE_HEIGHT_EPSILON_PX);
    });
    observer.observe(el);

    return () => observer.disconnect();
  }, []);

  return (
    <FormField
      control={control}
      name="todo_title"
      render={({ field }) => (
        <FormItem>
          <FormLabel>タイトル</FormLabel>
          <FormControl>
            <InputGroup>
              <InputGroupTextarea
                {...field}
                ref={(el) => {
                  textareaRef.current = el;
                }}
                rows={1}
                autoComplete="off"
                placeholder="例: レポートを作成する"
                className="min-h-8 max-h-40 resize-none overflow-y-auto"
              />
              {imageAttachment && (
                <InputGroupAddon align={isMultiline ? "block-end" : "inline-start"}>
                  <ImageAttachMenu
                    items={imageAttachment.items}
                    addFiles={imageAttachment.addFiles}
                    addExistingImages={imageAttachment.addExistingImages}
                    disabled={imageAttachment.disabled}
                  />
                </InputGroupAddon>
              )}
            </InputGroup>
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
};