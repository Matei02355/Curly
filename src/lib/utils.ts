import { clsx } from "clsx";

export function cn(...values: Array<string | false | null | undefined>) {
  return clsx(values);
}

export function formatRuntime(ticks?: number | null) {
  if (!ticks) {
    return "Unknown length";
  }

  const minutes = Math.max(1, Math.round(ticks / 600000000));
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;

  if (!hours) {
    return `${minutes} min`;
  }

  return `${hours}h ${remainder}m`;
}

export function formatDate(date?: string | Date | null) {
  if (!date) {
    return "Unknown";
  }

  return new Intl.DateTimeFormat("en", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(date));
}

export function truncate(value: string | null | undefined, max = 180) {
  if (!value) {
    return "No synopsis yet.";
  }

  if (value.length <= max) {
    return value;
  }

  return `${value.slice(0, max).trimEnd()}...`;
}
