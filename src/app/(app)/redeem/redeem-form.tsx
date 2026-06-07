"use client";

import { useActionState } from "react";
import { requestRedemptionAction, type RedeemState } from "@/app/actions/redemption";
import { ATTACHMENT_ACCEPT, MAX_ATTACHMENT_MB } from "@/lib/upload";

const initial: RedeemState = {};

export function RedeemForm({
  available,
  subjectId,
}: {
  available: number;
  subjectId: string;
}) {
  const [state, action, pending] = useActionState(requestRedemptionAction, initial);
  const disabled = available <= 0;

  return (
    <form action={action} className="space-y-3">
      {/* 积分按学科隔离：申请绑定当前学科 */}
      <input type="hidden" name="subjectId" value={subjectId} />
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
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
        <label htmlFor="redeem-amount" className="field-label">
          兑换金额（积分 = 元）
        </label>
        <input
          id="redeem-amount"
          name="amount"
          type="number"
          min={1}
          max={Math.max(1, available)}
          required
          placeholder={`最多 ${available}`}
          className="input"
        />
        <p className="field-hint">可只兑一部分，剩的留着下次。</p>
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
          <p className="field-hint">支持截图（PNG/JPG/WebP）或 PDF，不超过 {MAX_ATTACHMENT_MB}MB。</p>
        </div>
      </div>

      {state?.error && (
        <p className="field-error" role="alert">
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

      <button
        type="submit"
        disabled={pending || disabled}
        className="btn btn-primary btn-block sm:w-auto"
      >
        {pending ? "提交中…" : disabled ? "暂无可用积分" : "提交兑换申请"}
      </button>
      {disabled && (
        <p className="field-hint">
          通过关键词就能攒积分，终评 ≥ 60 分即得 1 积分。
        </p>
      )}
    </form>
  );
}
