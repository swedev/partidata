import type { NextApiRequest, NextApiResponse } from 'next';

import { partyData } from 'src/server/party-data';

function escapeXml (value: string) {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&apos;');
}

export default async function handler (request: NextApiRequest, response: NextApiResponse) {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    response.setHeader('Allow', 'GET, HEAD');
    response.status(405).end();
    return;
  }

  const baseUrl = process.env.PARTIDATA_BASE_URL ?? 'https://www.partidata.se';
  const urls = [
    new URL('/', baseUrl).toString(),
    ...(await partyData.listCurrentSlugs()).map(slug => new URL(`/parti/${encodeURIComponent(slug)}/`, baseUrl).toString()),
  ];
  const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map(url => `  <url><loc>${escapeXml(url)}</loc></url>`).join('\n')}\n</urlset>\n`;

  response.setHeader('Cache-Control', 'public, max-age=300');
  response.setHeader('Content-Type', 'application/xml; charset=utf-8');
  response.status(200);
  response.end(request.method === 'HEAD' ? undefined : body);
}
