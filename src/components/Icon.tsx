import type { ReactElement, SVGProps } from "react";

export type IconName =
  | "wallet"
  | "coaches"
  | "oversight"
  | "settings"
  | "topay"
  | "history"
  | "plus"
  | "minus"
  | "close"
  | "chevron-down"
  | "chevron-right"
  | "chevron-left"
  | "calendar"
  | "logout"
  | "check"
  | "trash"
  | "pencil"
  | "account";

const PATHS: Record<IconName, ReactElement> = {
  wallet: (
    <>
      <rect x="3" y="7" width="18" height="12" rx="3" />
      <path d="M3 7l1.4-2.8A2 2 0 0 1 6.2 3h7.6a2 2 0 0 1 1.8 1.1L17 7" />
      <circle cx="16" cy="13" r="1.2" />
    </>
  ),
  coaches: (
    <>
      <circle cx="9" cy="8.5" r="3.5" />
      <path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" />
      <circle cx="17.5" cy="9.5" r="2.5" />
      <path d="M17.5 14c2.5 0 4.5 2 4.5 4.5" />
    </>
  ),
  oversight: (
    <>
      <circle cx="11" cy="11" r="6.5" />
      <line x1="16" y1="16" x2="21" y2="21" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </>
  ),
  topay: (
    <>
      <rect x="2.5" y="6" width="19" height="12" rx="3.5" />
      <circle cx="12" cy="12" r="2.6" />
    </>
  ),
  history: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3.5 2" />
    </>
  ),
  plus: (
    <>
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </>
  ),
  minus: <line x1="5" y1="12" x2="19" y2="12" />,
  close: (
    <>
      <line x1="6" y1="6" x2="18" y2="18" />
      <line x1="18" y1="6" x2="6" y2="18" />
    </>
  ),
  "chevron-down": <path d="M6 9l6 6 6-6" />,
  "chevron-right": <path d="M9 6l6 6-6 6" />,
  "chevron-left": <path d="M15 6l-6 6 6 6" />,
  calendar: (
    <>
      <rect x="3.5" y="5" width="17" height="16" rx="3.5" />
      <line x1="3.5" y1="10" x2="20.5" y2="10" />
      <line x1="8" y1="3" x2="8" y2="7" />
      <line x1="16" y1="3" x2="16" y2="7" />
    </>
  ),
  logout: (
    <>
      <path d="M15 17l5-5-5-5" />
      <line x1="20" y1="12" x2="9" y2="12" />
      <path d="M13 5H5.5A1.5 1.5 0 0 0 4 6.5v11A1.5 1.5 0 0 0 5.5 19H13" />
    </>
  ),
  check: <path d="M5 13l4.5 4.5L19 7" />,
  trash: (
    <>
      <path d="M4.5 7h15" />
      <path d="M8.5 7V5a1.5 1.5 0 0 1 1.5-1.5h4A1.5 1.5 0 0 1 15.5 5v2" />
      <path d="M6.5 7l.8 12a2 2 0 0 0 2 1.9h5.4a2 2 0 0 0 2-1.9l.8-12" />
    </>
  ),
  pencil: (
    <>
      <path d="M4 20l4-1 11-11a2 2 0 0 0-3-3L5 16l-1 4z" />
    </>
  ),
  account: (
    <>
      <circle cx="12" cy="8.5" r="3.7" />
      <path d="M4.5 20c0-4.1 3.4-7 7.5-7s7.5 2.9 7.5 7" />
    </>
  ),
};

export function Icon({
  name,
  size = 22,
  strokeWidth = 1.9,
  ...rest
}: { name: IconName; size?: number } & SVGProps<SVGSVGElement>) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...rest}
    >
      {PATHS[name]}
    </svg>
  );
}
