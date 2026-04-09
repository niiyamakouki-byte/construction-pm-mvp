export type UndoEntry = {
  taskId: string;
  previousStartDate: string;
  previousEndDate: string;
  newStartDate: string;
  newEndDate: string;
  timestamp: string;
};

export const MAX_UNDO_ENTRIES = 20;

export function createUndoStack(maxEntries = MAX_UNDO_ENTRIES) {
  const stack: UndoEntry[] = [];

  return {
    push(entry: UndoEntry) {
      stack.push(entry);
      if (stack.length > maxEntries) {
        stack.splice(0, stack.length - maxEntries);
      }
    },
    undo() {
      return stack.pop() ?? null;
    },
    canUndo() {
      return stack.length > 0;
    },
    clear() {
      stack.length = 0;
    },
  };
}

export const undoStack = createUndoStack();
