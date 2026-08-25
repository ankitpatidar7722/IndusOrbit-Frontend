import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";

const API = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:5080";

/**
 * next-auth (v4) config. Credentials are validated by the ASP.NET backend
 * (POST /api/auth/login). The returned identity is projected onto session.user
 * with the EXACT keys indas-ui's API client reads
 * (UserID / CompanyID / ProductionUnitID / FYear / companyUsername / companyPassword)
 * — otherwise its DynamicSidebar fetch throws "please login again".
 */
export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt" },
  // Route sign-in AND auth errors to our own /login page (the built-in
  // /api/auth/error page is avoided — the login form shows the error inline).
  pages: { signIn: "/login", error: "/login" },
  providers: [
    CredentialsProvider({
      name: "Indus 360",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        // "employee" authenticates against IndusAppDB.Employees and bridges to the
        // matching Indus360 app identity; anything else = admin (Indus360App.Users).
        mode: { label: "Mode", type: "text" },
      },
      async authorize(creds) {
        if (!creds?.email || !creds?.password) return null;
        const isEmployee = creds.mode === "employee";
        const res = await fetch(`${API}/api/${isEmployee ? "employee-auth" : "auth"}/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: creds.email, password: creds.password }),
        });
        if (!res.ok) return null;
        const data = await res.json();
        // Admin returns the identity directly; employee wraps it in `appUser`
        // (null when the employee has no Indus360 app account → no app session).
        const u = isEmployee ? data.appUser : data;
        if (!u || !u.userID) return null;
        return {
          id: String(u.userID),
          name: u.fullName,
          email: u.email,
          UserID: u.userID,
          CompanyID: u.companyID,
          ProductionUnitID: u.productionUnitID,
          FYear: u.fYear,
          Role: u.role,
          companyUsername: u.companyUsername,
          companyPassword: u.companyPassword,
        } as unknown as import("next-auth").User;
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        const u = user as unknown as Record<string, unknown>;
        Object.assign(token, {
          UserID: u.UserID,
          CompanyID: u.CompanyID,
          ProductionUnitID: u.ProductionUnitID,
          FYear: u.FYear,
          Role: u.Role,
          companyUsername: u.companyUsername,
          companyPassword: u.companyPassword,
        });
      }
      return token;
    },
    async session({ session, token }) {
      const t = token as Record<string, unknown>;
      Object.assign(session.user as Record<string, unknown>, {
        UserID: t.UserID,
        CompanyID: t.CompanyID,
        ProductionUnitID: t.ProductionUnitID,
        FYear: t.FYear,
        Role: t.Role,
        companyUsername: t.companyUsername,
        companyPassword: t.companyPassword,
      });
      return session;
    },
  },
};
