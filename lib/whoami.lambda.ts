import { APIGatewayProxyHandlerV2 } from 'aws-lambda'

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  console.log({ event })
  return { statusCode: 200, body: JSON.stringify({ owner: process.env.OWNER_NAME, body: event.body }) }
}
