# ============================================================================
# Networking (Layer 3) — VPC foundation for all compute/data layers.
# ============================================================================
# Scope: VPC, Internet Gateway, 6 subnets (public / private-app / private-db
# across 2 AZs), route tables + associations, and an optional single NAT
# gateway for private-app egress (var.enable_nat_gateway). Security groups
# live in later layers; VPC endpoints in endpoints.tf.
# ----------------------------------------------------------------------------

resource "aws_vpc" "this" {
  cidr_block           = var.vpc_cidr
  enable_dns_support   = true
  enable_dns_hostnames = var.enable_dns_hostnames

  tags = merge(var.tags, { Name = "${var.name_prefix}-vpc" })
}

resource "aws_internet_gateway" "this" {
  vpc_id = aws_vpc.this.id

  tags = merge(var.tags, { Name = "${var.name_prefix}-igw" })
}

# --- Subnets -----------------------------------------------------------------
resource "aws_subnet" "public" {
  for_each = local.public_subnets

  vpc_id                  = aws_vpc.this.id
  cidr_block              = each.value
  availability_zone       = each.key
  map_public_ip_on_launch = true

  tags = merge(var.tags, {
    Name = "${var.name_prefix}-public-${each.key}"
    Tier = "public"
  })
}

resource "aws_subnet" "private_app" {
  for_each = local.private_app_subnets

  vpc_id            = aws_vpc.this.id
  cidr_block        = each.value
  availability_zone = each.key

  tags = merge(var.tags, {
    Name = "${var.name_prefix}-private-app-${each.key}"
    Tier = "private-app"
  })
}

resource "aws_subnet" "private_db" {
  for_each = local.private_db_subnets

  vpc_id            = aws_vpc.this.id
  cidr_block        = each.value
  availability_zone = each.key

  tags = merge(var.tags, {
    Name = "${var.name_prefix}-private-db-${each.key}"
    Tier = "private-db"
  })
}

# --- Public routing ----------------------------------------------------------
# One public route table (shared) with a default route to the Internet Gateway.
resource "aws_route_table" "public" {
  vpc_id = aws_vpc.this.id

  tags = merge(var.tags, { Name = "${var.name_prefix}-public-rt" })
}

resource "aws_route" "public_internet" {
  route_table_id         = aws_route_table.public.id
  destination_cidr_block = "0.0.0.0/0"
  gateway_id             = aws_internet_gateway.this.id
}

resource "aws_route_table_association" "public" {
  for_each = aws_subnet.public

  subnet_id      = each.value.id
  route_table_id = aws_route_table.public.id
}

# --- Private application routing ---------------------------------------------
# One route table PER AZ (local routes only for now). Per-AZ so a future NAT
# Gateway per AZ can be attached without re-associating subnets.
resource "aws_route_table" "private_app" {
  for_each = local.private_app_subnets

  vpc_id = aws_vpc.this.id

  tags = merge(var.tags, { Name = "${var.name_prefix}-private-app-${each.key}-rt" })
}

resource "aws_route_table_association" "private_app" {
  for_each = aws_subnet.private_app

  subnet_id      = each.value.id
  route_table_id = aws_route_table.private_app[each.key].id
}

# --- NAT gateway (opt-in, single) ---------------------------------------------
# One NAT gateway in the first public subnet gives every private-app subnet
# internet egress (ECR, CloudWatch Logs, Secrets Manager, ssmmessages/ECS Exec,
# Bedrock, ...). A SINGLE NAT is a deliberate cost choice (~$38/mo vs ~$105/mo
# for the interface-endpoint set it replaces): an AZ failure takes egress down
# with it, which staging accepts. Production should attach one NAT per AZ to
# the per-AZ route tables above before go-live.
resource "aws_eip" "nat" {
  count = var.enable_nat_gateway ? 1 : 0

  domain = "vpc"

  tags = merge(var.tags, { Name = "${var.name_prefix}-nat-eip" })
}

resource "aws_nat_gateway" "this" {
  count = var.enable_nat_gateway ? 1 : 0

  allocation_id = aws_eip.nat[0].id
  subnet_id     = aws_subnet.public[local.azs[0]].id

  tags = merge(var.tags, { Name = "${var.name_prefix}-nat" })

  # The NAT egresses through the IGW; make ordering explicit on create/destroy.
  depends_on = [aws_internet_gateway.this]
}

# Default route from every private-app route table to the (single) NAT.
resource "aws_route" "private_app_nat" {
  for_each = var.enable_nat_gateway ? local.private_app_subnets : {}

  route_table_id         = aws_route_table.private_app[each.key].id
  destination_cidr_block = "0.0.0.0/0"
  nat_gateway_id         = aws_nat_gateway.this[0].id
}

# --- Database routing --------------------------------------------------------
# One shared, isolated route table (local routes only, no internet path — ever).
resource "aws_route_table" "database" {
  vpc_id = aws_vpc.this.id

  tags = merge(var.tags, { Name = "${var.name_prefix}-database-rt" })
}

resource "aws_route_table_association" "database" {
  for_each = aws_subnet.private_db

  subnet_id      = each.value.id
  route_table_id = aws_route_table.database.id
}

# OPT-IN internet path for the DB tier. Off by default (the DB stays isolated).
# Enabled only for temporary, security-group-restricted developer access — it
# makes the DB subnets internet-routable, but reachability is still gated by the
# database security group (e.g. a single /32). Disable to re-isolate.
resource "aws_route" "database_internet" {
  count = var.enable_db_internet_route ? 1 : 0

  route_table_id         = aws_route_table.database.id
  destination_cidr_block = "0.0.0.0/0"
  gateway_id             = aws_internet_gateway.this.id
}
