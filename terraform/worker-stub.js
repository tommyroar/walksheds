// Stub worker — replaced by container deployment via wrangler.
// This file exists so `terraform plan` can validate the worker_script resource.
export default {
  async fetch(request) {
    return new Response("walksheds-api stub — deploy via wrangler for container runtime", {
      status: 200,
      headers: { "Content-Type": "text/plain" },
    });
  },
};
