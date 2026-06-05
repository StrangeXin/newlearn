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

export function AddUserForm() {
  const [state, action, pending] = useActionState(addUserAction, initial);
  return (
    <form action={action} className="space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1">
          <label htmlFor="add-user-name" className="field-label">
            姓名
          </label>
          <input
            id="add-user-name"
            name="name"
            required
            placeholder="员工真实姓名"
            className="input"
          />
        </div>
        <div className="sm:w-28">
          <label htmlFor="add-user-role" className="field-label">
            角色
          </label>
          <select id="add-user-role" name="role" defaultValue="EMPLOYEE" className="select">
            <option value="EMPLOYEE">员工</option>
            <option value="ADMIN">管理员</option>
          </select>
        </div>
        <button type="submit" disabled={pending} className="btn btn-primary shrink-0">
          {pending ? "添加中…" : "添加"}
        </button>
      </div>
      {state?.error ? (
        <p className="field-error">{state.error}</p>
      ) : state?.ok ? (
        <p className="text-sm font-medium text-success-600">✓ 已添加，默认密码 Aa123456!</p>
      ) : (
        <p className="field-hint">姓名须唯一；初始密码 Aa123456!。</p>
      )}
    </form>
  );
}

export function ImportUsersForm() {
  const [state, action, pending] = useActionState(importUsersAction, initial);
  return (
    <form action={action} className="space-y-3">
      <div>
        <label htmlFor="import-names" className="field-label">
          姓名列表
        </label>
        <textarea
          id="import-names"
          name="names"
          rows={4}
          placeholder={"每行一个姓名，例如：\n张伟\n李娜\n王芳"}
          className="textarea min-h-28 font-mono"
        />
        <p className="field-hint mt-1.5">
          换行或逗号都行；重名自动跳过，全部按员工身份创建。
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending} className="btn btn-secondary">
          {pending ? "导入中…" : "批量导入"}
        </button>
        {state?.error ? (
          <span className="field-error">{state.error}</span>
        ) : state?.ok ? (
          <span className="text-sm font-medium text-success-600">✓ 已导入，重名已跳过</span>
        ) : null}
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
  const isError = msg.startsWith("✗");
  const run = (fn: () => Promise<AdminState>) =>
    start(async () => {
      setMsg("");
      const r = await fn();
      setMsg(r.error ? `✗ ${r.error}` : "✓ 已更新");
    });

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      {msg && (
        <span className={`text-xs font-medium ${isError ? "text-danger-600" : "text-success-600"}`}>
          {msg}
        </span>
      )}
      {canManageRole && (
        <select
          aria-label="设置该成员的角色"
          title="设置角色"
          defaultValue={role}
          disabled={pending}
          onChange={(e) => run(() => setRoleAction(userId, e.target.value))}
          className="select w-auto px-2 py-1 text-xs"
        >
          <option value="EMPLOYEE">设为员工</option>
          <option value="ADMIN">设为管理员</option>
          <option value="SUPERADMIN">设为超管</option>
        </select>
      )}
      <button
        type="button"
        disabled={pending}
        onClick={() => run(() => resetPasswordAction(userId))}
        title="重置为默认密码 Aa123456!，下次登录强制改密"
        className="btn btn-secondary btn-sm"
      >
        重置密码
      </button>
    </div>
  );
}
