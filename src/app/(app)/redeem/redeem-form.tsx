"use client";

import { useActionState } from "react";
import { requestRedemptionAction, type RedeemState } from "@/app/actions/redemption";

const initial: RedeemState = {};

export function RedeemForm({ available }: { available: number }) {
  const [state, action, pending] = useActionState(requestRedemptionAction, initial);
  const disabled = available <= 0;

  return (
    <form action={action} className="space-y-3">
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
          <p className="field-hint">可用 {available} 积分，可只兑一部分，剩下的留着下次。</p>
        </div>
        <div>
          <label htmlFor="redeem-attachment" className="field-label">
            凭证 / 链接（可选）
          </label>
          <input
            id="redeem-attachment"
            name="attachment"
            placeholder="商品链接或截图地址，方便管理员核对"
            className="input"
          />
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
          申请已提交，这笔额度先记为待审批占用，通过后即扣分到账。
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
          通过更多关键词就能攒积分，终评 ≥ 60 分即得 1 积分。
        </p>
      )}
    </form>
  );
}
