// Production domain isn't decided yet (nothing in .env/.env.example sets one —
// only FRONTEND_URL=http://localhost:5173). Everything below is wired up and
// correct, it just needs this one constant swapped for the real domain before
// launch — canonical tags, OG/Twitter tags, robots.txt, and sitemap.xml all
// key off it.
export const SITE_URL = "https://www.eazeebooks.com";
