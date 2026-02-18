output "domain_name" {
  description = "Primary domain name"
  value       = aws_route53_record.app.name
}

output "www_domain_name" {
  description = "WWW subdomain name"
  value       = length(aws_route53_record.app_www) > 0 ? aws_route53_record.app_www[0].name : ""
}

output "health_check_id" {
  description = "Route53 health check ID"
  value       = length(aws_route53_health_check.app) > 0 ? aws_route53_health_check.app[0].id : ""
}
