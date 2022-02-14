import { Controller, Get, Param, ParseIntPipe, Query, StreamableFile } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {
  }

  @Get("/")
  health() {
    return { message: 'Have a nice day!' }
  }

  @Get("/image")
  async getHello(@Query('width', ParseIntPipe) width: number,
                 @Query('height', ParseIntPipe) height: number,
                 @Query('key') key: string) {
    return new StreamableFile(await this.appService.getImageResized({ width, height, key }), {
      type: 'image/png'
    })
  }
}
