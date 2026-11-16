// Capture only runs after JavaScript executes in a real page, so link-preview
// fetchers never reach it. Flag only explicit automation; in-app browsers
// (WhatsApp, Instagram, Facebook) are real people.
export function classifyAutomation(userAgent: string, count: number) {
  if (!userAgent.trim() || /\b(bot|crawler|spider|headless(chrome)?|curl|wget|python-requests|phantomjs|selenium|puppeteer|playwright)\b/i.test(userAgent) || /HeadlessChrome/i.test(userAgent)) return 'automated_user_agent';
  return count > 300 ? 'high_frequency' : null;
}
