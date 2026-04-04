variable "cloudflare_api_token" {
  description = "Cloudflare API token with Workers and Pages permissions"
  type        = string
  sensitive   = true
}

variable "cloudflare_account_id" {
  description = "Cloudflare account ID"
  type        = string
}

variable "mapbox_access_token" {
  description = "Mapbox access token for frontend builds"
  type        = string
  sensitive   = true
}

variable "domain_name" {
  description = "Custom domain (optional, uncomment DNS resources in main.tf)"
  type        = string
  default     = ""
}
