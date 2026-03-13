import Link from "next/link";

import type { MediaItem } from "@/lib/media/mock-data";
import { cn, formatRuntime, truncate } from "@/lib/utils";

type MediaCardProps = {
  item: MediaItem;
  compact?: boolean;
};

export function MediaCard({ item, compact }: MediaCardProps) {
  return (
    <Link
      className={cn("media-card", compact && "media-card-compact")}
      href={`/watch/${item.id}`}
    >
      <div
        className="media-card-poster"
        style={
          item.imageUrl
            ? {
                backgroundImage: `linear-gradient(180deg, rgba(15, 23, 42, 0.08), rgba(15, 23, 42, 0.9)), url(${item.imageUrl})`,
              }
            : undefined
        }
      >
        <span className="media-pill">{item.kind}</span>
      </div>
      <div className="media-card-copy">
        <h3>{item.title}</h3>
        <p>{truncate(item.overview, compact ? 88 : 120)}</p>
        <div className="media-meta">
          <span>{item.year}</span>
          <span>{formatRuntime(item.runTimeTicks)}</span>
          <span>{item.communityRating.toFixed(1)}</span>
        </div>
      </div>
    </Link>
  );
}
