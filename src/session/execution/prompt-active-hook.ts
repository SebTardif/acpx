export async function invokePromptActiveHook(
  hook: (() => Promise<void> | void) | undefined,
  reportError: (error: unknown) => void,
): Promise<void> {
  if (!hook) {
    return;
  }
  try {
    await hook();
  } catch (error) {
    reportError(error);
    throw error;
  }
}
