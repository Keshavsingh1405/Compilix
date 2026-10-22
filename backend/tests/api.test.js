process.env.NODE_ENV = 'test';
process.env.EXECUTION_TIMEOUT_MS = process.env.EXECUTION_TIMEOUT_MS || '15000';

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
    });
  });

  // 3. Execution Validation and Error Handling
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
      const oversizedCode = 'x = 1\n'.repeat(12000);
      const res = await request(app)
        .post('/api/execute')
        .send({ language: 'python', code: oversizedCode });
      assert.equal(res.status, 400);
      assert.equal(res.body.success, false);
      assert.equal(res.body.error.code, 'VALIDATION_ERROR');
      assert.ok(res.body.error.message.includes('exceeds maximum permitted size'));
    });

    it('should reject unsafe filenames with path traversal characters', async () => {
      const res = await request(app)
        .post('/api/execute')
        .send({
          language: 'python',
          code: 'print(1)',
          filename: '../../etc/passwd.py'
        });
      assert.equal(res.status, 400);
      assert.equal(res.body.success, false);
      assert.equal(res.body.error.code, 'VALIDATION_ERROR');
    });

    it('should reject filenames with mismatched language extensions', async () => {
      const res = await request(app)
        .post('/api/execute')
        .send({
          language: 'python',
          code: 'print(1)',
          filename: 'main.cpp'
        });
      assert.equal(res.status, 400);
      assert.equal(res.body.success, false);
      assert.equal(res.body.error.code, 'VALIDATION_ERROR');
      assert.ok(res.body.error.message.includes('does not match the expected extension'));
    });

    it('should return 404 for unknown endpoints with consistent JSON format', async () => {
      const res = await request(app).get('/api/unknown-endpoint');
      assert.equal(res.status, 404);
      assert.equal(res.body.success, false);
      assert.equal(res.body.error.code, 'NOT_FOUND');
    });
  });

  // 4. Docker Sandbox Execution Tests
  describe('Docker Execution Integration Tests', () => {
    const dockerOnline = isDockerAvailable();

    if (!dockerOnline) {
      it('skipping Docker execution tests because Docker engine is not available', () => {
        assert.ok(true);
      });
      return;
    }

    // ---------------------------------------------
    // Java Execution Pipeline Tests (Cases A through G)
    // ---------------------------------------------
    describe('Java Execution Pipeline', () => {
      it('Case A: should execute Main.java containing public class Main', async () => {
        const res = await request(app)
          .post('/api/execute')
          .send({
            language: 'java',
            filename: 'Main.java',
            code: 'public class Main { public static void main(String[] args) { System.out.println("Case A Success"); } }'
          });

        assert.equal(res.status, 200);
        assert.equal(res.body.success, true);
        assert.equal(res.body.status, 'success');
        assert.ok(res.body.stdout.includes('Case A Success'));
      });

      it('Case B: should execute HelloWorld.java containing public class HelloWorld', async () => {
        const res = await request(app)
          .post('/api/execute')
          .send({
            language: 'java',
            filename: 'HelloWorld.java',
            code: 'public class HelloWorld { public static void main(String[] args) { System.out.println("Hello World Java!"); } }'
          });

        assert.equal(res.status, 200);
        assert.equal(res.body.success, true);
        assert.equal(res.body.status, 'success');
        assert.ok(res.body.stdout.includes('Hello World Java!'));
      });

      it('Case C: should execute main.java containing public class main (lowercase)', async () => {
        const res = await request(app)
          .post('/api/execute')
          .send({
            language: 'java',
            filename: 'main.java',
            code: 'public class main { public static void main(String[] args) { System.out.println("lowercase main success"); } }'
          });

        assert.equal(res.status, 200);
        assert.equal(res.body.success, true);
        assert.equal(res.body.status, 'success');
        assert.ok(res.body.stdout.includes('lowercase main success'));
      });

      it('Case D: should report compilation error with status compilation_error', async () => {
        const res = await request(app)
          .post('/api/execute')
          .send({
            language: 'java',
            filename: 'SyntaxErr.java',
            code: 'public class SyntaxErr { invalid syntax here }'
          });

        assert.equal(res.status, 200);
        assert.equal(res.body.success, false);
        assert.equal(res.body.status, 'compilation_error');
        assert.equal(res.body.exitCode, 42);
        assert.ok(res.body.stderr.length > 0);
      });

      it('Case E: should report missing valid main method', async () => {
        const res = await request(app)
          .post('/api/execute')
          .send({
            language: 'java',
            filename: 'NoMain.java',
            code: 'public class NoMain { public void helper() { System.out.println("No main"); } }'
          });

        assert.equal(res.status, 200);
        assert.equal(res.body.success, false);
        assert.equal(res.body.status, 'runtime_error');
        assert.ok(res.body.stderr.includes('Main method not found in class NoMain'));
      });

      it('Case F: should read input from standard input', async () => {
        const res = await request(app)
          .post('/api/execute')
          .send({
            language: 'java',
            filename: 'InputTest.java',
            code: `import java.util.Scanner;
public class InputTest {
    public static void main(String[] args) {
        Scanner s = new Scanner(System.in);
        if (s.hasNextLine()) {
            System.out.println("Input Received: " + s.nextLine());
        }
    }
}`,
            stdin: 'Compilix Java Stdin Test'
          });

        assert.equal(res.status, 200);
        assert.equal(res.body.success, true);
        assert.ok(res.body.stdout.includes('Input Received: Compilix Java Stdin Test'));
      });

      it('Case G: should report runtime exception', async () => {
        const res = await request(app)
          .post('/api/execute')
          .send({
            language: 'java',
            filename: 'ThrowTest.java',
            code: 'public class ThrowTest { public static void main(String[] args) { throw new RuntimeException("Explicit Test Failure"); } }'
          });

        assert.equal(res.status, 200);
        assert.equal(res.body.success, false);
        assert.equal(res.body.status, 'runtime_error');
        assert.ok(res.body.stderr.includes('RuntimeException: Explicit Test Failure'));
      });

      it('Case H: should execute Java class with package declaration', async () => {
        const res = await request(app)
          .post('/api/execute')
          .send({
            language: 'java',
            filename: 'PackageTest.java',
            code: 'package com.compilix.demo; public class PackageTest { public static void main(String[] args) { System.out.println("Package execution works"); } }'
          });

        assert.equal(res.status, 200);
        assert.equal(res.body.success, true);
        assert.equal(res.body.status, 'success');
        assert.ok(res.body.stdout.includes('Package execution works'));
      });
    });

    // ---------------------------------------------
    // C++ Execution Pipeline Tests
    // ---------------------------------------------
    describe('C++ Execution Pipeline', () => {
      it('should compile and execute C++ Hello World with custom filename', async () => {
        const res = await request(app)
          .post('/api/execute')
          .send({
            language: 'cpp',
            filename: 'hello.cpp',
            code: '#include <iostream>\nint main() { std::cout << "Hello C++!" << std::endl; return 0; }'
          });

        assert.equal(res.status, 200);
        assert.equal(res.body.success, true);
        assert.equal(res.body.status, 'success');
        assert.ok(res.body.stdout.includes('Hello C++!'));
      });

      it('should execute C++ arithmetic, loops, and vectors (STL)', async () => {
        const code = `
#include <iostream>
#include <vector>
#include <numeric>

int main() {
    std::vector<int> nums = {1, 2, 3, 4, 5};
    int sum = std::accumulate(nums.begin(), nums.end(), 0);
    std::cout << "Sum: " << sum << std::endl;
    return 0;
}
`;
        const res = await request(app)
          .post('/api/execute')
          .send({ language: 'cpp', filename: 'stl_test.cpp', code });

        assert.equal(res.status, 200);
        assert.equal(res.body.success, true);
        assert.ok(res.body.stdout.includes('Sum: 15'));
      });

      it('should read standard input using cin in C++', async () => {
        const code = `
#include <iostream>
#include <string>

int main() {
    std::string val;
    std::cin >> val;
    std::cout << "Got: " << val << std::endl;
    return 0;
}
`;
        const res = await request(app)
          .post('/api/execute')
          .send({
            language: 'cpp',
            filename: 'cin_test.cpp',
            code,
            stdin: 'CppCinValue'
          });

        assert.equal(res.status, 200);
        assert.equal(res.body.success, true);
        assert.ok(res.body.stdout.includes('Got: CppCinValue'));
      });

      it('should report C++ compilation error with status compilation_error', async () => {
        const res = await request(app)
          .post('/api/execute')
          .send({
            language: 'cpp',
            filename: 'bad.cpp',
            code: 'int main() { undefined_identifier; }'
          });

        assert.equal(res.status, 200);
        assert.equal(res.body.success, false);
        assert.equal(res.body.status, 'compilation_error');
        assert.equal(res.body.exitCode, 42);
      });
    });

    // ---------------------------------------------
    // Python Execution Pipeline Tests
    // ---------------------------------------------
    describe('Python Execution Pipeline', () => {
      it('should execute Python Hello World with custom filename', async () => {
        const res = await request(app)
          .post('/api/execute')
          .send({
            language: 'python',
            filename: 'script.py',
            code: 'print("Hello Python Script!")'
          });

        assert.equal(res.status, 200);
        assert.equal(res.body.success, true);
        assert.equal(res.body.status, 'success');
        assert.ok(res.body.stdout.includes('Hello Python Script!'));
      });

      it('should execute Python functions, classes, and Unicode output', async () => {
        const code = `
class Calculator:
    def add(self, a, b):
        return a + b

c = Calculator()
print(f"Result: {c.add(20, 22)} 🚀")
`;
        const res = await request(app)
          .post('/api/execute')
          .send({ language: 'python', filename: 'calc.py', code });

        assert.equal(res.status, 200);
        assert.equal(res.body.success, true);
        assert.ok(res.body.stdout.includes('Result: 42 🚀'));
      });

      it('should read multiple input lines in Python', async () => {
        const code = `
import sys
lines = [l.strip() for l in sys.stdin.readlines()]
print("Count:", len(lines))
print("First:", lines[0])
print("Second:", lines[1])
`;
        const res = await request(app)
          .post('/api/execute')
          .send({
            language: 'python',
            filename: 'multi_stdin.py',
            code,
            stdin: 'alpha\nbeta\n'
          });

        assert.equal(res.status, 200);
        assert.equal(res.body.success, true);
        assert.ok(res.body.stdout.includes('Count: 2'));
        assert.ok(res.body.stdout.includes('First: alpha'));
        assert.ok(res.body.stdout.includes('Second: beta'));
      });

      it('should classify Python SyntaxError as compilation_error', async () => {
        const res = await request(app)
          .post('/api/execute')
          .send({
            language: 'python',
            filename: 'bad.py',
            code: 'def bad_func(\n  print(1)'
          });

        assert.equal(res.status, 200);
        assert.equal(res.body.success, false);
        assert.equal(res.body.status, 'compilation_error');
        assert.ok(res.body.stderr.includes('SyntaxError'));
      });

      it('should classify Python runtime exceptions as runtime_error', async () => {
        const res = await request(app)
          .post('/api/execute')
          .send({
            language: 'python',
            filename: 'runtime_err.py',
            code: 'x = 10 / 0'
          });

        assert.equal(res.status, 200);
        assert.equal(res.body.success, false);
        assert.equal(res.body.status, 'runtime_error');
        assert.ok(res.body.stderr.includes('ZeroDivisionError'));
      });
    });

    // ---------------------------------------------
    // JavaScript Execution Pipeline Tests
    // ---------------------------------------------
    describe('JavaScript Execution Pipeline', () => {
      it('should execute JavaScript Hello World with custom filename', async () => {
        const res = await request(app)
          .post('/api/execute')
          .send({
            language: 'javascript',
            filename: 'app.js',
            code: 'console.log("Hello Node JS App!");'
          });

        assert.equal(res.status, 200);
        assert.equal(res.body.success, true);
        assert.equal(res.body.status, 'success');
        assert.ok(res.body.stdout.includes('Hello Node JS App!'));
      });

      it('should execute JavaScript functions, objects, and loops', async () => {
        const code = `
const items = [{ id: 1, v: 10 }, { id: 2, v: 20 }];
const total = items.reduce((acc, curr) => acc + curr.v, 0);
console.log("Total:", total);
`;
        const res = await request(app)
          .post('/api/execute')
          .send({ language: 'javascript', filename: 'reduce.js', code });

        assert.equal(res.status, 200);
        assert.equal(res.body.success, true);
        assert.ok(res.body.stdout.includes('Total: 30'));
      });

      it('should read stdin in Node.js via fs.readFileSync', async () => {
        const code = `
import fs from 'node:fs';
const input = fs.readFileSync(0, 'utf-8');
console.log("Echo Node Stdin:", input.trim());
`;
        const res = await request(app)
          .post('/api/execute')
          .send({
            language: 'javascript',
            filename: 'stdin_test.js',
            code,
            stdin: 'Node Stdin Payload'
          });

        assert.equal(res.status, 200);
        assert.equal(res.body.success, true);
        assert.ok(res.body.stdout.includes('Echo Node Stdin: Node Stdin Payload'));
      });

      it('should classify JavaScript SyntaxError as compilation_error', async () => {
        const res = await request(app)
          .post('/api/execute')
          .send({
            language: 'javascript',
            filename: 'bad.js',
            code: 'const x = {;'
          });

        assert.equal(res.status, 200);
        assert.equal(res.body.success, false);
        assert.equal(res.body.status, 'compilation_error');
        assert.ok(res.body.stderr.includes('SyntaxError'));
      });

      it('should classify JavaScript runtime exceptions as runtime_error', async () => {
        const res = await request(app)
          .post('/api/execute')
          .send({
            language: 'javascript',
            filename: 'runtime_err.js',
            code: 'throw new Error("Explicit JS Runtime Error");'
          });

        assert.equal(res.status, 200);
        assert.equal(res.body.success, false);
        assert.equal(res.body.status, 'runtime_error');
        assert.ok(res.body.stderr.includes('Explicit JS Runtime Error'));
      });
    });

    // ---------------------------------------------
    // Advanced QA & Security Regression Tests
    // ---------------------------------------------
    describe('Advanced QA & Security Regression Tests', () => {
      it('should accurately report fatal signal name and code in C++ runtime error', async () => {
        const res = await request(app)
          .post('/api/execute')
          .send({
            language: 'cpp',
            filename: 'segv.cpp',
            code: 'int main() { int* p = nullptr; *p = 42; return 0; }'
          });

        assert.equal(res.status, 200);
        assert.equal(res.body.success, false);
        assert.equal(res.body.status, 'runtime_error');
        assert.equal(res.body.exitCode, 139);
        assert.ok(res.body.stderr.includes('SIGSEGV'));
        assert.ok(res.body.stderr.includes('139'));
      });

      it('should enforce zero network access in runner containers (--network none)', async () => {
        const res = await request(app)
          .post('/api/execute')
          .send({
            language: 'python',
            filename: 'net_test.py',
            code: `import socket
try:
    s = socket.create_connection(('1.1.1.1', 80), timeout=2)
    print("VULNERABLE")
except Exception:
    print("NETWORK_BLOCKED")`
          });

        assert.equal(res.status, 200);
        assert.equal(res.body.success, true);
        assert.ok(res.body.stdout.includes('NETWORK_BLOCKED'));
      });

      it('should enforce non-root UID 1000 in runner containers', async () => {
        const res = await request(app)
          .post('/api/execute')
          .send({
            language: 'python',
            filename: 'uid_test.py',
            code: 'import os; print("UID:", os.getuid())'
          });

        assert.equal(res.status, 200);
        assert.equal(res.body.success, true);
        assert.ok(res.body.stdout.includes('UID: 1000'));
      });

      it('should handle concurrent executions with distinct inputs without cross-contamination', async () => {
        const p1 = request(app).post('/api/execute').send({ language: 'python', code: 'import sys; print("A:", sys.stdin.read().strip())', stdin: 'INPUT_ALPHA' });
        const p2 = request(app).post('/api/execute').send({ language: 'python', code: 'import sys; print("B:", sys.stdin.read().strip())', stdin: 'INPUT_BETA' });

        const [r1, r2] = await Promise.all([p1, p2]);
        assert.equal(r1.status, 200);
        assert.equal(r2.status, 200);
        assert.ok(r1.body.stdout.includes('A: INPUT_ALPHA'));
        assert.ok(r2.body.stdout.includes('B: INPUT_BETA'));
      });
    });
  });
});
