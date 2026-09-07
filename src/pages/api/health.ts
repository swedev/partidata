import type { NextApiRequest, NextApiResponse } from 'next';

import { readDataCommit } from 'src/server/data-commit';
import { partyData } from 'src/server/party-data';

export default async function handler (request: NextApiRequest, response: NextApiResponse) {
  response.setHeader('Cache-Control', 'no-store');
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    response.setHeader('Allow', 'GET, HEAD');
    response.status(405).end();
    return;
  }

  // The commit is read before the registry is asserted, so that a broken
  // registry still says which data it was reading.
  let data: { data?: { commit: string } } = {};
  try {
    const commit = await readDataCommit();
    if (commit) data = { data: { commit } };
    await partyData.assertHealthy();
    response.status(200);
    if (request.method === 'HEAD') response.end();
    else response.json({ status: 'ok', version: process.env.PARTIDATA_VERSION, ...data });
  } catch (error) {
    console.error('Hälsokontrollen misslyckades', error);
    response.status(500);
    if (request.method === 'HEAD') response.end();
    else response.json({ status: 'error', version: process.env.PARTIDATA_VERSION, ...data });
  }
}
