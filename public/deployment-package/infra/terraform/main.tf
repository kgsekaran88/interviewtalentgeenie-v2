# Main Terraform Configuration for Interview Platform Deployment
# This is the root module that orchestrates all infrastructure components

terraform {
  required_version = ">= 1.5.0"
  
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  # Backend configuration - customer provides their own S3 bucket
  backend "s3" {
    # These values should be provided via backend config file
    # bucket = "customer-terraform-state"
    # key    = "ias-platform/terraform.tfstate"
    # region = "ap-south-1"
    # encrypt = true
    # dynamodb_table = "terraform-state-lock"
  }
}

# Provider configuration
provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = var.project_name
      Environment = var.environment
      ManagedBy   = "Terraform"
      DeployedBy  = "IAS-Deployment-Configurator"
    }
  }
}

# Local variables
locals {
  name_prefix = "${var.project_name}-${var.environment}"
  
  common_tags = {
    Project     = var.project_name
    Environment = var.environment
    Terraform   = "true"
  }
}

# VPC Module
module "vpc" {
  source = "./modules/vpc"

  name_prefix = local.name_prefix
  vpc_cidr    = var.vpc_cidr
  azs         = var.availability_zones

  tags = local.common_tags
}

# Database Module
module "database" {
  source = "./modules/database"

  name_prefix       = local.name_prefix
  vpc_id            = module.vpc.vpc_id
  subnet_ids        = module.vpc.private_subnet_ids
  security_group_id = module.vpc.db_security_group_id

  engine_version  = var.db_engine_version
  instance_class  = var.db_instance_class
  allocated_storage = var.db_storage_gb
  database_name   = replace(var.project_name, "-", "_")

  tags = local.common_tags
}

# Object Storage Module (S3)
module "storage" {
  source = "./modules/storage"

  name_prefix          = local.name_prefix
  recordings_bucket    = var.recordings_bucket_name
  retention_days       = var.recordings_retention_days
  enable_versioning    = var.enable_storage_versioning
  enable_encryption    = true

  tags = local.common_tags
}

# Application Load Balancer
module "alb" {
  source = "./modules/alb"

  name_prefix       = local.name_prefix
  vpc_id            = module.vpc.vpc_id
  public_subnet_ids = module.vpc.public_subnet_ids
  security_group_id = module.vpc.alb_security_group_id
  certificate_arn   = var.create_certificate ? module.certificate[0].certificate_arn : var.existing_certificate_arn

  tags = local.common_tags
}

# SSL Certificate (ACM)
module "certificate" {
  count  = var.create_certificate ? 1 : 0
  source = "./modules/certificate"

  domain_name = var.domain_name
  zone_id     = var.route53_zone_id

  tags = local.common_tags
}

# ECS Cluster & Service
module "ecs" {
  source = "./modules/ecs"

  name_prefix           = local.name_prefix
  vpc_id                = module.vpc.vpc_id
  private_subnet_ids    = module.vpc.private_subnet_ids
  alb_target_group_arn  = module.alb.target_group_arn
  
  container_image       = var.container_image
  container_port        = var.container_port
  app_instance_type     = var.app_instance_type
  min_capacity          = var.min_replicas
  max_capacity          = var.max_replicas

  # Environment variables
  environment_variables = {
    DATABASE_URL         = module.database.connection_string
    RECORDINGS_BUCKET    = module.storage.recordings_bucket_id
    AWS_REGION           = var.aws_region
    ENVIRONMENT          = var.environment
  }

  # Secrets from Secrets Manager
  secrets_arn = module.secrets.secrets_arn

  tags = local.common_tags
}

# Secrets Manager
module "secrets" {
  source = "./modules/secrets"

  name_prefix = local.name_prefix
  
  # Placeholder secrets - customer must populate these manually
  secrets = {
    JWT_SECRET       = "***REPLACE_MANUALLY***"
    DB_PASSWORD      = module.database.master_password_secret_arn
    SMTP_PASSWORD    = "***REPLACE_MANUALLY***"
    OPENAI_API_KEY   = "***REPLACE_MANUALLY***"
    STRIPE_API_KEY   = "***REPLACE_MANUALLY***"
  }

  tags = local.common_tags
}

# CloudWatch Monitoring
module "monitoring" {
  count  = var.enable_monitoring ? 1 : 0
  source = "./modules/monitoring"

  name_prefix    = local.name_prefix
  ecs_cluster_id = module.ecs.cluster_id
  ecs_service_id = module.ecs.service_id
  alb_arn_suffix = module.alb.alb_arn_suffix
  
  alert_emails   = var.alert_emails

  tags = local.common_tags
}

# Route53 DNS Records
module "dns" {
  count  = var.create_dns_record ? 1 : 0
  source = "./modules/dns"

  zone_id     = var.route53_zone_id
  domain_name = var.domain_name
  alb_dns_name = module.alb.alb_dns_name
  alb_zone_id  = module.alb.alb_zone_id

  tags = local.common_tags
}

# Outputs
output "application_url" {
  description = "URL to access the deployed application"
  value       = "https://${var.domain_name}"
}

output "database_endpoint" {
  description = "Database endpoint"
  value       = module.database.endpoint
  sensitive   = true
}

output "recordings_bucket" {
  description = "S3 bucket for recordings"
  value       = module.storage.recordings_bucket_id
}

output "alb_dns_name" {
  description = "ALB DNS name"
  value       = module.alb.alb_dns_name
}

output "ecs_cluster_name" {
  description = "ECS cluster name"
  value       = module.ecs.cluster_name
}

output "secrets_manager_arns" {
  description = "ARNs of secrets in Secrets Manager"
  value       = module.secrets.secrets_arns
  sensitive   = true
}
