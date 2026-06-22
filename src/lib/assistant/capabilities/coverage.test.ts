import { describe, expect, it } from "vitest";
import { assistantCapabilityCoverage } from "./coverage";
import { getAssistantCapabilityProviders, getAssistantSkills } from "./registry";

describe("assistant capability coverage", () => {
  it("maps every covered surface to a registered provider", () => {
    const providerIds = new Set(getAssistantCapabilityProviders().map((provider) => provider.id));
    const broken = assistantCapabilityCoverage.filter(
      (item) =>
        (item.status === "covered" || item.status === "confirm-write") &&
        (!item.providerId || !providerIds.has(item.providerId)),
    );

    expect(broken).toEqual([]);
  });

  it("keeps intentional exclusions documented", () => {
    const undocumented = assistantCapabilityCoverage.filter(
      (item) => item.status === "not-exposed" && !item.reason,
    );

    expect(undocumented).toEqual([]);
  });

  it("registers one provider per major assistant business domain", () => {
    const providerIds = getAssistantCapabilityProviders().map((provider) => provider.id);

    expect(providerIds).toEqual([
      "self-profile",
      "leaderboard",
      "learning-progress",
      "personal-account",
      "redemption",
      "learning-context",
      "admin-insights",
      "admin-learners",
      "automation-draft",
    ]);
  });

  it("exposes current-user profile tools through the registry", () => {
    const skill = getAssistantSkills().find((item) => item.name === "self-profile");

    expect(skill?.tools.map((tool) => tool.name)).toEqual([
      "getSelfOverview",
      "getSelfProfile",
      "getSelfPortrait",
    ]);
  });
});

