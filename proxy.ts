import { EventEmitter } from 'events';
import http, {
  IncomingMessage,
  RequestOptions,
  Server,
  ServerResponse
} from 'http';
import url from 'url';
export default class LProxy extends EventEmitter {
  private requestId = 0;

  private server: Server | null = null;

  constructor(
    private options: { ip: string; port: number },
    private beforeSendRequest = async (id: string, req: IncomingMessage) => req,
    private beforeSendResponse = async (id: string, res: IncomingMessage) => res
  ) {
    super();
  }

  /**
   * start
   */
  public start() {
    if (!this.server) {
      const ip = this.options.ip;
      const port = this.options.port;
      this.server = http.createServer();
      this.server
        .on('listening', () => {
          this.emit('ready', { ip, port });
        })
        .on('request', this.requestHandler)
        .on('error', (err) => {
          this.emit('error', err);
        })
        .on('close', () => {
          this.emit('close');
        })
        .listen(port, ip);
    }
  }

  /**
   * close
   */
  public close() {
    if (this.server) {
      this.server.close();
    }
  }

  private async requestHandler(req: IncomingMessage, res: ServerResponse) {
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
  }

  private getRequestId() {
    return (this.requestId++).toString();
  }
}
