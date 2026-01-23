import { VercelRequest, VercelResponse } from '@vercel/node';
import { adapter, bot } from '../src/adapter';

export default async function handler(request: VercelRequest, response: VercelResponse) {
  if (request.method === 'POST') {
    // The Bot Framework adapter expects standard Node.js request/response objects.
    // VercelRequest and VercelResponse are compatible.
    await adapter.process(request, response, (context) => bot.run(context));
  } else {
    response.status(405).send('Method Not Allowed');
  }
}
