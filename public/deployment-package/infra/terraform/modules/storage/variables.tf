variable "name_prefix" {
  description = "Prefix for resource names"
  type        = string
}

variable "recordings_bucket" {
  description = "S3 bucket name for recordings"
  type        = string
}

variable "retention_days" {
  description = "Number of days to retain recordings"
  type        = number
}

variable "enable_versioning" {
  description = "Enable S3 versioning"
  type        = bool
  default     = false
}

variable "enable_encryption" {
  description = "Enable S3 encryption"
  type        = bool
  default     = true
}

variable "application_role_arn" {
  description = "IAM role ARN for application access"
  type        = string
  default     = "*"
}

variable "tags" {
  description = "Tags to apply to resources"
  type        = map(string)
  default     = {}
}
