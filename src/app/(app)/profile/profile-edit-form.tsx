"use client";

import { useActionState } from "react";
import { editProfileAction, type EditProfileState } from "@/app/actions/profile";

const initial: EditProfileState = {};

const familiarityOptions = [
  "入门（基本没接触）",
  "了解（知道一些概念）",
  "熟练（用过一些工具）",
  "精通（能落地应用）",
];

export interface ProfileValues {
  position: string;
  department: string;
  level: string;
  background: string;
  aiFamiliarity: string;
  applicationAreas: string;
}

export function ProfileEditForm({ values }: { values: ProfileValues }) {
  const [state, action, pending] = useActionState(editProfileAction, initial);

  return (
    <form action={action} className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="field-label">岗位</label>
          <input name="position" required defaultValue={values.position} className="input" />
        </div>
        <div>
          <label className="field-label">部门</label>
          <input name="department" required defaultValue={values.department} className="input" />
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="field-label">职级 / 工作年限</label>
          <input name="level" required defaultValue={values.level} className="input" />
        </div>
        <div>
          <label className="field-label">对 AI 的熟悉度</label>
          <select name="aiFamiliarity" required defaultValue={values.aiFamiliarity} className="select">
            <option value="" disabled>
              请选择
            </option>
            {familiarityOptions.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <label className="field-label">专业背景</label>
        <textarea
          name="background"
          required
          rows={2}
          defaultValue={values.background}
          className="textarea min-h-0"
        />
        <p className="field-hint mt-1">学过什么专业、做过哪些领域，AI 会据此调整例子的深浅。</p>
      </div>
      <div>
        <label className="field-label">最想把 AI 用在哪些工作</label>
        <textarea
          name="applicationAreas"
          required
          rows={2}
          defaultValue={values.applicationAreas}
          className="textarea min-h-0"
        />
        <p className="field-hint mt-1">越具体越好，比如「帮我写周报、整理客户反馈」，追问会往这上面靠。</p>
      </div>

      {state?.error && (
        <p className="field-error rounded-lg bg-danger-500/10 px-3 py-2" role="alert">
          {state.error}
        </p>
      )}

      <div className="flex items-center gap-3">
        <button type="submit" disabled={pending} className="btn btn-primary">
          {pending ? "保存中…" : "保存资料"}
        </button>
        {state?.ok && (
          <span className="text-sm font-medium text-success-600">已保存 ✓</span>
        )}
      </div>
    </form>
  );
}
