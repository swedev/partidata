import type { NextApiRequest, NextApiResponse } from 'next';

import { partyData } from 'src/server/party-data';

export default async function handler (request: NextApiRequest, response: NextApiResponse) {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    response.setHeader('Allow', 'GET, HEAD');
    response.status(405).end();
    return;
  }

  const { filnamn, bild } = request.query;
  if (typeof filnamn !== 'string' || typeof bild !== 'string') {
    response.status(404).end();
    return;
  }

  const symbol = await partyData.readPartySymbol(filnamn, bild);
  if (!symbol) {
    response.status(404).end();
    return;
  }

  response.setHeader('Cache-Control', 'public, max-age=3600');
  response.setHeader('Content-Length', String(symbol.body.length));
  response.setHeader('Content-Type', symbol.contentType);
  response.status(200);
  response.end(request.method === 'HEAD' ? undefined : symbol.body);
}
