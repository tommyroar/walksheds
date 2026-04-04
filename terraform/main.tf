terraform {
  required_version = ">= 1.5"

  required_providers {
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 5.0"
    }
  }
}

provider "cloudflare" {
  api_token = var.cloudflare_api_token
}

# ---------------------------------------------------------------------------
# Cloudflare Pages — static frontend
# ---------------------------------------------------------------------------

resource "cloudflare_pages_project" "frontend" {
  account_id        = var.cloudflare_account_id
  name              = "walksheds"
  production_branch = "main"

  build_config {
    build_command   = "npm run build"
    destination_dir = "dist"
  }

  deployment_configs {
    production {
      environment_variables = {
        VITE_MAPBOX_ACCESS_TOKEN = var.mapbox_access_token
        NODE_VERSION             = "20"
      }
    }

    preview {
      environment_variables = {
        VITE_MAPBOX_ACCESS_TOKEN = var.mapbox_access_token
        NODE_VERSION             = "20"
      }
    }
  }
}

# ---------------------------------------------------------------------------
# Cloudflare Worker — Python backend (container)
# ---------------------------------------------------------------------------

resource "cloudflare_worker_script" "backend" {
  account_id = var.cloudflare_account_id
  name       = "walksheds-api"
  content    = file("${path.module}/worker-stub.js")
  module     = true

  # Container deployment is configured via wrangler;
  # this resource manages the worker name and bindings.
}

# ---------------------------------------------------------------------------
# DNS (optional — uncomment when a custom domain is configured)
# ---------------------------------------------------------------------------

# data "cloudflare_zone" "main" {
#   filter = {
#     name = var.domain_name
#   }
# }

# resource "cloudflare_dns_record" "app" {
#   zone_id = data.cloudflare_zone.main.id
#   name    = "walksheds"
#   content = cloudflare_pages_project.frontend.subdomain
#   type    = "CNAME"
#   proxied = true
#   ttl     = 1
# }
