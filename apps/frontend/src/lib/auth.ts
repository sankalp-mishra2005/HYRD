import { createAuthClient } from "better-auth/react";
import { BACKEND_URL } from "./config";

export const authClient = createAuthClient({
  baseURL: BACKEND_URL,
  fetchOptions: {
    credentials: "include",
  },
});

export const { signIn, signUp, useSession, signOut } = authClient;
