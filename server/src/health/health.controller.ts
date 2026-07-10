import { Controller, Get } from '@nestjs/common';

/**
 * Unauthenticated liveness endpoint for the container HEALTHCHECK and the ALB
 * target-group health check. With the global `api` prefix this is `/api/health`.
 * Intentionally dependency-free (no DB call) so it reflects process liveness and
 * does not flap on transient database blips.
 */
@Controller('health')
export class HealthController {
  @Get()
  check() {
    return { status: 'ok' };
  }
}
