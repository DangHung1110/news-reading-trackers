import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { SessionQueryDto } from './dto/session-query.dto';
import { SessionsService } from './sessions.service';

@ApiTags('sessions')
@Controller('sessions')
export class SessionsController {
  constructor(private readonly sessionsService: SessionsService) {}

  @Get()
  @ApiOperation({ summary: 'List reading sessions' })
  findAll(@Query() query: SessionQueryDto) {
    return this.sessionsService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a reading session and its event timeline' })
  findOne(@Param('id') id: string) {
    return this.sessionsService.findOne(id);
  }
}
