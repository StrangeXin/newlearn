"use client";

import { useActionState, useState, useTransition } from "react";
import {
  addUserAction,
  importUsersAction,
  resetPasswordAction,
  setRoleAction,
  type AdminState,
} from "@/app/actions/admin";

const initial: AdminState = {};
const inputClass =
  "rounded-xl border border-brand-200 bg-white px-3 py-2 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-200";

export function AddUserForm() {
  const [state, action, pending] = useActionState(addUserAction, initial);
  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      <input name="name" required placeholder="姓名" className={inputClass} />
      <select name="role" defaultValue="EMPLOYEE" className={inputClass}>
        <option value="EMPLOYEE">员工</option>
        <option value="ADMIN">管理员</option>
      </select>
      <button
        type="submit"
        disabled={pending}
        className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-50"
      >
        添加
      </button>
      {state?.error && <span className="text-sm text-danger-500">{state.error}</span>}
      {state?.ok && <span className="text-sm text-success-500">已添加 ✓</span>}
    </form>
  );
}

export function ImportUsersForm() {
  const [state, action, pending] = useActionState(importUsersAction, initial);
  return (
    <form action={action} className="space-y-2">
      <textarea
        name="names"
        rows={4}
        placeholder="批量导入：每行一个姓名"
        className={`w-full ${inputClass}`}
      />
      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-xl border border-brand-200 px-4 py-2 text-sm font-semibold text-brand-700 transition hover:bg-brand-50 disabled:opacity-50"
        >
          批量导入
        </button>
        {state?.error && <span className="text-sm text-danger-500">{state.error}</span>}
        {state?.ok && <span className="text-sm text-success-500">已导入 ✓</span>}
      </div>
    </form>
  );
}

export function UserRowActions({
  userId,
  role,
  canManageRole,
}: {
  userId: string;
  role: string;
  canManageRole: boolean;
}) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState("");
  const run = (fn: () => Promise<AdminState>) =>
    start(async () => {
      setMsg("");
      const r = await fn();
      setMsg(r.error ? `✗ ${r.error}` : "✓");
    });

  return (
    <div className="flex items-center gap-2">
      {msg && <span className="text-xs text-muted">{msg}</span>}
      {canManageRole && (
        <select
          defaultValue={role}
          disabled={pending}
          onChange={(e) => run(() => setRoleAction(userId, e.target.value))}
          className="rounded-lg border border-brand-200 bg-white px-2 py-1 text-xs"
        >
          <option value="EMPLOYEE">员工</option>
          <option value="ADMIN">管理员</option>
          <option value="SUPERADMIN">超管</option>
        </select>
      )}
      <button
        type="button"
        disabled={pending}
        onClick={() => run(() => resetPasswordAction(userId))}
        className="rounded-lg border border-brand-200 px-2.5 py-1 text-xs font-medium text-muted transition hover:bg-brand-50 disabled:opacity-50"
      >
        重置密码
      </button>
    </div>
  );
}
