import http, { IncomingMessage, RequestOptions } from 'http';
import url from 'url';

http
  .createServer()
  .on('request', (req: IncomingMessage, res: http.ServerResponse) => {
    // tslint:disable-next-line:no-console
    console.log(req.url);
    const urlObj = url.parse(req.url as string);
    const options: RequestOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port || 80,
      path: urlObj.path,
      method: req.method,
      headers: req.headers
    };
    const proxyReq = http
      .request(options, (proxyRes: IncomingMessage) => {
        res.writeHead(proxyRes.statusCode as number, proxyRes.headers);
        proxyRes.pipe(res);
      })
      .on('error', () => {
        res.end();
      });

    req.pipe(proxyReq);
  })
  .listen(7269, '0.0.0.0');
