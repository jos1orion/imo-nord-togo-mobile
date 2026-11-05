import { describe, expect, it, jest } from '@jest/globals';
import { runInitialHomeDataTasks } from '../initialHomeData';

describe('runInitialHomeDataTasks', () => {
  it('does not wait for optional modules before resolving the home catalogue', async () => {
    const optionalError = new Error('optional table is unavailable');
    const onOptionalError = jest.fn<(error: unknown) => void>();
    let rejectOptional!: (error: Error) => void;
    const optionalTask = new Promise<never>((_, reject) => {
      rejectOptional = reject;
    });

    await expect(
      runInitialHomeDataTasks(
        [Promise.resolve()],
        [optionalTask],
        onOptionalError
      )
    ).resolves.toBeUndefined();

    expect(onOptionalError).not.toHaveBeenCalled();
    rejectOptional(optionalError);
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(onOptionalError).toHaveBeenCalledWith(optionalError);
  });

  it('preserves core-data errors while reporting optional failures', async () => {
    const coreError = new Error('properties query failed');
    const optionalError = new Error('optional table is unavailable');
    const onOptionalError = jest.fn<(error: unknown) => void>();

    await expect(
      runInitialHomeDataTasks(
        [Promise.reject(coreError)],
        [Promise.reject(optionalError)],
        onOptionalError
      )
    ).rejects.toBe(coreError);

    await new Promise(resolve => setTimeout(resolve, 0));
    expect(onOptionalError).toHaveBeenCalledWith(optionalError);
  });
});
