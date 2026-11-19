import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { prisma } from "../../db";

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  baseURL: process.env.BETTER_AUTH_URL || "http://localhost:3001",
  socialProviders: {
    github: {
      clientId: process.env.GITHUB_CLIENT_ID || "dummy_github_id",
      clientSecret: process.env.GITHUB_CLIENT_SECRET || "dummy_github_secret",
    },
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID || "dummy_google_id",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "dummy_google_secret",
    },
  },
  emailAndPassword: {
    enabled: true,
  },
  trustedOrigins: [
    "http://localhost:3000",
    "http://localhost:3001",
    "http://localhost:5173",
    ...(process.env.FRONTEND_URL ? [process.env.FRONTEND_URL] : []),
    ...(process.env.BETTER_AUTH_TRUSTED_ORIGINS ? process.env.BETTER_AUTH_TRUSTED_ORIGINS.split(",") : []),
  ],
});
