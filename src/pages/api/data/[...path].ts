import type { NextApiRequest, NextApiResponse } from 'next';

import { matchesEtag } from 'src/server/data-resources';
import { partyData } from 'src/server/party-data';

/**
 * The largest allowlisted file is several megabytes, which Next warns about
 * above its default response limit, and a rejected write method must not have
 * its body parsed before the 405.
 */
export const config = { api: { bodyParser: false, responseLimit: false } };

export default async function handler (request: NextApiRequest, response: NextApiResponse) {
  // On every response, including 304, 308, 404 and 405: without it a browser
  // client sees a network error instead of the status code.
  response.setHeader('Access-Control-Allow-Origin', '*');

  // A preflight asks whether the method may be used here, not whether the
  // resource exists, so it is answered the same way for every address.
  if (request.method === 'OPTIONS') {
    response.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    response.setHeader('Access-Control-Allow-Headers', 'If-None-Match');
    response.setHeader('Access-Control-Max-Age', '86400');
    response.status(204).end();
    return;
  }

  if (request.method !== 'GET' && request.method !== 'HEAD') {
    response.setHeader('Allow', 'GET, HEAD, OPTIONS');
    response.status(405).end();
    return;
  }

  const segments = request.query.path;
  const resolution = Array.isArray(segments)
    ? await partyData.resolveDataResource(segments)
    : ({ kind: 'notFound' } as const);

  if (resolution.kind === 'redirect') {
    response.setHeader('Location', resolution.destination);
    response.status(308).end();
    return;
  }

  if (resolution.kind === 'notFound') {
    response.setHeader('Content-Type', 'application/json; charset=utf-8');
    response.status(404).end(request.method === 'HEAD' ? undefined : '{"fel":"Okänd resurs"}');
    return;
  }

  response.setHeader('Cache-Control', 'public, max-age=3600');
  // nginx gzips JSON without `gzip_vary on`, so the app states the variance.
  response.setHeader('Vary', 'Accept-Encoding');
  response.setHeader('ETag', resolution.etag);
  if (process.env.PARTIDATA_VERSION) response.setHeader('X-Partidata-Version', process.env.PARTIDATA_VERSION);
  // Neither header is CORS-safelisted, so a `fetch` cannot read them otherwise.
  response.setHeader('Access-Control-Expose-Headers', 'ETag, X-Partidata-Version');

  if (matchesEtag(request.headers['if-none-match'], resolution.etag)) {
    response.status(304).end();
    return;
  }

  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.setHeader('Content-Length', String(resolution.body.length));
  response.status(200);
  response.end(request.method === 'HEAD' ? undefined : resolution.body);
}
