/**
 * Built-in sources. Each is a publisher's own public RSS/Atom feed; FlowCompanion
 * shows headlines with a short preview and links to the original article.
 * All were fetched successfully on 2026-10-22 (see docs/TEST_REPORT.md).
 */
export const FEED_CATEGORIES = [
  { id: 'ai', label: 'AI' },
  { id: 'technology', label: 'Technology' },
  { id: 'science', label: 'Science' },
  { id: 'business', label: 'Business' },
  { id: 'finance', label: 'Finance' },
  { id: 'sports', label: 'Sports' },
  { id: 'entertainment', label: 'Entertainment' },
  { id: 'world', label: 'World' },
  { id: 'health', label: 'Health' },
  { id: 'custom', label: 'My sources' },
] as const;

export const DEFAULT_SOURCES: { name: string; url: string; siteUrl: string; category: string }[] = [
  { name: 'MIT News — Artificial intelligence', url: 'https://news.mit.edu/rss/topic/artificial-intelligence2', siteUrl: 'https://news.mit.edu', category: 'ai' },
  { name: 'Google — AI', url: 'https://blog.google/technology/ai/rss/', siteUrl: 'https://blog.google/technology/ai/', category: 'ai' },
  { name: 'Google DeepMind blog', url: 'https://deepmind.google/blog/rss.xml', siteUrl: 'https://deepmind.google/discover/blog/', category: 'ai' },
  { name: 'Hugging Face blog', url: 'https://huggingface.co/blog/feed.xml', siteUrl: 'https://huggingface.co/blog', category: 'ai' },
  { name: 'OpenAI news', url: 'https://openai.com/news/rss.xml', siteUrl: 'https://openai.com/news/', category: 'ai' },
  { name: 'Ars Technica', url: 'https://feeds.arstechnica.com/arstechnica/index', siteUrl: 'https://arstechnica.com', category: 'technology' },
  { name: 'The Verge', url: 'https://www.theverge.com/rss/index.xml', siteUrl: 'https://www.theverge.com', category: 'technology' },
  { name: 'Hacker News front page', url: 'https://hnrss.org/frontpage', siteUrl: 'https://news.ycombinator.com', category: 'technology' },
  { name: 'BBC News — Technology', url: 'https://feeds.bbci.co.uk/news/technology/rss.xml', siteUrl: 'https://www.bbc.co.uk/news/technology', category: 'technology' },
  { name: 'ScienceDaily', url: 'https://www.sciencedaily.com/rss/all.xml', siteUrl: 'https://www.sciencedaily.com', category: 'science' },
  { name: 'NASA news releases', url: 'https://www.nasa.gov/news-release/feed/', siteUrl: 'https://www.nasa.gov/news/', category: 'science' },
  { name: 'BBC News — Science & environment', url: 'https://feeds.bbci.co.uk/news/science_and_environment/rss.xml', siteUrl: 'https://www.bbc.co.uk/news/science_and_environment', category: 'science' },
  { name: 'BBC News — Business', url: 'https://feeds.bbci.co.uk/news/business/rss.xml', siteUrl: 'https://www.bbc.co.uk/news/business', category: 'business' },
  { name: 'Federal Reserve press releases', url: 'https://www.federalreserve.gov/feeds/press_all.xml', siteUrl: 'https://www.federalreserve.gov', category: 'finance' },
  { name: 'U.S. SEC press releases', url: 'https://www.sec.gov/news/pressreleases.rss', siteUrl: 'https://www.sec.gov/newsroom', category: 'finance' },
  { name: 'BBC Sport', url: 'https://feeds.bbci.co.uk/sport/rss.xml', siteUrl: 'https://www.bbc.co.uk/sport', category: 'sports' },
  { name: 'ESPN', url: 'https://www.espn.com/espn/rss/news', siteUrl: 'https://www.espn.com', category: 'sports' },
  { name: 'BBC News — Entertainment & arts', url: 'https://feeds.bbci.co.uk/news/entertainment_and_arts/rss.xml', siteUrl: 'https://www.bbc.co.uk/news/entertainment_and_arts', category: 'entertainment' },
  { name: 'BBC News — World', url: 'https://feeds.bbci.co.uk/news/world/rss.xml', siteUrl: 'https://www.bbc.co.uk/news/world', category: 'world' },
  { name: 'NPR News', url: 'https://feeds.npr.org/1001/rss.xml', siteUrl: 'https://www.npr.org', category: 'world' },
  { name: 'BBC News — Health', url: 'https://feeds.bbci.co.uk/news/health/rss.xml', siteUrl: 'https://www.bbc.co.uk/news/health', category: 'health' },
];
