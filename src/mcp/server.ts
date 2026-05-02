import * as net from 'net';

const port = parseInt(process.env.AIRFLOW_MCP_PORT || '37115', 10) || 37115;
const host = process.env.AIRFLOW_MCP_HOST || '127.0.0.1';

const socket = net.createConnection({ host, port }, () => {
    process.stdin.pipe(socket);
    socket.pipe(process.stdout);
    socket.on('end', () => process.exit(0));
});

socket.on('error', (err: NodeJS.ErrnoException) => {
    process.stderr.write(
        `Airflow MCP bridge is not running on ${host}:${port}.\n` +
        `Please run "Airflow: Start MCP Server" in the command palette first.\n` +
        `Error: ${err.message}\n`
    );
    process.exit(1);
});
