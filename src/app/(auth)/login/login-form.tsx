"use client";

import { useActionState, useRef } from "react";
import { loginAction, type ActionState } from "@/app/actions/auth";

const initial: ActionState = {};

const DEMO_PASSWORD = "Aa123456!";
const DEMO_ACCOUNTS = [
  { role: "员工", name: "张三" },
  { role: "管理员", name: "管理员小赵" },
  { role: "超管", name: "超级管理员" },
];

export function LoginForm() {
  const [state, action, pending] = useActionState(loginAction, initial);
  const formRef = useRef<HTMLFormElement>(null);
  const identifierRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  function loginAs(name: string) {
    if (identifierRef.current) identifierRef.current.value = name;
    if (passwordRef.current) passwordRef.current.value = DEMO_PASSWORD;
    formRef.current?.requestSubmit();
  }

  return (
    <form ref={formRef} action={action} className="space-y-4">
      <div>
        <label htmlFor="identifier" className="field-label">
          姓名 / 手机号
        </label>
        <input
          ref={identifierRef}
          id="identifier"
          name="identifier"
          type="text"
          autoComplete="username"
          required
          placeholder="与名单一致的姓名，或已登记手机号"
          className="input"
        />
      </div>

      <div>
        <label htmlFor="password" className="field-label">
          密码
        </label>
        <input
          ref={passwordRef}
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          placeholder="默认密码"
          className="input"
        />
        <p className="field-hint mt-1.5">
          默认密码 <span className="badge badge-muted font-mono">Aa123456!</span>
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

      <div className="border-t border-line pt-4">
        <p className="field-label mb-2.5">演示账号 · 点一下直接登录</p>
        <div className="flex flex-wrap gap-2">
          {DEMO_ACCOUNTS.map((a) => (
            <button
              key={a.name}
              type="button"
              disabled={pending}
              onClick={() => loginAs(a.name)}
              className="btn btn-secondary btn-sm"
            >
              {a.role}（{a.name}）
            </button>
          ))}
        </div>
        <p className="field-hint mt-2.5">
          还有员工 李四、王五、赵六 … 吴十，密码统一 Aa123456!，可用姓名或已登记手机号登录。
        </p>
      </div>
    </form>
  );
}
