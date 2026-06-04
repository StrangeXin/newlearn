"use client";

import { useActionState } from "react";
import { saveProfileAction, type ProfileState } from "@/app/actions/profile";

const initial: ProfileState = {};
const inputClass =
  "mt-1 w-full rounded-xl border border-brand-200 bg-white px-4 py-2.5 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-200";

const familiarityOptions = ["入门（基本没接触）", "了解（知道一些概念）", "熟练（用过一些工具）", "精通（能落地应用）"];

export function OnboardingForm() {
  const [state, action, pending] = useActionState(saveProfileAction, initial);

  return (
    <form action={action} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="position" className="block text-sm font-medium text-ink">
            岗位
          </label>
          <input id="position" name="position" required placeholder="如：产品经理" className={inputClass} />
        </div>
        <div>
          <label htmlFor="department" className="block text-sm font-medium text-ink">
            部门
          </label>
          <input id="department" name="department" required placeholder="如：增长部" className={inputClass} />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="level" className="block text-sm font-medium text-ink">
            职级 / 工作年限
          </label>
          <input id="level" name="level" required placeholder="如：P6 / 5 年" className={inputClass} />
        </div>
        <div>
          <label htmlFor="aiFamiliarity" className="block text-sm font-medium text-ink">
            对 AI 的熟悉度
          </label>
          <select id="aiFamiliarity" name="aiFamiliarity" required defaultValue="" className={inputClass}>
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
        <label htmlFor="background" className="block text-sm font-medium text-ink">
          专业背景
        </label>
        <textarea
          id="background"
          name="background"
          required
          rows={2}
          placeholder="你的专业、擅长的技能、过往做过的领域"
          className={inputClass}
        />
      </div>

      <div>
        <label htmlFor="applicationAreas" className="block text-sm font-medium text-ink">
          最想把 AI 用在哪些工作
        </label>
        <textarea
          id="applicationAreas"
          name="applicationAreas"
          required
          rows={2}
          placeholder="如：用户增长分析、自动化文案、需求挖掘…"
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
        {pending ? "保存中…" : "开始闯关"}
      </button>
    </form>
  );
}
