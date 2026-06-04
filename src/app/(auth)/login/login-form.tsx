"use client";

import { useActionState } from "react";
import { loginAction, type ActionState } from "@/app/actions/auth";

const initial: ActionState = {};

export function LoginForm() {
  const [state, action, pending] = useActionState(loginAction, initial);

  return (
    <form action={action} className="space-y-4">
      <div>
        <label htmlFor="name" className="block text-sm font-medium text-ink">
          姓名
        </label>
        <input
          id="name"
          name="name"
          type="text"
          autoComplete="username"
          required
          placeholder="请输入你的姓名"
          className="mt-1 w-full rounded-xl border border-brand-200 bg-white px-4 py-2.5 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
        />
      </div>

      <div>
        <label htmlFor="password" className="block text-sm font-medium text-ink">
          密码
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          placeholder="首次登录请输入默认密码"
          className="mt-1 w-full rounded-xl border border-brand-200 bg-white px-4 py-2.5 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
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
        {pending ? "登录中…" : "登录 / 注册"}
      </button>
    </form>
  );
}
