export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth0";
import { todoService } from "@/features/todos/services/index";
import { todoRatelimit } from "@/lib/ratelimit";
import { checkRateLimit } from "@/lib/ratelimit-helper";
import { ValidationError } from "@/errors/validation-error";
import { imageListInputSchema } from "@/features/images/schemas";

const imagesFieldSchema = imageListInputSchema.optional();

export async function GET() {
  const { user, response } = await requireAuth();
  if (!user) return response;

  const todos = await todoService.getTodos(user.id);
  return NextResponse.json(todos);
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

    return NextResponse.json(todo, { status: 201 });
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json({ message: error.message }, { status: 400 });
    }
    throw error;
  }
}