import type { AssistantHistoryMessage, AssistantPageContext, AssistantSkill } from "@/lib/assistant/types";
import { assistantSkills as legacyAssistantSkills } from "@/lib/assistant/skills";
import { leaderboardCapabilityProvider } from "./leaderboard";
import { selfProfileCapabilityProvider } from "./self-profile";

export interface AssistantCapabilityProvider {
  id: string;
  description: string;
  getSkills: () => AssistantSkill[];
}

function skillsByName(names: string[]) {
  return legacyAssistantSkills.filter((skill) => names.includes(skill.name));
}

function legacyProvider(
  id: string,
  description: string,
  skillNames: string[],
): AssistantCapabilityProvider {
  return {
    id,
    description,
    getSkills: () => skillsByName(skillNames),
  };
}

const providers: AssistantCapabilityProvider[] = [
  selfProfileCapabilityProvider,
  leaderboardCapabilityProvider,
  legacyProvider(
    "learning-progress",
    "Learner-facing progress and schedule capability backed by learn/schedule services.",
    ["learning-progress"],
  ),
  legacyProvider(
    "personal-account",
    "Learner-facing points account capability backed by redemption ledger services.",
    ["personal-account"],
  ),
  legacyProvider(
    "redemption",
    "Redemption draft capability; write operations require explicit confirmation.",
    ["redemption"],
  ),
  legacyProvider(
    "learning-context",
    "Keyword coaching and peer-note context capabilities backed by learn/social services.",
    ["keyword-coach", "peer-summary"],
  ),
  legacyProvider(
    "admin-insights",
    "Admin read-only platform overview and operations insight capability.",
    ["admin-insights"],
  ),
  legacyProvider(
    "admin-learners",
    "Admin learner detail and keyword analytics capability backed by stats and progress services.",
    ["admin-learner-detail"],
  ),
  legacyProvider(
    "automation-draft",
    "Reminder and background-task draft capability; scheduling is not enabled yet.",
    ["automation-draft"],
  ),
];

export function getAssistantCapabilityProviders() {
  return providers;
}

export function getAssistantSkills(): AssistantSkill[] {
  return providers.flatMap((provider) => provider.getSkills());
}

export function selectAssistantSkills(
  message: string,
  page: AssistantPageContext,
  history: AssistantHistoryMessage[] = [],
): AssistantSkill[] {
  const text = message.trim().toLowerCase();
  return getAssistantSkills().filter((skill) =>
    skill.tools.some((tool) => tool.match(text, page, history)),
  );
}
