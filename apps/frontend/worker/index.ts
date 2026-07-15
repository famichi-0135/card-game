export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname.startsWith("/api/")) {
      return env.BACKEND.fetch(request);
    }
    return new Response(null, { status: 404 });
  },
} satisfies ExportedHandler<Env>;
