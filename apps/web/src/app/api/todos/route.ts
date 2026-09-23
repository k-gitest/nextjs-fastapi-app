export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth0";
import { todoService } from "@/features/todos/services/";
import { toTodoWithImageSummaries, toTodoDTO } from "@/features/todos/lib/todoImageMapper";
import { todoRatelimit } from "@/lib/ratelimit";
import { checkRateLimit } from "@/lib/ratelimit-helper";
import { ValidationError } from "@/errors/validation-error";
import { ApiError } from "@/errors/api-error";
import { imageListInputSchema } from "@/features/images/schemas";
import { todoListFiltersSchema } from "@/features/todos/schemas";

const imagesFieldSchema = imageListInputSchema.optional();

export async function GET(req: Request) {
  const { user, response } = await requireAuth();
  if (!user) return response;

  const { searchParams } = new URL(req.url);
  const filtersParsed = todoListFiltersSchema.safeParse({
    sortOrder: searchParams.get("sortOrder"),
    completedOnly: searchParams.get("completedOnly"),
    priority: searchParams.get("priority"),
  });

  if (!filtersParsed.success) {
    return NextResponse.json(
      { message: "一覧取得条件が不正です", data: filtersParsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const todos = await todoService.getTodos(user.id, filtersParsed.data);
    return NextResponse.json(todos.map(toTodoWithImageSummaries));
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }
    throw error;
  }
}

export async function POST(req: Request) {
  const { user, response } = await requireAuth();
  if (!user) return response;

  const rateLimitResponse = await checkRateLimit(todoRatelimit, user.id);
  if (rateLimitResponse) return rateLimitResponse;

  const body = await req.json();

  const imagesParsed = imagesFieldSchema.safeParse(body.images);
  if (!imagesParsed.success) {
    return NextResponse.json({ message: "画像データが不正です", data: imagesParsed.error.flatten() }, { status: 400 });
  }
  const images = imagesParsed.data;

  const correlationId = crypto.randomUUID();

  try {
    const todo = await todoService.createTodo(
      {
        todo_title: body.todo_title,
        priority: body.priority,
        progress: body.progress ?? 0,
        userId: user.id,
      },
      correlationId,
      images,
    );

    return NextResponse.json(toTodoDTO(todo), { status: 201 });
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json({ message: error.message }, { status: 400 });
    }
    if (error instanceof ApiError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }
    throw error;
  }
}