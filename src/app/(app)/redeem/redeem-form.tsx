"use client";

import { useActionState } from "react";
import { requestRedemptionAction, type RedeemState } from "@/app/actions/redemption";

const initial: RedeemState = {};
const inputClass =
  "mt-1 w-full rounded-xl border border-brand-200 bg-white px-4 py-2.5 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-200";

export function RedeemForm({ available }: { available: number }) {
  const [state, action, pending] = useActionState(requestRedemptionAction, initial);
  const disabled = available <= 0;

  return (
    <form action={action} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-ink">兑换物品 / 工具</label>
        <input
          name="item"
          required
          placeholder="如：技术书籍《深度学习》、ChatGPT Plus 会员…"
          className={inputClass}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="block text-sm font-medium text-ink">
            兑换金额（元 = 积分）
          </label>
          <input
            name="amount"
            type="number"
            min={1}
            max={Math.max(1, available)}
            required
            placeholder={`最多 ${available}`}
            className={inputClass}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-ink">凭证 / 链接（可选）</label>
          <input name="attachment" placeholder="商品链接或截图地址" className={inputClass} />
        </div>
      </div>

      {state?.error && (
        <p className="rounded-lg bg-danger-500/10 px-3 py-2 text-sm text-danger-500">{state.error}</p>
      )}
      {state?.ok && (
        <p className="rounded-lg bg-success-500/10 px-3 py-2 text-sm text-success-500">
          已提交，等待管理员审批 ✓
        </p>
      )}

      <button
        type="submit"
        disabled={pending || disabled}
        className="rounded-xl bg-brand-600 px-6 py-2.5 font-semibold text-white shadow-lg shadow-brand-600/30 transition hover:bg-brand-700 disabled:opacity-50"
      >
        {pending ? "提交中…" : disabled ? "暂无可用积分" : "提交兑换申请"}
      </button>
    </form>
  );
}
