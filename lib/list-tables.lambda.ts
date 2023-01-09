import { APIGatewayProxyHandlerV2 } from 'aws-lambda'
import { createConnection } from 'mysql2/promise'
import { SecretsManager } from 'aws-sdk'

const ssm = new SecretsManager({})

const databaseCredentials = (async () => {
  try {
    const secret = await ssm.getSecretValue({
      SecretId: process.env.DATABASE_CREDENTIALS_SECRET_ID!,
    }).promise()
    return JSON.parse(secret.SecretString!)
  } catch (e) {
    console.error('Failed to resolve database credentials', e)
    throw e;
  }
})()

const connection = (async () => {
  const credentials = await databaseCredentials
  const connection = await createConnection({
    port: 3306,
    host: process.env.DATABASE_HOST,
    user: credentials.username,
    password: credentials.password,
    database: process.env.DATABASE_NAME
  })
  await connection.connect()
  return connection
})()

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  const conn = await connection

  const [rows, fields] = await conn.execute('SHOW FULL PROCESSLIST')
  console.log('Got', {
    rows, fields
  })
  return {
    statusCode: 200,
    body: JSON.stringify(
      { rows, fields }
    )
  }
}
