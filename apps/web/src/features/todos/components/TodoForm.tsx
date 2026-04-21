"use client";

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { todoSchema, type TodoFormValues } from '../schemas';
import { Button } from '@/components/ui/button';
import { FormWrapper, FormInput, FormSelect } from '@/components/form/form-parts';
import { FormField, FormItem, FormLabel, FormControl } from '@/components/ui/form';
import { Slider } from '@/components/ui/slider';

interface TodoFormProps {
  onSubmit: (values: TodoFormValues) => Promise<void>;
  defaultValues?: Partial<TodoFormValues>;
  submitLabel?: string;
  onCancel?: () => void;
  isLoading?: boolean;
}

export const TodoForm = ({
  onSubmit,
  defaultValues,
  submitLabel = '保存',
  onCancel,
  isLoading
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

  const isPending = form.formState.isSubmitting || isLoading;

  return (
    <FormWrapper onSubmit={handleSubmit} form={form}>
      {/* タイトル */}
      <FormInput
        label="タイトル"
        name="todo_title"
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
              <div className="space-y-4">
                {/* Slider */}
                <Slider
                  min={0}
                  max={100}
                  step={1}
                  value={[field.value]}
                  onValueChange={(value) => field.onChange(value[0])}
                  className="w-full"
                />
                {/* 数値入力（微調整用） */}
                <input
                  type="number"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  min={0}
                  max={100}
                  value={field.value}
                  onChange={(e) => {
                    const val = parseInt(e.target.value);
                    // 空欄の場合は0、範囲外の場合は制限
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
              </div>
            </FormControl>
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
          disabled={isPending}
        >
          {isPending ? '保存中...' : submitLabel}
        </Button>
      </div>
    </FormWrapper>
  );
};