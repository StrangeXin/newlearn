import { describe, expect, it } from "vitest";
import { existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { assistantCapabilityCoverage } from "./coverage";
import { getAssistantCapabilityProviders, getAssistantSkills } from "./registry";

function walk(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

function surfaceFromAppFile(path: string) {
  return path
    .replace(/^src\/app/, "")
    .replace(/\/\(app\)|\/\(auth\)/g, "")
    .replace(/\/page\.tsx$/, "")
    .replace(/\/route\.ts$/, "")
    .replace(/\/index$/, "")
    .replace(/\/$/, "") || "/";
}

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

  it("declares every app page and route surface", () => {
    const declared = new Set(assistantCapabilityCoverage.map((item) => item.surface));
    const files = walk("src/app").filter(
      (path) => path.endsWith("/page.tsx") || path.endsWith("/route.ts"),
    );
    const missing = files
      .map(surfaceFromAppFile)
      .filter((surface) => !declared.has(surface))
      .sort();

    expect(missing).toEqual([]);
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
      "getSelfKeywordTimeline",
    ]);
  });
});
