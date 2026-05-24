import { renderHook, waitFor } from '@testing-library/react';
import { test, vi, describe, beforeEach } from 'vitest';
import { queryClientWrapper } from '@tests/test-utils/vitest-util';
import { useApiMutation } from '@/hooks/useApiMutation';

// 共通エラーハンドラをモック
vi.mock('@/errors/error-handler', () => ({
    errorHandler: vi.fn(),
}));

import { errorHandler } from '@/errors/error-handler';
const mockErrorHandler = errorHandler as ReturnType<typeof vi.fn>;

// -----------------------------------------------------------------
// useApiMutation のテスト
// -----------------------------------------------------------------

describe('useApiMutation', () => {
    const wrapper = queryClientWrapper();

    //queryClientWrapper();

    beforeEach(() => {
        mockErrorHandler.mockClear();
    });

    // ----------------------------------------------------
    // シナリオ C: ミューテーション成功時のテスト
    // ----------------------------------------------------
    test('ミューテーション成功時に onSuccess と onSettled が呼び出される', async () => {
        const mutationFn = vi.fn(async (vars: number) => `Mutated: ${vars}`);
        const onSuccess = vi.fn();
        const onError = vi.fn();
        const onSettled = vi.fn();
        const variables = 123;
        const expectedData = `Mutated: ${variables}`; // 成功時のデータ

        const { result } = renderHook(() => 
            useApiMutation({ 
                mutationFn,
                onSuccess,
                onError,
                onSettled,
            }), 
            { wrapper }
        );

        // ミューテーションを実行し、解決を待つ
        await result.current.mutateAsync(variables);

        // 1. 成功コールバックがデータ、変数、コンテキスト、ミューテーションオブジェクトと共に呼ばれたか
        expect(onSuccess).toHaveBeenCalledWith(expectedData, variables, undefined, expect.anything());
        
        // 2. 完了コールバックがデータ、エラー(null)、変数、コンテキスト、ミューテーションオブジェクトと共に呼ばれたか
        expect(onSettled).toHaveBeenCalledWith(expectedData, null, variables, undefined, expect.anything());
        
        // 3. エラー関連の関数は呼ばれていないか
        expect(onError).not.toHaveBeenCalled();
        expect(mockErrorHandler).not.toHaveBeenCalled();
    });

    // ----------------------------------------------------
    // シナリオ D: ミューテーション失敗時のテスト
    // ----------------------------------------------------
    test('ミューテーション失敗時に onError と errorHandler が呼び出される', async () => {
        const error = new Error('Mutation Failed');
        const mutationFn = vi.fn(async () => Promise.reject(error));
        const onSuccess = vi.fn();
        const onError = vi.fn();
        const onSettled = vi.fn();

        const { result } = renderHook(() => 
            useApiMutation({ 
                mutationFn,
                onSuccess,
                onError,
                onSettled,
            }), 
            { wrapper }
        );

        // 1. ミューテーションを実行し、エラーをキャッチ
        // mutuateAsync はエラーを投げるため、catchするか expect().rejects.toThrow() を使用
        await expect(result.current.mutateAsync(undefined)).rejects.toThrow();

        // 非同期で実行されるコールバック (onError, errorHandler, onSettled) の完了を待機
        await waitFor(() => {
            // 1. 失敗コールバックがエラーと共に呼ばれたか
            expect(onError).toHaveBeenCalledWith(error, undefined, undefined, expect.anything());
            
            // 2. 共通のエラーハンドラがエラーオブジェクトと共に呼ばれたか
            expect(mockErrorHandler).toHaveBeenCalledWith(error);
            
            // 3. 完了コールバックが呼ばれたか
            expect(onSettled).toHaveBeenCalledWith(undefined, error, undefined, undefined, expect.anything());
            
            // 4. 成功コールバックは呼ばれていないか
            expect(onSuccess).not.toHaveBeenCalled();
        }); // waitFor ブロックでラップ
    });
});