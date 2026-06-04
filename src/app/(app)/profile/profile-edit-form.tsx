"use client";

import { useActionState } from "react";
import { editProfileAction, type EditProfileState } from "@/app/actions/profile";

const initial: EditProfileState = {};
const inputClass =
  "mt-1 w-full rounded-xl border border-brand-200 bg-white px-4 py-2.5 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-200";

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
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="block text-sm font-medium text-ink">岗位</label>
          <input name="position" required defaultValue={values.position} className={inputClass} />
        </div>
        <div>
          <label className="block text-sm font-medium text-ink">部门</label>
          <input name="department" required defaultValue={values.department} className={inputClass} />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="block text-sm font-medium text-ink">职级 / 工作年限</label>
          <input name="level" required defaultValue={values.level} className={inputClass} />
        </div>
        <div>
          <label className="block text-sm font-medium text-ink">对 AI 的熟悉度</label>
          <select name="aiFamiliarity" required defaultValue={values.aiFamiliarity} className={inputClass}>
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
        <label className="block text-sm font-medium text-ink">专业背景</label>
        <textarea name="background" required rows={2} defaultValue={values.background} className={inputClass} />
      </div>
      <div>
        <label className="block text-sm font-medium text-ink">最想把 AI 用在哪些工作</label>
        <textarea
          name="applicationAreas"
          required
          rows={2}
          defaultValue={values.applicationAreas}
          className={inputClass}
        />
      </div>

      {state?.error && (
        <p className="rounded-lg bg-danger-500/10 px-3 py-2 text-sm text-danger-500">{state.error}</p>
      )}
      {state?.ok && (
        <p className="rounded-lg bg-success-500/10 px-3 py-2 text-sm text-success-500">已保存 ✓</p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="rounded-xl bg-brand-600 px-5 py-2.5 font-semibold text-white shadow-lg shadow-brand-600/30 transition hover:bg-brand-700 disabled:opacity-60"
      >
        {pending ? "保存中…" : "保存资料"}
      </button>
    </form>
  );
}
