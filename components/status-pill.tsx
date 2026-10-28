import { questionSourceLabel } from "@/lib/applications";

export function formatScore(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "—";
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

export function statusColor(status: string): string {
  const key = status.trim().toLowerCase();
  if (key.includes("offer")) return "#2d6a3f";
  if (key.includes("interview")) return "#a15c12";
  if (key.includes("withdraw") || key.includes("reject") || key.includes("declin")) return "#8d8478";
  if (key.includes("applied")) return "#0f6e68";
  if (!key || key === "na" || key === "n/a" || key === "no status") return "#8a8175";
  return "#3d5c66";
}

export function SourcePill({ source }: { source: string }) {
  const label = questionSourceLabel(source);
  const color = label === "LinkedIn" ? "#1d4f91" : "#0f6e68";
  return (
    <span
      className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium whitespace-nowrap"
      style={{ color, backgroundColor: `${color}1f` }}
    >
      {label}
    </span>
  );
}

export function StatusPill({ status }: { status: string }) {
  const label = status.trim() || "No status";
  const color = statusColor(label);
  return (
    <span
      className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium whitespace-nowrap"
      style={{ color, backgroundColor: `${color}1f` }}
    >
      {label}
    </span>
  );
}
