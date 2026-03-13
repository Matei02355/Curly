import type { MediaItem } from "@/lib/media/mock-data";

import { MediaCard } from "@/components/media-card";

type SectionRowProps = {
  title: string;
  eyebrow?: string;
  items: MediaItem[];
};

export function SectionRow({ title, eyebrow, items }: SectionRowProps) {
  if (!items.length) {
    return null;
  }

  return (
    <section className="section-row">
      <div className="section-heading">
        {eyebrow ? <span className="eyebrow">{eyebrow}</span> : null}
        <h2>{title}</h2>
      </div>
      <div className="rail">
        {items.map((item) => (
          <MediaCard key={item.id} compact item={item} />
        ))}
      </div>
    </section>
  );
}
