import serverless from 'serverless-http';
import { app } from './index';
import { Context, APIGatewayProxyEvent } from 'aws-lambda';

const serverlessHandler = serverless(app);

export async function handler(event: APIGatewayProxyEvent, context: Context) {
  context.callbackWaitsForEmptyEventLoop = false;
  return serverlessHandler(event, context);
}
