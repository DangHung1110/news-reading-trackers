import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Health endpoint', () => {
  let app: INestApplication;
  type SupertestApp = Parameters<typeof request>[0];
  const prismaMock = {
    checkConnection: jest.fn<Promise<void>, []>().mockResolvedValue(undefined),
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue(prismaMock)
      .compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns API and database status', async () => {
    await request(app.getHttpServer() as SupertestApp)
      .get('/health')
      .expect(200)
      .expect({ status: 'ok', database: 'connected' });
  });
});
