import "dotenv/config";

// 集成测试一律用确定性 Mock 评分器（不打真实 DeepSeek、不花钱、可断言）
process.env.SCORING_PROVIDER = "mock";
