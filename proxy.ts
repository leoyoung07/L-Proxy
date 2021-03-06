import { EventEmitter } from 'events';
import http, {
  IncomingMessage,
  RequestOptions,
  Server,
  ServerResponse
} from 'http';
import Koa from 'koa';
import net from 'net';
import url from 'url';

type Middleware = () => void;

class LProxy extends EventEmitter {
  private counter = 0;
  private requestId: string;

  private middleware: Middleware[] = [];

  private app: Koa | null;

  private server: Server | null;

  private proxyRes: IncomingMessage | null;

  constructor(
    private options: { ip: string; port: number },
    private beforeSendRequest = async (id: string, req: IncomingMessage) => req,
    private beforeSendResponse = async (id: string, res: ServerResponse) => res
  ) {
    super();
    this.app = null;
    this.server = null;
    this.proxyRes = null;
    this.requestId = '';
  }

  /**
   * use
   */
  public use(fn: () => void) {
    this.middleware.push(fn);
    return this;
  }

  /**
   * start
   */
  public start() {
    if (!this.app) {
      this.app = new Koa();
      // 收到请求 修改请求
      this.app.use(async (ctx, next) => {
        this.requestId = this.getNextRequestId();
        await this.beforeSendRequest(this.requestId, ctx.req);
        await next();
      });
      // 转发请求
      this.app.use(async (ctx, next) => {
        // 发送修改后的请求到服务器
        // 收到服务器响应
        const urlObj = url.parse(ctx.req.url as string);
        const options: RequestOptions = {
          hostname: urlObj.hostname,
          port: urlObj.port || 80,
          path: urlObj.path,
          method: ctx.req.method,
          headers: ctx.req.headers
        };
        await new Promise((resolve, reject) => {
          const proxyReq = http
            .request(options, async (proxyRes: IncomingMessage) => {
              this.proxyRes = proxyRes;
              await next();
            });
          ctx.req.pipe(proxyReq);
          proxyReq.on('error', (e) => {
            // tslint:disable-next-line:no-console
            console.error(`请求遇到问题: ${e.message}`);
          });
        });
      });
      // 收到响应 修改响应
      this.app.use(async (ctx, next) => {
        await this.beforeSendResponse(this.getNextRequestId(), ctx.res);
        await next();
      });
      // 返回响应
      this.app.use(async (ctx, next) => {
        if (this.proxyRes) {
          ctx.res.writeHead(this.proxyRes.statusCode as number, this.proxyRes.headers);
          this.proxyRes.pipe(ctx.res);
        }
      });

      this.app.on('error', (e: Error) => {
        // tslint:disable-next-line:no-console
        console.log(e);
      });

      this.server = this.app.listen(this.options.port, this.options.ip);
    }
  }

  /**
   * close
   */
  public close() {
    if (this.server) {
      this.server.close();
      this.server = null;
      this.app = null;
    }
  }

  private async connectHandler(req: IncomingMessage, sock: net.Socket) {
    this.emit('connect', req);
    const urlObj = url.parse(('http://' + req.url) as string);
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

  private getNextRequestId() {
    return (this.counter++).toString();
  }
}

export default LProxy;
