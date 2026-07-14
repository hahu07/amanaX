import styles from "./NetworkDiagram.module.css";

// Schematic diagram of the actual product mechanism: 9 regulated
// participants coordinating through one shared Canton ledger, AI-assisted
// but human-approved. Positions are computed, not hand-placed, so the
// diagram stays correct if a role label changes.
const ROLES: { label: string[] }[] = [
  { label: ["Platform", "Operator"] },
  { label: ["Fund Manager"] },
  { label: ["Issuing House"] },
  { label: ["Trustee"] },
  { label: ["Shariah", "Advisor"] },
  { label: ["Custodian"] },
  { label: ["Distributor"] },
  { label: ["Investor"] },
  { label: ["SEC"] },
];

const VIEW_W = 920;
const VIEW_H = 620;
const HUB_X = VIEW_W / 2;
const HUB_Y = VIEW_H / 2 - 10;
const HUB_R = 86;
const NODE_R = 246;
const NODE_W = 152;
const NODE_H = 54;

// Three lines carry a slow, subtle "data pulse" — the only motion in the
// diagram, standing in for live workflow traffic without being busy.
const PULSE_INDICES = new Set([1, 4, 7]);

function nodePosition(index: number) {
  const angle = (-90 + index * (360 / ROLES.length)) * (Math.PI / 180);
  return {
    x: HUB_X + NODE_R * Math.cos(angle),
    y: HUB_Y + NODE_R * Math.sin(angle),
  };
}

export function NetworkDiagram() {
  return (
    <svg
      className={styles.diagram}
      viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
      role="img"
      aria-label="Diagram showing the Platform Operator, Fund Manager, Issuing House, Trustee, Shariah Advisor, Custodian, Distributor, Investor and SEC all connected to one shared Canton ledger at the center."
    >
      <g>
        {ROLES.map((_, i) => {
          const { x, y } = nodePosition(i);
          return <line key={i} className={styles.line} x1={x} y1={y} x2={HUB_X} y2={HUB_Y} />;
        })}
      </g>

      <g>
        {ROLES.map((_, i) => {
          if (!PULSE_INDICES.has(i)) return null;
          const { x, y } = nodePosition(i);
          return (
            <circle key={i} r={3} className={styles.pulse}>
              <animateMotion
                dur={`${3.4 + i * 0.3}s`}
                repeatCount="indefinite"
                path={`M ${x},${y} L ${HUB_X},${HUB_Y}`}
              />
            </circle>
          );
        })}
      </g>

      <g>
        {ROLES.map((role, i) => {
          const { x, y } = nodePosition(i);
          const lines = role.label;
          const startY = lines.length === 1 ? y + 4.5 : y - 3;
          return (
            <g key={i}>
              <rect
                className={styles.node}
                x={x - NODE_W / 2}
                y={y - NODE_H / 2}
                width={NODE_W}
                height={NODE_H}
                rx={10}
              />
              {lines.map((line, li) => (
                <text key={li} className={styles.nodeLabel} x={x} y={startY + li * 16}>
                  {line}
                </text>
              ))}
            </g>
          );
        })}
      </g>

      <g>
        <circle className={styles.hub} cx={HUB_X} cy={HUB_Y} r={HUB_R} />
        <text className={styles.hubLabel} x={HUB_X} y={HUB_Y - 6}>
          Canton Ledger
        </text>
        <text className={styles.hubSubLabel} x={HUB_X} y={HUB_Y + 12}>
          Shared source
        </text>
        <text className={styles.hubSubLabel} x={HUB_X} y={HUB_Y + 25}>
          of truth
        </text>
      </g>

      <text className={styles.caption} x={HUB_X} y={VIEW_H - 18}>
        AI-assisted · every decision human-approved
      </text>
    </svg>
  );
}
