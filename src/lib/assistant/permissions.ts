import type { Role } from "@/generated/prisma/client";
import type { AssistantPermission } from "./types";

const rank: Record<AssistantPermission, number> = {
  USER: 0,
  ADMIN: 1,
  SUPERADMIN: 2,
};

function permissionOf(role: Role): AssistantPermission {
  if (role === "SUPERADMIN") return "SUPERADMIN";
  if (role === "ADMIN") return "ADMIN";
  return "USER";
}

export function canUseTool(role: Role, permission: AssistantPermission): boolean {
  return rank[permissionOf(role)] >= rank[permission];
}
