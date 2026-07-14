// Hand-rolled, dependency-free icon set. Consistent 1.6px stroke, 20px
// canvas, currentColor — no icon library dependency is added to the project.
import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

function base(props: IconProps) {
  return {
    width: 16,
    height: 16,
    viewBox: "0 0 20 20",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.6,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    ...props,
  };
}

export function IconBuilding(props: IconProps) {
  return (
    <svg {...base(props)}>
      <rect x="4" y="2.5" width="9" height="15" rx="1" />
      <path d="M13 9h3v8.5" />
      <path d="M6.5 5.5h1M9.5 5.5h1M6.5 8.5h1M9.5 8.5h1M6.5 11.5h1M9.5 11.5h1M6.5 14.5h1" />
    </svg>
  );
}

export function IconUsers(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="7" cy="6.5" r="2.5" />
      <path d="M2.5 17c0-3 2-4.7 4.5-4.7s4.5 1.7 4.5 4.7" />
      <circle cx="14.5" cy="7" r="2" />
      <path d="M13 12.6c2 .1 3.5 1.7 3.5 4.4" />
    </svg>
  );
}

export function IconLogout(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M8 17H4.5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1H8" />
      <path d="M13 13.5 17 10l-4-3.5" />
      <path d="M17 10H7.5" />
    </svg>
  );
}

export function IconChevronDown(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M5 7.5 10 12.5 15 7.5" />
    </svg>
  );
}

export function IconArrowRight(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M3.5 10h13" />
      <path d="M11 4.5 16.5 10 11 15.5" />
    </svg>
  );
}

export function IconShield(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M10 2.5 16.5 5v4.8c0 4.2-2.8 7-6.5 8.2-3.7-1.2-6.5-4-6.5-8.2V5L10 2.5Z" />
      <path d="M7.3 10 9.2 11.9 12.9 8.2" />
    </svg>
  );
}

export function IconLayers(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M10 2.8 17 6.5 10 10.2 3 6.5 10 2.8Z" />
      <path d="m3 10.3 7 3.7 7-3.7" />
      <path d="m3 14 7 3.7 7-3.7" />
    </svg>
  );
}

export function IconFileText(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M5.5 2.5h6l3 3v11.5a1 1 0 0 1-1 1h-8a1 1 0 0 1-1-1v-13.5a1 1 0 0 1 1-1Z" />
      <path d="M11.5 2.5V6h3" />
      <path d="M7 10h6M7 12.6h6M7 15.2h4" />
    </svg>
  );
}

export function IconClipboardCheck(props: IconProps) {
  return (
    <svg {...base(props)}>
      <rect x="4.5" y="3.5" width="11" height="14" rx="1.2" />
      <path d="M7.5 3.5V2.8a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v.7" />
      <path d="M7.7 10.3 9.3 11.9 12.5 8.5" />
    </svg>
  );
}

export function IconAlertTriangle(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M10 3 18 16.5H2L10 3Z" />
      <path d="M10 8.3v3.4" />
      <path d="M10 14.2v.1" />
    </svg>
  );
}

export function IconPlus(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M10 4v12M4 10h12" />
    </svg>
  );
}

export function IconClock(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="10" cy="10" r="7.3" />
      <path d="M10 6v4.3l3 2" />
    </svg>
  );
}
