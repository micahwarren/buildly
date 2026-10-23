export function PlanLoader() {
  return (
    <div className="plan-loader" aria-hidden="true">
      <svg viewBox="0 0 200 150" fill="none">
        <rect
          x="39"
          y="15"
          width="122"
          height="120"
          rx="13"
          fill="#eef1e7"
          stroke="#c9d3c1"
        />
        <path
          d="M56 35 H143 M56 55 H143 M56 75 H143 M56 95 H143 M56 115 H143 M76 30 V121 M96 30 V121 M116 30 V121 M136 30 V121"
          stroke="#dce3d4"
          strokeWidth=".7"
        />
        <path
          className="plan-draw"
          d="M64 76 L100 44 L136 76 M74 70 V111 H126 V70 M92 111 V89 H108 V111"
          stroke="#2b4c39"
          strokeWidth="4"
          strokeLinecap="round"
          strokeLinejoin="round"
          pathLength="100"
        />
        <path
          className="plan-dimension"
          d="M62 124 H138 M62 120 V128 M138 120 V128"
          stroke="#c65430"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <g className="plan-pencil">
          <path d="M132 49 L155 26 L162 33 L139 56 L130 59Z" fill="#c65430" />
          <path d="M130 59 L132 49 L139 56Z" fill="#dfbc8d" />
          <path d="M130 59 L131 55 L134 58Z" fill="#253e32" />
        </g>
      </svg>
      <div className="plan-loader-track">
        <span />
      </div>
    </div>
  );
}
