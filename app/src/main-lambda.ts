import { NestFactory } from '@nestjs/core';
import { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { AppModule } from './app.module';
import { configure } from '@vendia/serverless-express';

const serverLoader = (async () => {
  const app = await NestFactory.create(AppModule);
  await app.init();
  const expressApp = app.getHttpAdapter().getInstance();
  return configure({ app: expressApp });
})();

export const handler: APIGatewayProxyHandlerV2 = async (event, context, callback) => {
  const server = await serverLoader;
  return server(event, context, callback)
}
