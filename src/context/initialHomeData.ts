export const runInitialHomeDataTasks = async (
  coreTasks: Promise<unknown>[],
  optionalTasks: Promise<unknown>[],
  onOptionalError: (error: unknown) => void
): Promise<void> => {
  void Promise.allSettled(optionalTasks).then(results => {
    results.forEach(result => {
      if (result.status === 'rejected') onOptionalError(result.reason);
    });
  });

  const coreResults = await Promise.allSettled(coreTasks);
  const coreFailure = coreResults.find(
    (result): result is PromiseRejectedResult => result.status === 'rejected'
  );
  if (coreFailure) throw coreFailure.reason;
};
