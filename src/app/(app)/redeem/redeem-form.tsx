"use client";

import { useActionState } from "react";
import { requestRedemptionAction, type RedeemState } from "@/app/actions/redemption";
import { ATTACHMENT_ACCEPT, MAX_ATTACHMENT_MB } from "@/lib/upload";

const initial: RedeemState = {};

export function RedeemForm({ available }: { available: number }) {
  const [state, action, pending] = useActionState(requestRedemptionAction, initial);
  const disabled = available <= 0;

  return (
    <form action={action} className="space-y-4">
      <div className="space-y-4">
        <div>
          <label htmlFor="redeem-item" className="field-label">
            兑换物品 / 工具
          </label>
          <input
            id="redeem-item"
            name="item"
            required
            placeholder="如：技术书籍《深度学习》、ChatGPT Plus 会员…"
            className="input"
          />
        </div>
        <div>
          <label htmlFor="redeem-category" className="field-label">
            类别
          </label>
          <select id="redeem-category" name="category" defaultValue="OTHER" className="input">
            <option value="BOOK">书籍</option>
            <option value="TOOL">工具 / 软件</option>
            <option value="COURSE">课程 / 会员</option>
            <option value="OTHER">其他</option>
          </select>
          <p className="field-hint mt-1">通过后会出现在「大家兑换了什么」，方便同事借用或共用。</p>
        </div>
        <div>
          <label htmlFor="redeem-amount" className="field-label">
            兑换金额
          </label>
          <div className="relative">
            <input
              id="redeem-amount"
              name="amount"
              type="number"
              min={1}
              max={Math.max(1, available)}
              required
              placeholder={`最多 ${available}`}
              className="input pr-12 tabular-nums"
            />
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm font-medium text-muted">
              元
            </span>
          </div>
          <p className="field-hint mt-1">可只兑一部分，剩的留着下次。</p>
        </div>
        <div>
          <label htmlFor="redeem-attachment" className="field-label">
            报销凭证（可选）
          </label>
          <input
            id="redeem-attachment"
            name="file"
            type="file"
            accept={ATTACHMENT_ACCEPT}
            className="input h-auto py-2 file:mr-3 file:rounded-md file:border-0 file:bg-brand-50 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-brand-700"
          />
          <p className="field-hint mt-1">
            支持 PNG/JPG/WebP 或 PDF，不超过 {MAX_ATTACHMENT_MB}MB。
          </p>
        </div>
      </div>

      {state?.error && (
        <p className="rounded-lg bg-danger-500/10 px-3 py-2 text-sm font-medium text-danger-600" role="alert">
          {state.error}
        </p>
      )}
      {state?.ok && (
        <p
          className="rounded-lg bg-accent-100 px-3 py-2 text-sm font-medium text-accent-700"
          role="status"
        >
          已提交，待审批。审批期间这笔额度会冻结。
        </p>
      )}

      <div className="flex flex-col gap-2 pt-1 sm:flex-row sm:items-center sm:justify-between">
        <button
          type="submit"
          disabled={pending || disabled}
          className="btn btn-primary btn-block sm:w-auto"
        >
          {pending ? "提交中…" : disabled ? "暂无可用积分" : "提交兑换申请"}
        </button>
        {disabled ? (
          <p className="field-hint sm:text-right">
            终评 ≥ 60 分即可获得积分。
          </p>
        ) : (
          <p className="field-hint sm:text-right">
            可用额度 <span className="font-semibold text-accent-700">{available}</span> 元
          </p>
        )}
      </div>
    </form>
  );
}
