import * as z from 'zod';

export const todoSchema = z.object({
  todo_title: z.string().min(1, 'タイトルを入力してください').max(255),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH']),
  progress: z.number().min(0).max(100),
});

export type TodoFormValues = z.infer<typeof todoSchema>;