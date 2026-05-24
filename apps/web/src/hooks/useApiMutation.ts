"use client"

import {
  useMutation,
} from '@tanstack/react-query';
import type {
  UseMutationOptions,
  UseMutationResult,
} from '@tanstack/react-query';
import { errorHandler } from '@/errors/error-handler';

/* useMutationのカスタムフック
   OmitしているのはtrpcのmutationOptions用の型
   useApiMutationの書き方（useApiQueryに併せてプロパティを明示）

   const { isPending, data } = useApiMutation({
      mutationFn:  () => getApiData(),
      enabled: false,
      onSuccess: () => console.log("success!"),
      onError: () => console.log("error!"),
      onSettled: () => console.log("finish!"),
   })

   // trpcの場合mutationOptionsでmutationFnとmutationKeyが生成される
   const mutationOptions = trpc.hello.mutationOptions({
       onSuccess: (data) => {
         if (data) console.log(data);
       },
     });
     const mutation = useApiMutation(mutationOptions);
*/
/**
 * useMutationカスタムフック
 * @param mutationFn - 実行する非同期関数
 * @param options - useMutationのオプション
 * @returns UseMutationの結果
 */
export const useApiMutation = <TData = unknown, TError = unknown, TVariables = void, TContext = unknown>(
  options:
    | (UseMutationOptions<TData, TError, TVariables, TContext> & {
      mutationFn: (variables: TVariables) => Promise<TData>;
    })
    | Omit<UseMutationOptions<TData, TError, TVariables, TContext>, 'mutationFn'>,
): UseMutationResult<TData, TError, TVariables, TContext> => {
  return useMutation<TData, TError, TVariables, TContext>({
    ...options,
    onSuccess: (data, variables, context, mutation) => {
      options?.onSuccess?.(data, variables, context, mutation);
    },
    onError: (error, variables, context, mutation) => {
      errorHandler(error);
      options?.onError?.(error, variables, context, mutation);
    },
    onSettled: (data, error, variables, context, mutation) => {
      options?.onSettled?.(data, error, variables, context, mutation);
    },
  });
};
