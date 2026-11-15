export function classifyAutomation(userAgent: string, count: number) {
  if (/bot\b|crawler|spider|headless|facebookexternalhit|WhatsApp|preview|curl\//i.test(userAgent)) return 'automated_user_agent';
  return count > 60 ? 'high_frequency' : null;
}