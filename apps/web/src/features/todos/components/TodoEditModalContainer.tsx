import { useTodo } from '../hooks/useTodo';
import { useCallback } from 'react';
import { TodoEditModal } from './TodoEditModal';
import type { Todo } from '../types';
import type { TodoFormValues } from '../schemas';

export const TodoEditModalContainer = ({ todo, onClose }: { todo: Todo; onClose: () => void; }) => {
  const { updateTodo } = useTodo();

  const handleSubmit = useCallback(async (values: TodoFormValues) => {
    await updateTodo({ id: todo.id, ...values });
    onClose();
  }, [todo.id, updateTodo, onClose]);

  const handleOpenChange = useCallback((open: boolean) => {
    if (!open) {
      onClose();
    }
  }, [onClose]);

  return (
    <TodoEditModal
      id={todo.id}
      title={todo.todo_title}
      priority={todo.priority ?? 'MEDIUM'}
      progress={todo.progress ?? 0}
      open={true}
      onOpenChange={handleOpenChange}
      onSubmit={handleSubmit}
    />
  );
};