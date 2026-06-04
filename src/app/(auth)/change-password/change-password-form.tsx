"use client";

import { useActionState } from "react";
import {
  changePasswordAction,
  type ActionState,
} from "@/app/actions/auth";

const initial: ActionState = {};

const inputClass =
  "mt-1 w-full rounded-xl border border-brand-200 bg-white px-4 py-2.5 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-200";

export function ChangePasswordForm({ forced }: { forced: boolean }) {
  const [state, action, pending] = useActionState(changePasswordAction, initial);

  return (
    <form action={action} className="space-y-4">
      {!forced && (
        <div>
          <label htmlFor="currentPassword" className="block text-sm font-medium text-ink">
            当前密码
          </label>
          <input
            id="currentPassword"
            name="currentPassword"
            type="password"
            autoComplete="current-password"
            className={inputClass}
          />
        </div>
      )}

      <div>
        <label htmlFor="newPassword" className="block text-sm font-medium text-ink">
          新密码
        </label>
        <input
          id="newPassword"
          name="newPassword"
          type="password"
          autoComplete="new-password"
          required
          placeholder="8–72 位，含字母与数字"
          className={inputClass}
        />
      </div>

      <div>
        <label htmlFor="confirmPassword" className="block text-sm font-medium text-ink">
          确认新密码
        </label>
        <input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          required
          className={inputClass}
        />
      </div>

      {state?.error && (
        <p className="rounded-lg bg-danger-500/10 px-3 py-2 text-sm text-danger-500">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-xl bg-brand-600 px-4 py-2.5 font-semibold text-white shadow-lg shadow-brand-600/30 transition hover:bg-brand-700 disabled:opacity-60"
      >
        {pending ? "保存中…" : "保存新密码"}
      </button>
    </form>
  );
}
