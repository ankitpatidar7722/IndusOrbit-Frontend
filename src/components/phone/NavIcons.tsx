"use client";

/**
 * Bottom-bar glyphs drawn the way native apps draw them (ported from IndusFlexoERP): an OUTLINE shape when the
 * tab is idle and the SAME shape FILLED when selected, 24px grid, round joins. Web icon sets only ship outlines,
 * which is what makes a bar read as a website.
 *   <NavIcon name="home" filled={active} width={24} height={24} />
 */
export type NavIconName = "home" | "messages" | "modules" | "bell";

interface NavIconProps extends React.SVGProps<SVGSVGElement> {
  name: NavIconName;
  filled?: boolean;
}

const STROKE = { fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round" } as const;

export function NavIcon({ name, filled = false, ...svg }: NavIconProps) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden {...svg}>
      {name === "home" && (filled ? (
        <path d="M3.6 10.2 11.1 4a1.4 1.4 0 0 1 1.8 0l7.5 6.2c.4.3.6.8.6 1.3V19a2 2 0 0 1-2 2h-4v-5.2a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1V21H5a2 2 0 0 1-2-2v-7.5c0-.5.2-1 .6-1.3Z" fill="currentColor" />
      ) : (
        <path d="M4.2 10.6 11.2 4.8a1.25 1.25 0 0 1 1.6 0l7 5.8c.3.2.5.6.5 1V19a1.8 1.8 0 0 1-1.8 1.8h-3.6v-5a1 1 0 0 0-1-1h-3.8a1 1 0 0 0-1 1v5H5.5A1.8 1.8 0 0 1 3.7 19v-7.4c0-.4.2-.8.5-1Z" {...STROKE} />
      ))}

      {name === "messages" && (filled ? (
        <>
          <path d="M12 3.2c5 0 9 3.5 9 7.9s-4 7.9-9 7.9c-1 0-2-.1-2.9-.4L5.4 20.4a.7.7 0 0 1-1-.8l.9-3.3C4 14.9 3 13.1 3 11.1 3 6.7 7 3.2 12 3.2Z" fill="currentColor" />
          <circle cx="8.2" cy="11.2" r="1.15" fill="var(--nav-icon-cut, white)" />
          <circle cx="12" cy="11.2" r="1.15" fill="var(--nav-icon-cut, white)" />
          <circle cx="15.8" cy="11.2" r="1.15" fill="var(--nav-icon-cut, white)" />
        </>
      ) : (
        <path d="M12 4c4.6 0 8.2 3.1 8.2 7.1s-3.6 7.1-8.2 7.1c-1 0-1.9-.1-2.8-.4l-3.4 1.6.8-3C5 15 3.8 13.2 3.8 11.1 3.8 7.1 7.4 4 12 4Z" {...STROKE} />
      ))}

      {name === "bell" && (filled ? (
        <>
          <path d="M12 3a6 6 0 0 0-6 6v3.6l-1.5 2.6c-.4.7.1 1.6.9 1.6h13.2c.8 0 1.3-.9.9-1.6L18 12.6V9a6 6 0 0 0-6-6Z" fill="currentColor" />
          <path d="M9.8 19.2a2.3 2.3 0 0 0 4.4 0Z" fill="currentColor" />
        </>
      ) : (
        <>
          <path d="M12 3.8a5.3 5.3 0 0 0-5.3 5.3v3.7l-1.4 2.5c-.3.5.1 1.1.6 1.1h12.2c.5 0 .9-.6.6-1.1l-1.4-2.5V9.1A5.3 5.3 0 0 0 12 3.8Z" {...STROKE} />
          <path d="M10 19.3a2.2 2.2 0 0 0 4 0" {...STROKE} />
        </>
      ))}

      {name === "modules" && (filled ? (
        <>
          <rect x="3.5" y="3.5" width="7.4" height="7.4" rx="2.2" fill="currentColor" />
          <rect x="13.1" y="3.5" width="7.4" height="7.4" rx="2.2" fill="currentColor" />
          <rect x="3.5" y="13.1" width="7.4" height="7.4" rx="2.2" fill="currentColor" />
          <rect x="13.1" y="13.1" width="7.4" height="7.4" rx="2.2" fill="currentColor" />
        </>
      ) : (
        <>
          <rect x="4" y="4" width="6.8" height="6.8" rx="2" {...STROKE} />
          <rect x="13.2" y="4" width="6.8" height="6.8" rx="2" {...STROKE} />
          <rect x="4" y="13.2" width="6.8" height="6.8" rx="2" {...STROKE} />
          <rect x="13.2" y="13.2" width="6.8" height="6.8" rx="2" {...STROKE} />
        </>
      ))}
    </svg>
  );
}
