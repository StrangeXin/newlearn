import type { AssistantHistoryMessage, AssistantPageContext, AssistantSkill } from "@/lib/assistant/types";
import { assistantSkills as legacyAssistantSkills } from "@/lib/assistant/skills";
import { leaderboardCapabilityProvider } from "./leaderboard";

export interface AssistantCapabilityProvider {
  id: string;
  description: string;
  getSkills: () => AssistantSkill[];
}

const providers: AssistantCapabilityProvider[] = [
  leaderboardCapabilityProvider,
  {
    id: "legacy-assistant-skills",
    description: "Existing assistant capability modules awaiting gradual extraction.",
    getSkills: () => legacyAssistantSkills,
  },
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
