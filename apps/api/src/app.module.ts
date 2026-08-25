import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { validateEnvironment } from './config/environment';
import { HealthModule } from './health/health.module';
import { ArticlesModule } from './modules/articles/articles.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { EventsModule } from './modules/events/events.module';
import { SessionsModule } from './modules/sessions/sessions.module';
import { SiteConfigsModule } from './modules/site-configs/site-configs.module';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      cache: true,
      envFilePath: ['../../.env', '.env'],
      isGlobal: true,
      validate: validateEnvironment,
    }),
    PrismaModule,
    HealthModule,
    ArticlesModule,
    DashboardModule,
    SessionsModule,
    EventsModule,
    SiteConfigsModule,
  ],
})
export class AppModule {}
