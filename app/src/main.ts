import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { NestLoggerAdapter } from "./logging.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: new NestLoggerAdapter()
  });
  await app.listen(80);
}

bootstrap()
