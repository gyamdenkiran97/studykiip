import "server-only";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { prisma } from "../db";
import { env, isProduction } from "../env";
import { sendEmail } from "../email/transport";
import { passwordResetTemplate, verifyEmailTemplate, welcomeTemplate } from "../email/templates";
import { logger } from "../logger";

/**
 * Authentication is delegated to Better Auth: scrypt password hashing, signed
 * session cookies, verification and reset token lifecycles. We configure it —
 * we do not reimplement any of it.
 */

const socialProviders: Record<string, { clientId: string; clientSecret: string }> = {};
if (env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET) {
  socialProviders.github = { clientId: env.GITHUB_CLIENT_ID, clientSecret: env.GITHUB_CLIENT_SECRET };
}
if (env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET) {
  socialProviders.google = { clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET };
}

export const auth = betterAuth({
  appName: "Kwidus21",
  baseURL: env.BETTER_AUTH_URL,
  secret: env.BETTER_AUTH_SECRET,
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  trustedOrigins: [env.NEXT_PUBLIC_APP_URL, env.BETTER_AUTH_URL],

  emailAndPassword: {
    enabled: true,
    // NIST SP 800-63B: length over composition rules.
    minPasswordLength: 10,
    maxPasswordLength: 200,
    autoSignIn: true,
    requireEmailVerification: false,
    sendResetPassword: async ({ user, url }) => {
      const mail = passwordResetTemplate({ name: user.name, url });
      await sendEmail({ to: user.email, ...mail });
    },
    onPasswordReset: async ({ user }) => {
      logger.info("auth.password_reset", { userId: user.id });
    },
  },

  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    expiresIn: 60 * 60,
    sendVerificationEmail: async ({ user, url }) => {
      const mail = verifyEmailTemplate({ name: user.name, url });
      await sendEmail({ to: user.email, ...mail });
    },
  },

  socialProviders,

  user: {
    additionalFields: {
      role: { type: "string", required: false, defaultValue: "CUSTOMER", input: false },
      status: { type: "string", required: false, defaultValue: "ACTIVE", input: false },
      phone: { type: "string", required: false, input: true },
      marketingOptIn: { type: "boolean", required: false, defaultValue: false, input: true },
    },
    changeEmail: { enabled: true },
    deleteUser: { enabled: false },
  },

  session: {
    expiresIn: 60 * 60 * 24 * 30,
    updateAge: 60 * 60 * 24,
    freshAge: 60 * 15,
    cookieCache: { enabled: true, maxAge: 60 * 5 },
  },

  account: {
    accountLinking: { enabled: true, trustedProviders: ["github", "google"] },
  },

  // Better Auth's own limiter guards the auth endpoints; application-level
  // limits live in src/server/rate-limit. The relaxed variant exists so an
  // end-to-end suite can sign in repeatedly; env.ts refuses it in production.
  rateLimit: env.E2E_RELAX_AUTH_RATE_LIMIT
    ? { enabled: true, window: 60, max: 1000 }
    : {
        enabled: true,
        window: 60,
        max: 30,
        customRules: {
          "/sign-in/email": { window: 600, max: 8 },
          "/sign-up/email": { window: 3600, max: 5 },
          "/forget-password": { window: 3600, max: 5 },
        },
      },

  advanced: {
    cookiePrefix: "kwidus21",
    useSecureCookies: isProduction,
    defaultCookieAttributes: {
      httpOnly: true,
      sameSite: "lax",
      secure: isProduction,
      path: "/",
    },
  },

  databaseHooks: {
    user: {
      create: {
        after: async (user) => {
          logger.info("auth.user_created", { userId: user.id });
          const mail = welcomeTemplate({ name: user.name, shopUrl: `${env.NEXT_PUBLIC_APP_URL}/shop` });
          await sendEmail({ to: user.email, ...mail });
          await prisma.wishlist.create({ data: { userId: user.id } }).catch(() => undefined);
        },
      },
    },
    session: {
      create: {
        after: async (session) => {
          await prisma.user
            .update({ where: { id: session.userId }, data: { lastLoginAt: new Date() } })
            .catch(() => undefined);
        },
      },
    },
  },

  plugins: [nextCookies()],
});

export type Auth = typeof auth;
