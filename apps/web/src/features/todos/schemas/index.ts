import * as z from 'zod';

/**
 * Todoのドメイン入力ルール。
 *
 * React Hook Form（クライアント側フォームバリデーション）、
 * todoService.createTodo（サーバー側最終防衛線）
 * が共通で参照する単一のスキーマ。
 *
 * Route Handler層でのZod検証は行わず（imagesフィールドを除く）、
 * このスキーマによるバリデーションはService層で実行される。
 * Route HandlerはPrisma Default（priority/progress）に委ねず、
 * Service層に渡す前に明示的なデフォルト値を埋めた上でこのスキーマの
 * 検証対象とする（DB Defaultはインフラの都合、ドメインルールはService層が持つ）。
 */
export const todoSchema = z.object({
  todo_title: z.string().min(1, 'タイトルを入力してください').max(255),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH']),
  progress: z.number().min(0).max(100),
});

export type TodoFormValues = z.infer<typeof todoSchema>;

// Service層でのUpdate検証用。全フィールドoptionalだが、値が渡された場合は
// todoSchema と同一のルール（文字数・enum・範囲）を適用する。
// フィールドが未指定(undefined)の場合はPrismaのupdate dataに含めず「変更しない」
// 扱いになる（Createのデフォルト埋めとは異なり、Update側でデフォルト値を
// 補完してはいけない。補完すると「変更なし」のつもりが意図せず上書きされる）。
export const updateTodoSchema = todoSchema.partial();
export type UpdateTodoSchemaValues = z.infer<typeof updateTodoSchema>;

/**
 * 一覧取得条件（クエリパラメータ）の検証スキーマ。
 *
 * Route Handler（GET /api/todos）がURLSearchParamsから取得した値
 * （キー不在時はnull）をこのスキーマで検証・正規化し、todoService.getTodosへ
 * 渡すTodoListFilters（types/index.ts）を組み立てる。
 *
 * searchParams.get()はキー不在時にnull（undefinedではない）を返すため、
 * z.enum().default()がそのままでは素通しできない。z.preprocessでnullを
 * undefinedへ変換した上で検証する。
 */
const nullToUndefined = (v: unknown) => (v === null ? undefined : v);

export const todoListFiltersSchema = z.object({
  sortOrder: z.preprocess(nullToUndefined, z.enum(['asc', 'desc']).default('desc')),
  completedOnly: z
    .preprocess(nullToUndefined, z.enum(['true', 'false']).default('false'))
    .transform((v) => v === 'true'),
  priority: z.preprocess(nullToUndefined, z.enum(['LOW', 'MEDIUM', 'HIGH']).optional()),
});

export type TodoListFiltersQuery = z.infer<typeof todoListFiltersSchema>;