import { Module } from '@nestjs/common';
import { S3 } from "aws-sdk";
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { OpenTelemetryModuleConfig } from "./tracing";

@Module({
  imports: [OpenTelemetryModuleConfig],
  controllers: [AppController],
  providers: [AppService, {
    useClass: S3,
    provide: S3
  }],
})
export class AppModule {}
