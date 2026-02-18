# Terraform Variables for IAS Platform Deployment
# These variables map to the UI configurator fields

# Project Configuration
variable "project_name" {
  description = "Name of the project"
  type        = string
}

variable "environment" {
  description = "Deployment environment (staging/production)"
  type        = string
  validation {
    condition     = contains(["staging", "production"], var.environment)
    error_message = "Environment must be either staging or production."
  }
}

# Cloud Configuration
variable "aws_region" {
  description = "AWS region for deployment"
  type        = string
  default     = "ap-south-1"
}

variable "vpc_cidr" {
  description = "CIDR block for VPC"
  type        = string
  default     = "10.0.0.0/16"
}

variable "availability_zones" {
  description = "List of availability zones"
  type        = list(string)
  default     = ["ap-south-1a", "ap-south-1b"]
}

# Domain Configuration
variable "domain_name" {
  description = "Domain name for the application"
  type        = string
}

variable "create_certificate" {
  description = "Whether to create a new SSL certificate"
  type        = bool
  default     = true
}

variable "existing_certificate_arn" {
  description = "ARN of existing ACM certificate (if create_certificate is false)"
  type        = string
  default     = ""
}

variable "route53_zone_id" {
  description = "Route53 hosted zone ID"
  type        = string
  default     = ""
}

variable "create_dns_record" {
  description = "Whether to create DNS record in Route53"
  type        = bool
  default     = true
}

# Compute Configuration
variable "app_instance_type" {
  description = "Instance type for application servers"
  type        = string
  default     = "t3.medium"
}

variable "min_replicas" {
  description = "Minimum number of application replicas"
  type        = number
  default     = 2
}

variable "max_replicas" {
  description = "Maximum number of application replicas"
  type        = number
  default     = 4
}

variable "container_image" {
  description = "Docker container image for the application"
  type        = string
}

variable "container_port" {
  description = "Port exposed by the container"
  type        = number
  default     = 3000
}

# Database Configuration
variable "db_engine_version" {
  description = "PostgreSQL engine version"
  type        = string
  default     = "14"
}

variable "db_instance_class" {
  description = "RDS instance class"
  type        = string
  default     = "db.t3.medium"
}

variable "db_storage_gb" {
  description = "Database storage size in GB"
  type        = number
  default     = 100
}

# Storage Configuration
variable "recordings_bucket_name" {
  description = "S3 bucket name for recordings"
  type        = string
}

variable "recordings_retention_days" {
  description = "Number of days to retain recordings"
  type        = number
  default     = 90
}

variable "enable_storage_versioning" {
  description = "Enable S3 versioning"
  type        = bool
  default     = false
}

# Monitoring Configuration
variable "enable_monitoring" {
  description = "Enable CloudWatch monitoring and alarms"
  type        = bool
  default     = true
}

variable "alert_emails" {
  description = "Email addresses for CloudWatch alarms"
  type        = list(string)
  default     = []
}

# Tags
variable "additional_tags" {
  description = "Additional tags to apply to all resources"
  type        = map(string)
  default     = {}
}
