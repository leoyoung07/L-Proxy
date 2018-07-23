import http, { IncomingMessage, RequestOptions, ServerResponse } from 'http';
import url from 'url';
export default class LProxy {

  private requestId = 0;

  constructor(
    private beforeSendRequest = async (id: string, req: IncomingMessage) => req,
    private beforeSendResponse = async (id: string, res: IncomingMessage) => res
  ) {

  }

  public start() {
    http
    .createServer()
    .on('request', async (req: IncomingMessage, res: ServerResponse) => {
      const requestId = this.getRequestId();
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
          proxyRes = await this.beforeSendResponse(requestId, proxyRes);
          res.writeHead(proxyRes.statusCode as number, proxyRes.headers);
          proxyRes.pipe(res);
        })
        .on('error', () => {
          res.end();
        });
      req = await this.beforeSendRequest(requestId, req);
      req.pipe(proxyReq);
    })
    .listen(7269, '0.0.0.0');
  }

  private getRequestId() {
    return (this.requestId++).toString();
  }
}
