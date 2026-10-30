"use client";
import { useContext, useEffect } from "react";
import { ThemeContext } from "indas-ui";

/**
 * Loads ONLY the web font the user picked in Settings → Preferences → Font Family (indas-ui ThemeContext
 * `theme.fontFamily`). The default (Inter) is linked in app/layout.tsx; the other nine were all linked
 * there too — nine render-blocking stylesheets on every page for a font almost nobody selects.
 */
const GOOGLE_FONTS: Record<string, string> = {
  roboto: "Roboto:wght@400;500;700",
  openSans: "Open+Sans:wght@400;600;700",
  lato: "Lato:wght@400;700",
  poppins: "Poppins:wght@400;500;600;700",
  montserrat: "Montserrat:wght@400;500;600;700",
  nunito: "Nunito:wght@400;600;700",
  sourceSansPro: "Source+Sans+Pro:wght@400;600;700",
  workSans: "Work+Sans:wght@400;500;600;700",
  ubuntu: "Ubuntu:wght@400;500;700",
};

export default function FontLoader() {
  const fontKey = useContext(ThemeContext)?.theme?.fontFamily as string | undefined;

  useEffect(() => {
    const family = fontKey ? GOOGLE_FONTS[fontKey] : undefined;
    if (!family) return;
    const id = `font-${fontKey}`;
    if (document.getElementById(id)) return;
    const link = document.createElement("link");
    link.id = id;
    link.rel = "stylesheet";
    link.href = `https://fonts.googleapis.com/css2?family=${family}&display=swap`;
    document.head.appendChild(link);
  }, [fontKey]);

  return null;
}
