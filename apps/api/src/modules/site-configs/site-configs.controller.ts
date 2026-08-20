import { Body, Controller, Get, Param, Post, Put, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { CreateSiteConfigDto } from './dto/create-site-config.dto';
import { SiteConfigQueryDto } from './dto/site-config-query.dto';
import { UpdateSiteConfigDto } from './dto/update-site-config.dto';
import { SiteConfigsService } from './site-configs.service';

@ApiTags('site-configs')
@Controller('site-configs')
export class SiteConfigsController {
  constructor(private readonly siteConfigsService: SiteConfigsService) {}

  @Get()
  @ApiOperation({ summary: 'List configurable news sites' })
  findAll(@Query() query: SiteConfigQueryDto) {
    return this.siteConfigsService.findAll(query);
  }

  @Post()
  @ApiOperation({ summary: 'Create a news site configuration' })
  create(@Body() body: CreateSiteConfigDto) {
    return this.siteConfigsService.create(body);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a news site configuration' })
  update(@Param('id') id: string, @Body() body: UpdateSiteConfigDto) {
    return this.siteConfigsService.update(id, body);
  }
}
