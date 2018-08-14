import { EventEmitter } from 'events';
import http, {
  IncomingMessage,
  RequestOptions,
  Server,
  ServerResponse
} from 'http';
import net from 'net';
import url from 'url';

// tslint:disable-next-line:interface-name
declare interface LProxy {
  on(event: 'ready', listener: (state: IEndPoint) => void): this;
  on(event: 'connect', listener: (req: IncomingMessage) => void): this;
  on(event: 'error', listener: (error: Error) => void): this;
  on(event: 'close', listener: () => void): this;
}

interface IEndPoint {
  ip: string;
  port: number;
}

class LProxy extends EventEmitter {
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
        .on('request', this.requestHandler.bind(this))
        .on('connect', this.connectHandler.bind(this))
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

  private async connectHandler(req: IncomingMessage, sock: net.Socket) {
    this.emit('connect', req);
    const urlObj = url.parse('http://' + req.url as string);
    const proxySock = net.connect(
      parseInt(urlObj.port!, 10),
      urlObj.hostname!,
      () => {
        sock.write('HTTP/1.1 200 Connection Established\r\n\r\n');
        proxySock.pipe(sock);
      }
    );
    proxySock.on('error', (err) => {
      // tslint:disable-next-line:no-console
      console.log(`error: ${err.message}`);
      sock.end();
    });
    sock.pipe(proxySock);
  }

  private getRequestId() {
    return (this.requestId++).toString();
  }
}

export default LProxy;
