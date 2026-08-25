"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** The employee login was merged into the unified /login page. */
export default function EmployeeLoginRedirect() {
  const router = useRouter();
  useEffect(() => { router.replace("/login"); }, [router]);
  return null;
}
