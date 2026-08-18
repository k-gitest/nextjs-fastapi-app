"use client";

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { todoSchema, type TodoFormValues } from '../schemas';
import { Button } from '@/components/ui/button';
import { FormWrapper, FormInput, FormSelect } from '@/components/form/form-parts';
import { FormField, FormItem, FormLabel, FormControl } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';

interface TodoFormProps {
  onSubmit: (values: TodoFormValues) => Promise<void>;
  defaultValues?: Partial<TodoFormValues>;
  submitLabel?: string;
  onCancel?: () => void;
  isLoading?: boolean;
  disabled?: boolean;
}

export const TodoForm = ({
  onSubmit,
  defaultValues,
  submitLabel = '保存',
  onCancel,
  isLoading,
  disabled,
}: TodoFormProps) => {
  const form = useForm<TodoFormValues>({
    resolver: zodResolver(todoSchema),
    defaultValues: {
      todo_title: defaultValues?.todo_title ?? '',
      priority: defaultValues?.priority ?? 'MEDIUM',
      progress: defaultValues?.progress ?? 0,
    },
  });

  const handleSubmit = async (values: TodoFormValues) => {
    try {
      await onSubmit(values);
      form.reset();
    } catch (error) {
      console.error('Failed to submit todo:', error);
    }
  };

  // isPending: ボタン文言（「保存中...」）を出し分けるためだけの状態
  const isPending = form.formState.isSubmitting || isLoading;
  // isDisabled: 押せるかどうか。isPendingに加え、呼び出し元から渡された
  // 任意の理由（画像アップロード中・エラー等）でも無効化できる
  const isDisabled = isPending || disabled;

  return (
    <FormWrapper onSubmit={handleSubmit} form={form}>
      {/* タイトル */}
      <FormInput
        label="タイトル"
        name="todo_title"
        autoComplete="off"
        placeholder="例: レポートを作成する"
      />

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