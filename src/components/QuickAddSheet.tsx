import type { Contractor } from "../domain/types.js";
import type { QuickAddState } from "./gantt/types.js";
import { QuickAddForm } from "./gantt/QuickAddForm.js";

type Props = {
  quickAdd: QuickAddState;
  contractors?: Contractor[];
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
  onChange: (updater: (q: QuickAddState) => QuickAddState) => void;
};

export function QuickAddSheet({ quickAdd, contractors = [], onClose, onSubmit, onChange }: Props) {
  return (
    <QuickAddForm
      quickAdd={quickAdd}
      contractors={contractors}
      onClose={onClose}
      onSubmit={onSubmit}
      onChange={onChange}
    />
  );
}
