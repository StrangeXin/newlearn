export function referencePointList(referencePoints?: string | null) {
  return (referencePoints ?? "")
    .split(/[;；]/)
    .map((point) => point.trim())
    .filter(Boolean)
    .slice(0, 5);
}

export function buildKeywordIllustrationPrompt({
  term,
  description,
  referencePoints,
}: {
  term: string;
  description?: string | null;
  referencePoints?: string | null;
}) {
  const points = referencePointList(referencePoints);
  return [
    "Generate one standalone 16:9 horizontal Chinese article illustration.",
    "",
    "Visual DNA: Pure white background. Minimalist black hand-drawn line art. Slightly wobbly pen lines. Lots of empty white space. Sparse red/orange/blue handwritten Chinese annotations. Clean absurd product-sketch feeling. No gradients, no shadows, no paper texture, no complex background, no commercial vector style, no PPT infographic look, no cute mascot poster, no children's illustration, no realistic UI.",
    "",
    "Recurring IP character required: 小黑, a small solid-black absurd creature with white dot eyes, tiny thin legs, blank serious expression, slightly uneven hand-drawn body shape. 小黑 must perform the core conceptual action, not decorate the scene. Make 小黑 serious, deadpan, and slightly bizarre, not cute.",
    "",
    `Theme: ${term}`,
    `Core idea: ${description ?? "把这个关键词的关键机制画成一个怪诞但清楚的学习隐喻。"}`,
    points.length > 0 ? `Cognitive anchors: ${points.join(" / ")}` : "",
    "",
    "Composition: 小黑正在操作一个和该关键词含义强相关的奇怪装置，把关键词的输入、过程、边界和输出画成一眼能懂的动作。只讲一个核心结构，不要平均展开所有知识点。",
    `Chinese handwritten labels: ${["输入", "过程", "边界", "输出", ...points].slice(0, 8).join(" / ")}`,
    "",
    "Color use: Black for main line art and 小黑. Orange for main flow/path/arrows. Red only for key warnings/problems/results. Blue only for secondary notes or feedback/system state.",
    "",
    "Constraints: One image explains only one core structure. Keep the main subject around 40%-60% of the canvas. Preserve at least 35% blank white space. Use at most 5-8 short handwritten Chinese labels. Do not write a title in the top-left corner. Do not write the structure type on the image. Do not make it a formal diagram, course slide, or dense explainer. Do not copy prior examples or reuse known case compositions; invent a fresh visual metaphor for this specific keyword. It should be clear but not instructional, interesting but not childish, strange but clean.",
  ]
    .filter(Boolean)
    .join("\n");
}
