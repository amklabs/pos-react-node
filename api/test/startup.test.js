const assert = require('node:assert/strict');
const { spawn, spawnSync } = require('node:child_process');
const net = require('node:net');
const path = require('node:path');
const test = require('node:test');

const API_DIRECTORY = path.resolve(__dirname, '..');
const TEST_DATABASE_URL = 'postgresql://test:test@127.0.0.1:5432/test';

function runNode(script, env = {}) {
    return spawnSync(process.execPath, ['-e', script], {
        cwd: API_DIRECTORY,
        env: { ...process.env, ...env },
        encoding: 'utf8'
    });
}

async function reservePort() {
    const server = net.createServer();
    await new Promise((resolve, reject) => {
        server.once('error', reject);
        server.once('listening', resolve);
        server.listen(0);
    });
    return { port: server.address().port, server };
}

async function getAvailablePort() {
    const { port, server } = await reservePort();
    await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    return port;
}

test('loads api/.env without overriding an existing DATABASE_URL', () => {
    const script = `
        const path = require('node:path');
        const dotenv = require('dotenv');
        const config = dotenv.config;
        let loadedPath;
        dotenv.config = options => {
            loadedPath = options.path;
            const result = config(options);
            if (result.error) throw result.error;
            return result;
        };
        require('./index');
        if (loadedPath !== path.resolve(__dirname, '.env')) throw new Error('api/.env was not loaded');
        if (process.env.DATABASE_URL !== '${TEST_DATABASE_URL}') throw new Error('existing DATABASE_URL was overwritten');
    `;
    const result = runNode(script, { DATABASE_URL: TEST_DATABASE_URL });

    assert.equal(result.status, 0, result.stderr);
});

test('does not listen when the API app is imported', async () => {
    const port = await getAvailablePort();
    const script = `
        require('./index');
        const server = require('node:net').createServer();
        server.listen(Number(process.env.PORT), '127.0.0.1', () => server.close());
    `;
    const result = runNode(script, { DATABASE_URL: TEST_DATABASE_URL, PORT: String(port) });

    assert.equal(result.status, 0, result.stderr);
});

test('uses an available port when the configured port is occupied', async () => {
    const reserved = await reservePort();
    const child = spawn(process.execPath, ['index.js'], {
        cwd: API_DIRECTORY,
        env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL, PORT: String(reserved.port) },
        stdio: ['ignore', 'pipe', 'pipe']
    });
    let output = '';
    child.stdout.setEncoding('utf8').on('data', chunk => output += chunk);
    child.stderr.setEncoding('utf8').on('data', chunk => output += chunk);

    try {
        let response;
        let listeningPort;
        const deadline = Date.now() + 5000;
        while (Date.now() < deadline) {
            if (child.exitCode !== null) break;
            const match = output.match(/API server listening on port (\d+)/);
            if (match) {
                listeningPort = Number(match[1]);
                try {
                    response = await fetch(`http://127.0.0.1:${listeningPort}/`);
                    break;
                } catch {
                    await new Promise(resolve => setTimeout(resolve, 50));
                }
            } else {
                await new Promise(resolve => setTimeout(resolve, 50));
            }
        }

        assert.ok(listeningPort, `API did not start. Output: ${output}`);
        assert.notEqual(listeningPort, reserved.port);
        assert.ok(response, `API did not respond. Output: ${output}`);
        assert.equal(response.status, 200);
        assert.equal(await response.text(), 'Hello World!');
    } finally {
        child.kill();
        if (child.exitCode === null) {
            await new Promise(resolve => child.once('exit', resolve));
        }
        await new Promise((resolve, reject) => reserved.server.close(error => error ? reject(error) : resolve()));
    }
});

test('starts directly on the configured port and serves the root route', async () => {
    const port = await getAvailablePort();
    const child = spawn(process.execPath, ['index.js'], {
        cwd: API_DIRECTORY,
        env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL, PORT: String(port) },
        stdio: ['ignore', 'pipe', 'pipe']
    });
    let output = '';
    child.stdout.setEncoding('utf8').on('data', chunk => output += chunk);
    child.stderr.setEncoding('utf8').on('data', chunk => output += chunk);

    try {
        let response;
        const deadline = Date.now() + 5000;
        while (Date.now() < deadline) {
            if (child.exitCode !== null) break;
            try {
                response = await fetch(`http://127.0.0.1:${port}/`);
                break;
            } catch {
                await new Promise(resolve => setTimeout(resolve, 50));
            }
        }

        assert.ok(response, `API did not start. Output: ${output}`);
        assert.equal(response.status, 200);
        assert.equal(await response.text(), 'Hello World!');
    } finally {
        child.kill();
        if (child.exitCode === null) {
            await new Promise(resolve => child.once('exit', resolve));
        }
    }
});