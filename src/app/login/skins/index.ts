import type { ComponentType } from "react";
import type { LoginForm } from "../useLoginForm";
import { DefaultSkin } from "./DefaultSkin";
import { DiwaliSkin } from "./DiwaliSkin";
import { NewYearSkin } from "./NewYearSkin";
import { GaneshChaturthiSkin } from "./GaneshChaturthiSkin";

export interface LoginSkin {
  id: string;
  label: string;
  description: string;
  /** Emoji used as a preview thumbnail in the Settings gallery. */
  preview: string;
  Component: ComponentType<{ form: LoginForm }>;
}

/**
 * Registry of login-page designs. `id` matches what the backend stores + what the login page fetches.
 * Add a new skin = one component + one row here (no auth/logic change). "default" is always first.
 */
export const LOGIN_SKINS: LoginSkin[] = [
  { id: "default", label: "Default", description: "Standard split layout with the time-based greeting.", preview: "🖥️", Component: DefaultSkin },
  { id: "ganesh", label: "Ganesh Chaturthi", description: "Festive artwork — marigold toran, lanterns, Om & Ganesha idol. Ganpati Bappa Morya.", preview: "🕉️", Component: GaneshChaturthiSkin },
  { id: "diwali", label: "Diwali", description: "Marigold toran, spinning rangoli, live diyas & fireworks — Shubh Deepavali.", preview: "🪔", Component: DiwaliSkin },
  { id: "newyear", label: "New Year", description: "Night sky, fireworks, confetti & a glowing year in a starburst.", preview: "🎆", Component: NewYearSkin },
];

export const getSkin = (id?: string | null): LoginSkin =>
  LOGIN_SKINS.find((s) => s.id === id) ?? LOGIN_SKINS[0];
