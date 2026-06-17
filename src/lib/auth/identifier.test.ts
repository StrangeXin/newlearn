import { describe, expect, it } from "vitest";
import { normalizeLoginName, normalizeOptionalPhone, phoneSchema } from "./identifier";

describe("登录标识规范化", () => {
  it("规范化姓名登录名", () => {
    expect(normalizeLoginName("  Alice  ")).toBe("alice");
  });

  it("规范化可选手机号", () => {
    expect(normalizeOptionalPhone("")).toBeNull();
    expect(normalizeOptionalPhone("138 0013-8000")).toBe("13800138000");
  });

  it("拒绝非法手机号", () => {
    expect(phoneSchema.safeParse("12345").success).toBe(false);
    expect(phoneSchema.safeParse("12800138000").success).toBe(false);
  });
});
