/**
 * Returns a rejection handler that logs the error with a short context
 * message. Intended for fire-and-forget promises (background viewer
 * operations, navigation, clipboard writes) that have no natural
 * user-visible error sink.
 */
export function reportError(context: string): (error: unknown) => void {
  return (error: unknown): void => {
    console.error(`${context}:`, error);
  };
}
