"use client";

import { useActionState } from "react";
import { saveProfileAction, type ProfileState } from "@/app/actions/profile";

const initial: ProfileState = {};

const familiarityOptions = ["入门（基本没接触）", "了解（知道一些概念）", "熟练（用过一些工具）", "精通（能落地应用）"];

export function OnboardingForm() {
  const [state, action, pending] = useActionState(saveProfileAction, initial);

  return (
    <form action={action} className="space-y-5">
      {/* 第一组：你的工作，决定追问从哪个岗位视角发问 */}
      <fieldset className="space-y-3">
        <legend className="text-sm font-semibold text-ink">你的工作</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="position" className="field-label">
              岗位
            </label>
            <input id="position" name="position" required placeholder="如：产品经理" className="input" />
            <p className="field-hint mt-1.5">追问会从这个岗位的视角发问。</p>
          </div>
          <div>
            <label htmlFor="department" className="field-label">
              部门
            </label>
            <input id="department" name="department" required placeholder="如：增长部" className="input" />
            <p className="field-hint mt-1.5">帮 AI 理解你日常打交道的业务。</p>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="level" className="field-label">
              职级 / 工作年限
            </label>
            <input id="level" name="level" required placeholder="如：P6 / 5 年" className="input" />
            <p className="field-hint mt-1.5">决定追问的深浅，老手不会被问基础题。</p>
          </div>
          <div>
            <label htmlFor="aiFamiliarity" className="field-label">
              对 AI 的熟悉度
            </label>
            <select id="aiFamiliarity" name="aiFamiliarity" required defaultValue="" className="select">
              <option value="" disabled>
                请选择
              </option>
              {familiarityOptions.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
            <p className="field-hint mt-1.5">凭直觉选，之后学习会自动校准。</p>
          </div>
        </div>
      </fieldset>

      {/* 第二组：你的背景与目标，决定追问往哪个方向追 */}
      <fieldset className="space-y-3">
        <legend className="text-sm font-semibold text-ink">你的背景与目标</legend>
        <div>
          <label htmlFor="background" className="field-label">
            专业背景
          </label>
          <textarea
            id="background"
            name="background"
            required
            rows={2}
            placeholder="你的专业、擅长的技能、过往做过的领域"
            className="textarea min-h-0"
          />
          <p className="field-hint mt-1.5">AI 会借此把陌生概念类比到你已经懂的东西上。</p>
        </div>

        <div>
          <label htmlFor="applicationAreas" className="field-label">
            最想把 AI 用在哪些工作
          </label>
          <textarea
            id="applicationAreas"
            name="applicationAreas"
            required
            rows={2}
            placeholder="如：用户增长分析、自动化文案、需求挖掘…"
            className="textarea min-h-0"
          />
          <p className="field-hint mt-1.5">写得越具体，追问越能落到你真正想解决的场景。</p>
        </div>
      </fieldset>

      {state?.error && (
        <p className="badge-danger rounded-lg px-3 py-2 text-sm font-medium" role="alert">
          {state.error}
        </p>
      )}

      <div className="space-y-2.5">
        <button type="submit" disabled={pending} className="btn btn-primary btn-block btn-lg">
          {pending ? "保存中…" : "保存资料，进入第 1 关"}
        </button>
        <p className="text-center text-xs text-muted">资料只用于个性化你的学习，之后在「我的资料」里随时能改。</p>
      </div>
    </form>
  );
}
