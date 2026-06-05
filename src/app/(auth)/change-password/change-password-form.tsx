"use client";

import { useActionState } from "react";
import {
  changePasswordAction,
  type ActionState,
} from "@/app/actions/auth";

const initial: ActionState = {};

export function ChangePasswordForm({ forced }: { forced: boolean }) {
  const [state, action, pending] = useActionState(changePasswordAction, initial);

  return (
    <form action={action} className="space-y-4">
      {!forced && (
        <div>
          <label htmlFor="currentPassword" className="field-label">
            当前密码
          </label>
          <input
            id="currentPassword"
            name="currentPassword"
            type="password"
            autoComplete="current-password"
            className="input"
          />
        </div>
      )}

      <div>
        <label htmlFor="newPassword" className="field-label">
          新密码
        </label>
        <input
          id="newPassword"
          name="newPassword"
          type="password"
          autoComplete="new-password"
          required
          placeholder="设置一个新密码"
          className="input"
        />
        <ul className="field-hint mt-2 space-y-1">
          <li>长度 8 到 72 位，至少各含一个字母和一个数字</li>
          <li>不能再用默认密码，也不能和现在的密码一样</li>
        </ul>
      </div>

      <div>
        <label htmlFor="confirmPassword" className="field-label">
          确认新密码
        </label>
        <input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          required
          placeholder="再次输入新密码"
          className="input"
        />
      </div>

      {state?.error && (
        <p className="field-error" role="alert">
          {state.error}
        </p>
      )}

      <button type="submit" disabled={pending} className="btn btn-primary btn-block">
        {pending ? "保存中…" : "保存新密码"}
      </button>
    </form>
  );
}
