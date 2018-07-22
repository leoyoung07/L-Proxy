import http, { IncomingMessage, RequestOptions, ServerResponse } from 'http';
import url from 'url';

const beforeSendRequest = async (req: IncomingMessage) => {
  // tslint:disable-next-line:no-console
  console.log('........req:' + JSON.stringify(req.headers));
  return req;
};

const beforeSendResponse = async (res: IncomingMessage) => {
  // tslint:disable-next-line:no-console
  console.log('........res:' + JSON.stringify(res.headers));
  return res;
};

http
  .createServer()
  .on('request', async (req: IncomingMessage, res: ServerResponse) => {
    const urlObj = url.parse(req.url as string);
    const options: RequestOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port || 80,
      path: urlObj.path,
      method: req.method,
      headers: req.headers
    };
    const proxyReq = http
      .request(options, async (proxyRes: IncomingMessage) => {
        proxyRes = await beforeSendResponse(proxyRes);
        res.writeHead(proxyRes.statusCode as number, proxyRes.headers);
        proxyRes.pipe(res);
      })
      .on('error', () => {
        res.end();
      });
    req = await beforeSendRequest(req);
    req.pipe(proxyReq);
  })
  .listen(7269, '0.0.0.0');
