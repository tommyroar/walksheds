output "pages_url" {
  description = "Cloudflare Pages URL for the frontend"
  value       = "https://${cloudflare_pages_project.frontend.subdomain}"
}

output "worker_name" {
  description = "Name of the deployed Cloudflare Worker"
  value       = cloudflare_worker_script.backend.name
}
