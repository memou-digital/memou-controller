/**
 * Helper utility for MEMOu Website URL generator
 * 
 * Supports two URL formats per business requirements:
 * 1. Basic URL:
 *    nama event (input manual)-nama penerima-memou.vercel.app
 * 2. Request URL:
 *    (request judul url)-memou.vercel.app
 */

export function cleanSlug(text: string): string {
  return (text || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-') // Replace non-alphanumeric chars with hyphens
    .replace(/^-+|-+$/g, '');     // Trim leading and trailing hyphens
}

export interface OrderUrlConfig {
  urlType: 'basic' | 'request';
  eventName?: string;
  recipientName?: string;
  clientName?: string;
  customUrlSlug?: string;
}

export function generateOrderUrl(config: OrderUrlConfig): {
  subdomain: string;
  domain: string;
  fullUrl: string;
} {
  const { urlType, eventName, recipientName, clientName, customUrlSlug } = config;

  let subdomain = '';

  if (urlType === 'request') {
    const slug = cleanSlug(customUrlSlug || clientName || 'celebration');
    // Ensure ends with -memou per specification: (request judul url) -memou.vercel.app
    subdomain = slug.endsWith('-memou') ? slug : `${slug}-memou`;
  } else {
    // Basic format: nama event (input manual)-nama penerima-memou.vercel.app
    const ev = cleanSlug(eventName || 'event');
    const rec = cleanSlug(recipientName || clientName || 'celebration');
    subdomain = `${ev}-${rec}-memou`;
  }

  const domain = `${subdomain}.vercel.app`;
  const fullUrl = `https://${domain}`;

  return { subdomain, domain, fullUrl };
}
