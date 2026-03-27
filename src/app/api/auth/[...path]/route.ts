import { NextRequest } from "next/server";
import {
  handleLogin,
  handleLogout,
  handleMe,
  handleToggleTwoFactor,
  handleTwoFactorSetup,
  handleTwoFactorStatus,
  handleUpdatePassword,
  handleVerifyTwoFactorLogin,
  handleVerifyTwoFactorSetup,
  jsonError,
} from "../../../../lib/next-route-helpers";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ path: string[] }>;
};

export async function GET(request: NextRequest, context: RouteContext) {
  const { path } = await context.params;
  const route = path.join("/");

  if (route === "me") {
    return handleMe(request);
  }

  if (route === "2fa/status") {
    return handleTwoFactorStatus(request);
  }

  return jsonError("Not found", 404);
}

export async function POST(request: NextRequest, context: RouteContext) {
  const { path } = await context.params;
  const route = path.join("/");

  if (route === "login") {
    return handleLogin(request);
  }

  if (route === "verify-2fa-login") {
    return handleVerifyTwoFactorLogin(request);
  }

  if (route === "logout") {
    return handleLogout(request);
  }

  if (route === "update-password") {
    return handleUpdatePassword(request);
  }

  if (route === "2fa/setup") {
    return handleTwoFactorSetup(request);
  }

  if (route === "2fa/verify-setup") {
    return handleVerifyTwoFactorSetup(request);
  }

  if (route === "2fa/toggle") {
    return handleToggleTwoFactor(request);
  }

  return jsonError("Not found", 404);
}
