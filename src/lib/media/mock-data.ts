export type MediaItem = {
  id: string;
  title: string;
  kind: "Movie" | "Series" | "Episode";
  overview: string;
  year: number;
  genres: string[];
  runTimeTicks: number;
  communityRating: number;
  imageUrl?: string;
  backdropUrl?: string;
};

export const mockMedia: MediaItem[] = [
  {
    id: "spiral-archive",
    title: "Spiral Archive",
    kind: "Series",
    overview:
      "A neon-drenched anime mystery about a drifting station where every memory can be replayed, but none can be trusted.",
    year: 2025,
    genres: ["Anime", "Mystery", "Sci-Fi"],
    runTimeTicks: 14400000000,
    communityRating: 8.7,
  },
  {
    id: "shatter-run",
    title: "Shatter Run",
    kind: "Movie",
    overview:
      "A revenge thriller set across midnight rail lines, shot with the kind of kinetic framing Curly's front page was designed for.",
    year: 2024,
    genres: ["Action", "Thriller"],
    runTimeTicks: 64800000000,
    communityRating: 8.2,
  },
  {
    id: "paper-castle",
    title: "Paper Castle",
    kind: "Series",
    overview:
      "A lavish fantasy serial about rival houses who negotiate with ink spirits to hold a city together.",
    year: 2023,
    genres: ["Fantasy", "Drama"],
    runTimeTicks: 15600000000,
    communityRating: 8.4,
  },
  {
    id: "night-shift-zero",
    title: "Night Shift Zero",
    kind: "Movie",
    overview:
      "Experimental cyberpunk action with a measured, slow-burn first act and a brutal final chase through a flooded district.",
    year: 2026,
    genres: ["Cyberpunk", "Action"],
    runTimeTicks: 70200000000,
    communityRating: 8.9,
  },
];

export const mockSections = [
  {
    id: "continue",
    title: "Continue Watching",
    items: mockMedia.slice(0, 3),
  },
  {
    id: "anime",
    title: "Anime Nights",
    items: [mockMedia[0], mockMedia[2]],
  },
  {
    id: "cinema",
    title: "Cinema Vault",
    items: [mockMedia[1], mockMedia[3]],
  },
];
