# Container registry module — outputs (consumed by compute + CI/CD).

output "repository_url" {
  description = "Repository URL (<account>.dkr.ecr.<region>.amazonaws.com/<name>). Set compute's container_image to <url>:<tag>."
  value       = aws_ecr_repository.this.repository_url
}

output "repository_arn" {
  description = "Repository ARN (scope CI/CD push permissions to this)."
  value       = aws_ecr_repository.this.arn
}

output "repository_name" {
  description = "Repository name."
  value       = aws_ecr_repository.this.name
}
