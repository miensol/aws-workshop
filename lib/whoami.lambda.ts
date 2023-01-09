import { APIGatewayProxyHandlerV2 } from 'aws-lambda'

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  const owner = process.env.OWNER_NAME
  console.log({ event, owner })
  return { statusCode: 200, body: JSON.stringify({ owner: owner, body: event.body }) }
}
