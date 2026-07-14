"use client";

import { useActionState } from "react";
import type { FormState } from "@/app/actions";

const initialState: FormState = { ok: false, error: null };

type ActionButtonFormProps = {
  action: (prevState: FormState, formData: FormData) => Promise<FormState>;
  fieldName: string;
  fieldValue: string;
  disabled: boolean;
  idleLabel: string;
  disabledLabel: string;
  pendingLabel: string;
  className: string;
};

// Wraps a single server-action button (Register / Enroll / Check in) with
// React 19's useActionState so a failed write shows the member an actual
// message instead of the button just quietly doing nothing.
export default function ActionButtonForm({
  action,
  fieldName,
  fieldValue,
  disabled,
  idleLabel,
  disabledLabel,
  pendingLabel,
  className,
}: ActionButtonFormProps) {
  const [state, formAction, isPending] = useActionState(action, initialState);

  return (
    <form action={formAction}>
      <input type="hidden" name={fieldName} value={fieldValue} />
      <button type="submit" disabled={disabled || isPending} className={className}>
        {isPending ? pendingLabel : disabled ? disabledLabel : idleLabel}
      </button>
      {state.error && (
        <p className="mt-1 text-xs font-semibold text-red-500">{state.error}</p>
      )}
    </form>
  );
}
