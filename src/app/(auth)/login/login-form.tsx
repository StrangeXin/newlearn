"use client";

import { useActionState } from "react";
import { loginAction, type ActionState } from "@/app/actions/auth";

const initial: ActionState = {};

export function LoginForm() {
  const [state, action, pending] = useActionState(loginAction, initial);

  return (
    <form action={action} className="space-y-4">
      <div>
        <label htmlFor="name" className="field-label">
          姓名
        </label>
        <input
          id="name"
          name="name"
          type="text"
          autoComplete="username"
          required
          placeholder="与名单一致的姓名"
          className="input"
        />
      </div>

      <div>
        <label htmlFor="password" className="field-label">
          密码
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          placeholder="首次登录填默认密码"
          className="input"
        />
        <p className="field-hint mt-1.5">
          默认密码 <span className="badge badge-muted font-mono">Aa123456!</span>{" "}
          （首登后须改密）
        </p>
      </div>

      {state?.error && (
        <p className="field-error" role="alert">
          {state.error}
        </p>
      )}

      <button type="submit" disabled={pending} className="btn btn-primary btn-block">
        {pending ? "登录中…" : "登录并开始闯关"}
      </button>
    </form>
  );
}
