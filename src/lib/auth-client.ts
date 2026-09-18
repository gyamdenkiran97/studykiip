"use client";

import { createAuthClient } from "better-auth/react";
import { inferAdditionalFields } from "better-auth/client/plugins";
import type { Auth } from "@/server/auth/config";

export const authClient = createAuthClient({
  plugins: [inferAdditionalFields<Auth>()],
});

export const { signIn, signUp, signOut, useSession, changePassword, updateUser, resetPassword } =
  authClient;

/** Better Auth exposes the reset-request endpoint under requestPasswordReset. */
export const requestPasswordReset = authClient.requestPasswordReset;
