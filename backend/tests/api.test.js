import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import app from '../src/app.js';
import { isDockerAvailable } from '../src/services/docker.service.js';

describe('Compilix API Tests', () => {
  // 1. Health endpoint
  describe('GET /api/health', () => {
    it('should return 200 and health metadata', async () => {
      const res = await request(app).get('/api/health');
      assert.equal(res.status, 200);
      assert.equal(res.body.status, 'ok');
      assert.equal(res.body.service, 'compilix-api');
      assert.ok(typeof res.body.uptimeSeconds === 'number');
      assert.ok(res.body.executionEngine);
      assert.ok('dockerAvailable' in res.body.executionEngine);
    });
  });

  // 2. Languages endpoint
  describe('GET /api/languages', () => {
    it('should return 200 and supported languages list', async () => {
      const res = await request(app).get('/api/languages');
      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.ok(Array.isArray(res.body.languages));
      assert.equal(res.body.languages.length, 4);

      const langIds = res.body.languages.map((l) => l.id);
      assert.ok(langIds.includes('cpp'));
      assert.ok(langIds.includes('java'));
      assert.ok(langIds.includes('python'));
      assert.ok(langIds.includes('javascript'));

      // Check fields for cpp
      const cpp = res.body.languages.find((l) => l.id === 'cpp');
      assert.ok(cpp.name);
      assert.ok(cpp.fileName);
      assert.ok(cpp.starterCode);
    });
  });

  // 3. Execution Validation
  describe('POST /api/execute - Validation and Error Handling', () => {
    it('should reject request when language is missing', async () => {
      const res = await request(app)
        .post('/api/execute')
        .send({ code: 'console.log(1);' });
      assert.equal(res.status, 400);
      assert.equal(res.body.success, false);
      assert.equal(res.body.error.code, 'VALIDATION_ERROR');
      assert.ok(res.body.error.message.includes('language'));
    });

    it('should reject request when language is unsupported', async () => {
      const res = await request(app)
        .post('/api/execute')
        .send({ language: 'rust', code: 'fn main() {}' });
      assert.equal(res.status, 400);
      assert.equal(res.body.success, false);
      assert.equal(res.body.error.code, 'VALIDATION_ERROR');
      assert.ok(res.body.error.message.includes('Unsupported language'));
    });

    it('should reject request when code is missing or empty', async () => {
      const res = await request(app)
        .post('/api/execute')
        .send({ language: 'python', code: '   ' });
      assert.equal(res.status, 400);
      assert.equal(res.body.success, false);
      assert.equal(res.body.error.code, 'VALIDATION_ERROR');
      assert.ok(res.body.error.message.includes('empty'));
    });

    it('should reject request when code is not a string', async () => {
      const res = await request(app)
        .post('/api/execute')
        .send({ language: 'python', code: 12345 });
      assert.equal(res.status, 400);
      assert.equal(res.body.success, false);
      assert.equal(res.body.error.code, 'VALIDATION_ERROR');
    });

    it('should reject request when stdin is not a string', async () => {
      const res = await request(app)
        .post('/api/execute')
        .send({ language: 'python', code: 'print("hi")', stdin: { bad: 'input' } });
      assert.equal(res.status, 400);
      assert.equal(res.body.success, false);
      assert.equal(res.body.error.code, 'VALIDATION_ERROR');
    });

    it('should reject request when code exceeds maximum size limit with 400', async () => {
      // 70 KB code (> 65536 bytes limit, but within 128KB body parser limit)
      const oversizedCode = 'x = 1\n'.repeat(12000); 
      const res = await request(app)
        .post('/api/execute')
        .send({ language: 'python', code: oversizedCode });
      assert.equal(res.status, 400);
      assert.equal(res.body.success, false);
      assert.equal(res.body.error.code, 'VALIDATION_ERROR');
      assert.ok(res.body.error.message.includes('exceeds maximum permitted size'));
    });

    it('should return 404 for unknown endpoints with consistent JSON format', async () => {
      const res = await request(app).get('/api/unknown-endpoint');
      assert.equal(res.status, 404);
      assert.equal(res.body.success, false);
      assert.equal(res.body.error.code, 'NOT_FOUND');
    });
  });

  // 4. Docker Integration Tests (only run if Docker is available)
  describe('Docker Execution Integration Tests', () => {
    const dockerOnline = isDockerAvailable();

    if (!dockerOnline) {
      it('skipping Docker execution tests because Docker engine is not available', () => {
        assert.ok(true);
      });
      return;
    }

    it('should execute Python code and capture stdout', async () => {
      const res = await request(app)
        .post('/api/execute')
        .send({
          language: 'python',
          code: 'print("Hello from Python Test!")',
          stdin: ''
        });

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.language, 'python');
      assert.equal(res.body.status, 'success');
      assert.ok(res.body.stdout.includes('Hello from Python Test!'));
      assert.equal(res.body.exitCode, 0);
      assert.ok(typeof res.body.executionTimeMs === 'number');
    });

    it('should pass stdin to Python program', async () => {
      const res = await request(app)
        .post('/api/execute')
        .send({
          language: 'python',
          code: 'import sys\nname = sys.stdin.read().strip()\nprint(f"Hello, {name}!")',
          stdin: 'Alice'
        });

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.ok(res.body.stdout.includes('Hello, Alice!'));
    });

    it('should capture Python runtime errors', async () => {
      const res = await request(app)
        .post('/api/execute')
        .send({
          language: 'python',
          code: '1 / 0'
        });

      assert.equal(res.status, 200);
      assert.equal(res.body.success, false);
      assert.equal(res.body.status, 'runtime_error');
      assert.ok(res.body.stderr.includes('ZeroDivisionError'));
    });

    it('should execute JavaScript code and capture stdout', async () => {
      const res = await request(app)
        .post('/api/execute')
        .send({
          language: 'javascript',
          code: 'console.log("Hello from Node Test!");',
          stdin: ''
        });

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.status, 'success');
      assert.ok(res.body.stdout.includes('Hello from Node Test!'));
    });

    it('should execute C++ code and capture stdout', async () => {
      const res = await request(app)
        .post('/api/execute')
        .send({
          language: 'cpp',
          code: '#include <iostream>\nint main() { std::cout << "Hello C++ Test" << std::endl; return 0; }',
          stdin: ''
        });

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.status, 'success');
      assert.ok(res.body.stdout.includes('Hello C++ Test'));
    });

    it('should capture C++ compilation errors', async () => {
      const res = await request(app)
        .post('/api/execute')
        .send({
          language: 'cpp',
          code: 'int main() { syntax error here }'
        });

      assert.equal(res.status, 200);
      assert.equal(res.body.success, false);
      assert.equal(res.body.status, 'compilation_error');
      assert.ok(res.body.stderr.length > 0);
    });

    it('should execute Java code and capture stdout', async () => {
      const res = await request(app)
        .post('/api/execute')
        .send({
          language: 'java',
          code: 'public class Main { public static void main(String[] args) { System.out.println("Hello Java Test"); } }',
          stdin: ''
        });

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.status, 'success');
      assert.ok(res.body.stdout.includes('Hello Java Test'));
    });

    it('should capture Java compilation errors', async () => {
      const res = await request(app)
        .post('/api/execute')
        .send({
          language: 'java',
          code: 'public class Main { invalid java code }'
        });

      assert.equal(res.status, 200);
      assert.equal(res.body.success, false);
      assert.equal(res.body.status, 'compilation_error');
      assert.ok(res.body.stderr.length > 0);
    });
  });
});
