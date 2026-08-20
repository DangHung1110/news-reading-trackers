import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import type { HealthResponse } from '@news-tracker/contracts';

import { PrismaService } from '../prisma/prisma.service';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @ApiOperation({ summary: 'Check API and PostgreSQL connectivity' })
  @ApiOkResponse({
    schema: {
      example: { status: 'ok', database: 'connected' },
    },
  })
  async check(): Promise<HealthResponse> {
    await this.prisma.checkConnection();

    return {
      status: 'ok',
      database: 'connected',
    };
  }
}
