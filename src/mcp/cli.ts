#!/usr/bin/env node
import * as net from 'net';
import * as readline from 'readline';

const PORT = parseInt(process.env.AIRFLOW_MCP_PORT || '37115', 10);
const HOST = process.env.AIRFLOW_MCP_HOST || '127.0.0.1';

function fail(message: string) {
  process.stderr.write(`MCP Client Error: ${message}\n`);
  process.exit(1);
}

let socketBuffer = '';
const socket = net.createConnection({ host: HOST, port: PORT }, () => {
  const rl = readline.createInterface({ input: process.stdin });
  rl.on('line', (line) => {
    const trimmed = (line || '').trim();
    if (trimmed.length === 0) { return; }
    socket.write(trimmed + '\n');
  });
  rl.on('close', () => {
    socket.end();
  });
});

socket.on('data', (data) => {
  socketBuffer += data.toString('utf-8');
  const lines = socketBuffer.split(/\r?\n/);
  socketBuffer = lines.pop() || '';
  for (const l of lines) {
    const trimmed = l.trim();
    if (trimmed) {
      process.stdout.write(trimmed + '\n');
    }
  }
});

socket.on('error', (err) => {
  fail(`Cannot connect to MCP bridge at ${HOST}:${PORT}. Start it in VS Code via 'Airflow: Start MCP Server'. Detail: ${err.message}`);
});

socket.on('close', () => process.exit(0));
