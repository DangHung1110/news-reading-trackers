import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { DashboardService } from './dashboard.service';
import { DashboardAnalyticsQueryDto } from './dto/dashboard-analytics-query.dto';

@ApiTags('dashboard')
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get()
  @ApiOperation({ summary: 'Get dashboard summary and recent activity' })
  getSummary() {
    return this.dashboardService.getSummary();
  }

  @Get('analytics')
  @ApiOperation({ summary: 'Get reading analytics by date, domain and activity status' })
  getAnalytics(@Query() query: DashboardAnalyticsQueryDto) {
    return this.dashboardService.getAnalytics(query);
  }
}
