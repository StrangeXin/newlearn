export function referencePointList(referencePoints?: string | null) {
  return (referencePoints ?? "")
    .split(/[;；]/)
    .map((point) => point.trim())
    .filter(Boolean)
    .slice(0, 5);
}

function termBase(term: string) {
  return term
    .replace(/\([^)]*\)/g, "")
    .replace(/[（(].*?[）)]/g, "")
    .trim();
}

function shortLabel(text: string) {
  const raw = text.replace(/[“”"']/g, "").trim();
  const patterns: Array<[RegExp, string]> = [
    [/从数据里学|数据里学/, "从数据学"],
    [/人写死规则|写死规则/, "写死规则"],
    [/举一反三|泛化/, "举一反三"],
    [/多层网络|层数越多|多层/, "多层网络"],
    [/自动学特征|学特征|复杂特征/, "自动抓特征"],
    [/大脑神经元|神经元/, "神经元"],
    [/简单单元|大量.*单元/, "简单单元"],
    [/解决问题.*步骤|算法=解决问题|步骤/, "解题步骤"],
    [/效率不同|效率/, "效率差异"],
    [/数量与质量|质量/, "质量"],
    [/好数据|数据.*原料|原料/, "数据原料"],
    [/计算资源|算力/, "计算资源"],
    [/训练.*推理|训练\/推理/, "训练/推理"],
    [/学习阶段|训练是学习/, "训练"],
    [/使用阶段|推理是使用/, "推理"],
    [/规则库|人工规则/, "规则库"],
    [/不会自学|自学/, "不会自学"],
    [/期望与现实|过度承诺|寒冬/, "期望落差"],
    [/弱 AI|弱AI|专才/, "专才"],
    [/强 AI|强AI|通才/, "通才"],
    [/公认定义|判定标准/, "定义未定"],
    [/海量|多样|快速产生/, "海量数据"],
    [/按需租用|租用/, "按需租用"],
    [/自建机房|机房/, "不用机房"],
    [/敏感数据|隐私|合规/, "隐私合规"],
    [/GPU|并行计算/, "并行计算"],
    [/开源可自部署|自部署/, "自部署"],
    [/闭源调用|接口/, "接口调用"],
    [/固定规则/, "固定规则"],
    [/会不会学|能学习/, "会不会学"],
    [/骗过人|像人/, "像人"],
    [/表现.*真懂|是否真懂/, "真懂吗"],
  ];
  for (const [pattern, label] of patterns) {
    if (pattern.test(raw)) return label;
  }

  let s = raw
    .replace(/即可|通常|主要|核心是|理解|衡量的是|同一|当前|今天|所有/g, "")
    .replace(/而非|不是/g, "≠")
    .replace(/它|这|一类|一大类|一种/g, "")
    .replace(/[，。、：:；;（）()]/g, " ")
    .trim();
  const chunks = s.split(/\s+/).filter(Boolean);
  s = chunks.find((x) => x.length >= 2 && x.length <= 6) ?? chunks[0] ?? s;
  return s.slice(0, 6);
}

function dedupe(xs: string[]) {
  const seen = new Set<string>();
  return xs.filter((x) => {
    const v = x.trim();
    if (!v || seen.has(v)) return false;
    seen.add(v);
    return true;
  });
}

function isNaturalLabel(label: string) {
  if (!label) return false;
  if (/[的了是有在为把]/.test(label) && !/[≠=→/]/.test(label)) return false;
  if (/^[A-Za-z]{1,2}$/.test(label)) return false;
  return label.length >= 2 && label.length <= 8;
}

export function keywordIllustrationLabels({
  term,
  description,
  referencePoints,
}: {
  term: string;
  description?: string | null;
  referencePoints?: string | null;
}) {
  const base = termBase(term);
  const points = referencePointList(referencePoints);
  const desc = description ?? "";
  const termLower = term.toLowerCase();
  const refsLower = (referencePoints ?? "").toLowerCase();
  const isAiIdentity =
    /人工智能|图灵测试|弱人工智能|强人工智能|通用人工智能|agi|ai 与自动化|ai vs automation/i.test(
      term,
    );

  const thematic = [
    base,
    termLower.includes("图灵") ? "真假难分" : "",
    termLower.includes("测试") ? "只看表现" : "",
    termLower.includes("机器学习") ? "从例子学" : "",
    termLower.includes("深度学习") ? "多层特征" : "",
    termLower.includes("神经网络") ? "神经元" : "",
    termLower.includes("算法") ? "步骤" : "",
    termLower === "数据(data)" || term === "数据(Data)" ? "原料" : "",
    termLower.includes("算力") || termLower.includes("gpu") ? "计算资源" : "",
    termLower.includes("模型") ? "成品大脑" : "",
    termLower.includes("训练") ? "上学" : "",
    termLower.includes("推理") ? "上班" : "",
    termLower.includes("符号") ? "规则推理" : "",
    termLower.includes("连接") ? "权重连接" : "",
    termLower.includes("专家系统") ? "规则库" : "",
    termLower.includes("寒冬") ? "期待落空" : "",
    termLower.includes("强人工智能") ? "通才" : "",
    termLower.includes("弱人工智能") ? "专才" : "",
    termLower.includes("agi") || termLower.includes("通用") ? "通用任务" : "",
    termLower.includes("大数据") ? "海量数据" : "",
    termLower.includes("云计算") ? "按需租用" : "",
    termLower.includes("开源") ? "可自部署" : "",
    termLower.includes("闭源") ? "接口调用" : "",
    termLower.includes("自动化") ? "固定规则" : "",
    isAiIdentity || desc.includes("像人") ? "像人≠人" : "",
  ];

  const pointLabels = points
    .map(shortLabel)
    .filter((label) => label !== "AI" || /(^|[^a-z])ai([^a-z]|$)/i.test(term))
    .filter((label) => label !== "原料" || /数据|大数据/.test(term) || /原料/.test(refsLower))
    .filter((label) => label !== "成品大脑" || /模型|训练|推理|大模型/.test(term))
    .filter(isNaturalLabel);
  return dedupe([...thematic, ...pointLabels].filter(isNaturalLabel)).slice(0, 7);
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
  const labels = keywordIllustrationLabels({ term, description, referencePoints });
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
    "Composition: 小黑正在操作一个和该关键词含义强相关的奇怪装置，把该词最有辨识度的动作、边界或隐喻画出来。只讲一个核心结构，不要平均展开所有知识点。",
    `Chinese handwritten labels: ${labels.join(" / ")}`,
    "",
    "Color use: Black for main line art and 小黑. Orange for main flow/path/arrows. Red only for key warnings/problems/results. Blue only for secondary notes or feedback/system state.",
    "",
    "Constraints: One image explains only one core structure. Keep the main subject around 40%-60% of the canvas. Preserve at least 35% blank white space. Use at most 5-8 short handwritten Chinese labels. Do not write a title in the top-left corner. Do not write the structure type on the image. Do not make it a formal diagram, course slide, or dense explainer. Do not copy prior examples or reuse known case compositions; invent a fresh visual metaphor for this specific keyword. It should be clear but not instructional, interesting but not childish, strange but clean.",
  ]
    .filter(Boolean)
    .join("\n");
}
