import NextAuth from "next-auth";
import { authOptions } from "@/lib/auth";

// Real NextAuth (v4) handler — replaces the earlier stub. Serves
// /api/auth/session, /api/auth/callback/credentials, /api/auth/signout, etc.
const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
