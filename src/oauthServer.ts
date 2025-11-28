import * as http from 'http';
import * as url from 'url';
import * as ui from './ui';

export class OAuthCallbackServer {
    private server: http.Server | undefined;
    private port: number = 54321; // Default port, can be configurable

    constructor(port?: number) {
        if (port) {
            this.port = port;
        }
    }

    public async start(): Promise<string> {
        return new Promise((resolve, reject) => {
            this.server = http.createServer((req, res) => {
                try {
                    if (!req.url) {
                        res.writeHead(400);
                        res.end('Invalid request');
                        return;
                    }

                    const parsedUrl = url.parse(req.url, true);
                    const query = parsedUrl.query;

                    if (query.code) {
                        const code = Array.isArray(query.code) ? query.code[0] : query.code;
                        
                        res.writeHead(200, { 'Content-Type': 'text/html' });
                        res.end('<h1>Authentication Successful</h1><p>You can close this window and return to VS Code.</p><script>window.close()</script>');
                        
                        resolve(code as string);
                    } else if (query.error) {
                        res.writeHead(400, { 'Content-Type': 'text/html' });
                        res.end(`<h1>Authentication Failed</h1><p>${query.error}</p>`);
                        reject(new Error(query.error as string));
                    } else {
                        res.writeHead(404);
                        res.end('Not found');
                    }
                } catch (error) {
                    reject(error);
                } finally {
                    // Close the server after handling the request
                    this.stop();
                }
            });

            this.server.listen(this.port, () => {
                ui.logToOutput(`OAuth callback server listening on port ${this.port}`);
            });

            this.server.on('error', (err) => {
                reject(err);
            });
        });
    }

    public stop() {
        if (this.server) {
            this.server.close();
            this.server = undefined;
        }
    }
}
