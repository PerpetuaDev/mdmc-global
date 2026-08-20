export default {
  async fetch(request, env) {
    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }
    if (request.headers.get('X-Relay-Secret') !== env.RELAY_SECRET) {
      return new Response('Forbidden', { status: 403 });
    }

    const res = await fetch(
      'https://api.github.com/repos/PerpetuaDev/mdmc-global/dispatches',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${env.GITHUB_PAT}`,
          Accept: 'application/vnd.github+json',
          'Content-Type': 'application/json',
          'User-Agent': 'mdmc-strapi-relay',
        },
        body: JSON.stringify({ event_type: 'strapi-publish' }),
      }
    );

    return new Response(res.ok ? 'OK' : `GitHub error ${res.status}`, {
      status: res.ok ? 200 : 502,
    });
  },
};
