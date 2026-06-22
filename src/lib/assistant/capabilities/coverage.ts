export type AssistantCapabilityCoverageStatus =
  | "covered"
  | "confirm-write"
  | "not-exposed";

export interface AssistantCapabilityCoverageItem {
  surface: string;
  owner: string;
  status: AssistantCapabilityCoverageStatus;
  providerId?: string;
  reason?: string;
}

export const assistantCapabilityCoverage: AssistantCapabilityCoverageItem[] = [
  { surface: "/", owner: "public landing", status: "not-exposed", reason: "Public unauthenticated marketing page is outside assistant sessions." },
  { surface: "/profile", owner: "self profile", status: "covered", providerId: "self-profile" },
  { surface: "/growth", owner: "learning portrait timeline", status: "covered", providerId: "self-profile" },
  { surface: "/learn", owner: "subject progress", status: "covered", providerId: "learning-progress" },
  { surface: "/learn/[subjectId]", owner: "subject map", status: "covered", providerId: "learning-progress" },
  { surface: "/learn/[subjectId]/certificate", owner: "completion certificate", status: "covered", providerId: "learning-progress" },
  { surface: "/learn/[subjectId]/chapter/[index]/reflect", owner: "chapter reflection", status: "not-exposed", reason: "Reflection is a user-authored memory-changing flow; assistant may navigate but not submit it." },
  { surface: "/learn/keyword/[id]", owner: "keyword coaching", status: "covered", providerId: "learning-context" },
  { surface: "/leaderboard", owner: "leaderboard", status: "covered", providerId: "leaderboard" },
  { surface: "/leaderboard/[userId]", owner: "peer public profile", status: "covered", providerId: "learning-context" },
  { surface: "/redeem", owner: "points and redemption", status: "covered", providerId: "personal-account" },
  { surface: "requestRedemptionAction", owner: "redemption request", status: "confirm-write", providerId: "redemption" },
  { surface: "/admin", owner: "admin overview", status: "covered", providerId: "admin-insights" },
  { surface: "/admin/stats", owner: "admin stats", status: "covered", providerId: "admin-insights" },
  { surface: "/admin/learners", owner: "learner roster", status: "covered", providerId: "admin-learners" },
  { surface: "/admin/learners/[userId]", owner: "learner detail", status: "covered", providerId: "admin-learners" },
  { surface: "/admin/rankings", owner: "chapter rankings", status: "covered", providerId: "leaderboard" },
  { surface: "/admin/redemptions", owner: "redemption approvals", status: "covered", providerId: "admin-insights" },
  { surface: "/admin/users", owner: "user management", status: "not-exposed", reason: "Account mutation actions stay in admin UI; no assistant write capability without a dedicated confirmation design." },
  { surface: "/admin/content", owner: "content management", status: "not-exposed", reason: "Content mutations stay in admin UI until capability schemas and confirmations are designed." },
  { surface: "/admin/ai-logs", owner: "AI audit logs", status: "not-exposed", reason: "Audit logs are sensitive admin diagnostics and are intentionally not exposed through chat." },
  { surface: "saveProfileAction", owner: "onboarding profile creation", status: "not-exposed", reason: "Onboarding remains an explicit form flow; assistant can navigate but not submit profile data." },
  { surface: "editProfileAction", owner: "profile editing", status: "not-exposed", reason: "Profile edits are user-authored form writes and need a dedicated confirmation design before chat exposure." },
  { surface: "addUserAction/importUsersAction/resetPasswordAction/setRoleAction", owner: "admin user management writes", status: "not-exposed", reason: "Account and role mutations stay in admin UI; no assistant write capability without dedicated confirmations." },
  { surface: "approveRedemptionAction/rejectRedemptionAction", owner: "redemption approval writes", status: "not-exposed", reason: "Approval actions stay in admin UI until assistant approval confirmations are designed." },
  { surface: "/onboarding", owner: "profile creation", status: "not-exposed", reason: "First-login onboarding remains a form flow; assistant can navigate but not fill it." },
  { surface: "/change-password", owner: "password change", status: "not-exposed", reason: "Credential flows are intentionally excluded from assistant tools." },
  { surface: "/login", owner: "authentication", status: "not-exposed", reason: "Authentication is outside authenticated assistant sessions." },
  { surface: "/api/assistant/chat", owner: "assistant transport", status: "not-exposed", reason: "This is the Agent transport itself, not a capability exposed to the Agent." },
  { surface: "/api/assistant/history", owner: "assistant history", status: "not-exposed", reason: "Conversation history is internal transport state, not a callable business capability." },
  { surface: "/api/assistant/confirm", owner: "assistant confirmations", status: "confirm-write", providerId: "redemption" },
  { surface: "/api/learn/submit", owner: "note submission", status: "not-exposed", reason: "Learning submission flow is interactive and user-authored; no chat write proxy." },
  { surface: "/api/learn/finalize", owner: "followup finalization", status: "not-exposed", reason: "Scoring finalization remains inside keyword flow to preserve consent and UI state." },
  { surface: "/api/learn/ask", owner: "keyword followup Q&A", status: "covered", providerId: "learning-context" },
  { surface: "/api/learn/reflect", owner: "chapter reflection", status: "not-exposed", reason: "Reflection submission is user-authored and updates memory; no chat write proxy yet." },
  { surface: "/api/redemptions/[id]/attachment", owner: "redemption attachment download", status: "not-exposed", reason: "Binary file download is a direct UI link, not a chat capability." },
  { surface: "/api/cron/settle", owner: "scheduled settlement", status: "not-exposed", reason: "Cron endpoint is protected infrastructure automation." },
];
