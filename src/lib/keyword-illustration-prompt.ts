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
    "Generate one standalone 16:9 horizontal Chinese pre-learning illustration for an employee AI learning platform.",
    "",
    "Visual DNA from Ian Xiaohei illustrations: pure white background; minimalist black hand-drawn line art; slightly wobbly pen lines; lots of empty white space; sparse red/orange/blue handwritten Chinese annotations; clean absurd product-sketch feeling. It should feel like a product/AI person explaining an idea on blank paper, not like commercial art.",
    "",
    "Recurring IP character required: 小黑, a small solid-black absurd creature with white dot eyes, tiny thin legs, blank serious expression, slightly uneven hand-drawn body shape. 小黑 is a deadpan system operator doing an absurd but meaningful job. 小黑 must perform the core conceptual action; if removing 小黑 would not change the meaning, the illustration fails.",
    "",
    "Learning purpose: The learner will see the term, description, and this illustration before searching Doubao/DeepSeek and writing a study note. The image must help them know what to search, what relationship to understand, and what common mistake to avoid.",
    "",
    `Theme: ${term}`,
    `Learner-facing description: ${description ?? "把这个关键词的关键机制画成一个怪诞但清楚的学习隐喻。"}`,
    points.length > 0 ? `Cognitive anchors: ${points.join(" / ")}` : "",
    "",
    "Visual explanation plan:",
    "Problem scene: <write a specific scene for this keyword before generating the image>",
    "Core mechanism: <write the one mechanism/process/relationship the learner must understand>",
    "Misconception boundary: <write the most important trap or boundary>",
    "Search anchor labels: <write 3-6 short Chinese labels that guide what to search next>",
    "Composition pattern: <choose exactly one: workflow / system fragment / before-after contrast / role state / concept metaphor / layered method / route map / 2-4 panel mini comic>",
    "Physical metaphor: <turn the abstract concept into one low-tech object/action such as box, drawer, old machine, funnel, scale, mailbox, door, well, ladder, pipe, spool, valve, turntable, black box, hole puncher, noodle press, clothesline, weird desk>",
    "Xiaohei action: <choose one meaningful action: pull, carry, stuff, fish out, press, weigh, stitch, cut, twist, guard, push, catch, unpack, mark, recycle>",
    "",
    "Composition requirements: Make the problem scene, core mechanism, and misconception boundary visible as one coherent hand-drawn scene. 小黑 must be doing the central learning action. The viewer should understand the keyword better even before reading a long explanation.",
    "Chinese handwritten labels: <same as Search anchor labels, no long sentences>",
    "",
    "Color use: Black for main line art and 小黑. Orange for main flow/path/arrows. Red only for key warnings/problems/results. Blue only for secondary notes or feedback/system state.",
    "",
    "Hard constraints: One image explains only one core structure. Keep the main subject around 40%-60% of the canvas. Preserve at least 35% blank white space. Use at most 3-6 short handwritten Chinese labels, each 2-8 Chinese characters if possible. Do not write a title in the top-left corner. Do not write the structure type on the image. Do not make it a formal diagram, course slide, dense explainer, commercial vector illustration, cute mascot poster, children's illustration, realistic UI, tech dashboard, complex architecture, gradient, shadow, paper texture, beige background, or noisy background.",
    "",
    "Originality constraints: Do not copy known Ian Xiaohei example compositions such as conveyor belt breakpoints, Xiaohei pulling a judgment lever inside a machine, Xiaohei as a funnel, cutting a material fish, pulling a route path, pulling three information sources, three Xiaohei with megaphone/bridge/door, stamping a toolbox, or holding signs along a common-pit path. Invent a fresh metaphor for this keyword.",
    "",
    "QA before final image: Xiaohei is core action subject; white background; sparse readable Chinese labels; not PPT-like; not cute; not generic AI art; not too many nodes/arrows; visually teaches the keyword within one second.",
  ]
    .filter(Boolean)
    .join("\n");
}
