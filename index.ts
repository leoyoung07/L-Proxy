import { IncomingMessage } from 'http';
import LProxy from './proxy';

const beforeSendRequest = async (requestId: string, req: IncomingMessage) => {
  // tslint:disable-next-line:no-console
  console.log('........req:' + requestId + '\n' + JSON.stringify(req.headers));
  return req;
};
const beforeSendResponse = async (requestId: string, res: IncomingMessage) => {
  // tslint:disable-next-line:no-console
  console.log('........res:' + requestId + '\n' + JSON.stringify(res.headers));
  return res;
};

const proxy = new LProxy({ port: 7269 }, beforeSendRequest, beforeSendResponse);
proxy.start();
