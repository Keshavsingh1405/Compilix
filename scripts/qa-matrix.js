/**
 * Compilix QA Automation Matrix Test Runner
 * Rigorously executes tests for C++, Java, Python, and JavaScript against the live API.
 */

import http from 'node:http';

const API_BASE = 'http://localhost:5000';

function postExecution({ language, filename, code, stdin = '' }) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({ language, filename, code, stdin });
    const url = new URL(`${API_BASE}/api/execute`);

    const req = http.request(
      url,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload)
        },
        timeout: 25000
      },
      (res) => {
        let body = '';
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => {
          try {
            const data = JSON.parse(body);
            resolve({ statusCode: res.statusCode, data });
          } catch (e) {
            resolve({ statusCode: res.statusCode, rawBody: body, parseError: e.message });
          }
        });
      }
    );

    req.on('error', (err) => reject(err));
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('HTTP request timed out'));
    });

    req.write(payload);
    req.end();
  });
}

const testResults = [];

function record(language, category, expected, actualResult, passed, notes = '') {
  testResults.push({
    language,
    category,
    status: passed ? 'PASSED' : 'FAILED',
    expected,
    actual: actualResult,
    notes
  });
  console.log(`[${passed ? 'PASS' : 'FAIL'}] ${language.toUpperCase()} - ${category}`);
  if (!passed) {
    console.log(`       Expected: ${expected}`);
    console.log(`       Actual:   ${actualResult}`);
    if (notes) console.log(`       Notes:    ${notes}`);
  }
}

async function runTestsForLanguage(lang, specs) {
  console.log(`\n========================================`);
  console.log(`  Executing QA Suite for ${lang.toUpperCase()}`);
  console.log(`========================================`);

  // 1. Basic program execution
  try {
    const res = await postExecution({
      language: lang,
      filename: specs.basic.filename,
      code: specs.basic.code
    });
    const stdout = res.data?.stdout?.trim() || '';
    const pass = res.data?.success === true && stdout === specs.basic.expected;
    record(lang, '1. Basic program execution', specs.basic.expected, stdout, pass, res.data?.stderr);
  } catch (err) {
    record(lang, '1. Basic program execution', specs.basic.expected, err.message, false);
  }

  // 2. Sum of two numbers with Custom Stdin (4 sub-tests: 10/20, 100/200, -5/15, 0/0)
  const sumInputs = [
    { stdin: '10\n20', expected: 'Sum: 30' },
    { stdin: '100\n200', expected: 'Sum: 300' },
    { stdin: '-5\n15', expected: 'Sum: 10' },
    { stdin: '0\n0', expected: 'Sum: 0' }
  ];

  for (const item of sumInputs) {
    try {
      const res = await postExecution({
        language: lang,
        filename: specs.sum.filename,
        code: specs.sum.code,
        stdin: item.stdin
      });
      const stdout = res.data?.stdout?.trim() || '';
      const pass = res.data?.success === true && stdout === item.expected;
      record(
        lang,
        `2. Sum Stdin [${item.stdin.replace('\n', ', ')}]`,
        item.expected,
        stdout,
        pass,
        res.data?.stderr
      );
    } catch (err) {
      record(lang, `2. Sum Stdin [${item.stdin.replace('\n', ', ')}]`, item.expected, err.message, false);
    }
  }

  // 3. Even/odd conditional logic
  try {
    const resEven = await postExecution({
      language: lang,
      filename: specs.evenOdd.filename,
      code: specs.evenOdd.code,
      stdin: '8'
    });
    const resOdd = await postExecution({
      language: lang,
      filename: specs.evenOdd.filename,
      code: specs.evenOdd.code,
      stdin: '7'
    });
    const outEven = resEven.data?.stdout?.trim();
    const outOdd = resOdd.data?.stdout?.trim();
    const pass = outEven === 'Even' && outOdd === 'Odd';
    record(
      lang,
      '3. Even/odd conditional logic',
      'Even & Odd',
      `${outEven} & ${outOdd}`,
      pass,
      `8 -> ${outEven}, 7 -> ${outOdd}`
    );
  } catch (err) {
    record(lang, '3. Even/odd conditional logic', 'Even & Odd', err.message, false);
  }

  // 4. Maximum value from array
  try {
    const res = await postExecution({
      language: lang,
      filename: specs.maxArray.filename,
      code: specs.maxArray.code,
      stdin: '5\n3 9 1 7 4'
    });
    const stdout = res.data?.stdout?.trim() || '';
    const pass = res.data?.success === true && stdout === 'Max: 9';
    record(lang, '4. Maximum value from an array', 'Max: 9', stdout, pass, res.data?.stderr);
  } catch (err) {
    record(lang, '4. Maximum value from an array', 'Max: 9', err.message, false);
  }

  // 5. Compilation or syntax error
  try {
    const res = await postExecution({
      language: lang,
      filename: specs.compilationErr.filename,
      code: specs.compilationErr.code
    });
    const pass = res.data?.success === false && res.data?.status === 'compilation_error';
    record(
      lang,
      '5. Compilation or syntax error',
      'status: compilation_error',
      `status: ${res.data?.status}, exitCode: ${res.data?.exitCode}`,
      pass,
      res.data?.stderr?.slice(0, 100)
    );
  } catch (err) {
    record(lang, '5. Compilation or syntax error', 'status: compilation_error', err.message, false);
  }

  // 6. Runtime error
  try {
    const res = await postExecution({
      language: lang,
      filename: specs.runtimeErr.filename,
      code: specs.runtimeErr.code
    });
    const pass = res.data?.success === false && res.data?.status === 'runtime_error';
    record(
      lang,
      '6. Runtime error',
      'status: runtime_error',
      `status: ${res.data?.status}, exitCode: ${res.data?.exitCode}`,
      pass,
      res.data?.stderr?.slice(0, 100)
    );
  } catch (err) {
    record(lang, '6. Runtime error', 'status: runtime_error', err.message, false);
  }

  // 7. Repeated executions with different inputs (Verify state isolation)
  try {
    const run1 = await postExecution({
      language: lang,
      filename: specs.sum.filename,
      code: specs.sum.code,
      stdin: '11\n22'
    });
    const run2 = await postExecution({
      language: lang,
      filename: specs.sum.filename,
      code: specs.sum.code,
      stdin: '50\n50'
    });
    const out1 = run1.data?.stdout?.trim();
    const out2 = run2.data?.stdout?.trim();
    const pass = out1 === 'Sum: 33' && out2 === 'Sum: 100';
    record(
      lang,
      '7. Repeated executions with different inputs',
      'Sum: 33 then Sum: 100',
      `${out1} then ${out2}`,
      pass
    );
  } catch (err) {
    record(lang, '7. Repeated executions with different inputs', 'Sum: 33 then Sum: 100', err.message, false);
  }

  // 8. Empty input handling
  try {
    const res = await postExecution({
      language: lang,
      filename: specs.emptyInput.filename,
      code: specs.emptyInput.code,
      stdin: ''
    });
    const stdout = res.data?.stdout?.trim() || '';
    const pass = res.data?.success === true && stdout === 'No input';
    record(lang, '8. Empty input handling', 'No input', stdout, pass, res.data?.stderr);
  } catch (err) {
    record(lang, '8. Empty input handling', 'No input', err.message, false);
  }

  // 9. Execution timeout handling
  try {
    console.log(`   Running timeout test for ${lang} (waiting ~10s)...`);
    const res = await postExecution({
      language: lang,
      filename: specs.timeout.filename,
      code: specs.timeout.code
    });
    const pass = res.data?.success === false && res.data?.status === 'time_limit_exceeded';
    record(
      lang,
      '9. Execution timeout handling',
      'status: time_limit_exceeded',
      `status: ${res.data?.status}, time: ${res.data?.executionTimeMs}ms`,
      pass,
      res.data?.stderr
    );
  } catch (err) {
    record(lang, '9. Execution timeout handling', 'status: time_limit_exceeded', err.message, false);
  }
}

// -------------------------------------------------------------------------
// Language Test Specifications
// -------------------------------------------------------------------------
const C_PLUS_PLUS_SPECS = {
  basic: {
    filename: 'main.cpp',
    code: `#include <iostream>
int main() {
    std::cout << "Hello C++" << std::endl;
    return 0;
}`,
    expected: 'Hello C++'
  },
  sum: {
    filename: 'main.cpp',
    code: `#include <iostream>
int main() {
    int a, b;
    if (std::cin >> a >> b) {
        std::cout << "Sum: " << (a + b) << std::endl;
    }
    return 0;
}`
  },
  evenOdd: {
    filename: 'even_odd.cpp',
    code: `#include <iostream>
int main() {
    int n;
    if (std::cin >> n) {
        std::cout << (n % 2 == 0 ? "Even" : "Odd") << std::endl;
    }
    return 0;
}`
  },
  maxArray: {
    filename: 'max.cpp',
    code: `#include <iostream>
#include <vector>
#include <algorithm>
int main() {
    int n;
    if (std::cin >> n) {
        std::vector<int> a(n);
        for (int i = 0; i < n; ++i) std::cin >> a[i];
        std::cout << "Max: " << *std::max_element(a.begin(), a.end()) << std::endl;
    }
    return 0;
}`
  },
  compilationErr: {
    filename: 'syntax_error.cpp',
    code: `#include <iostream>
int main() {
    syntax_error_here;
    return 0;
}`
  },
  runtimeErr: {
    filename: 'runtime_error.cpp',
    code: `#include <iostream>
#include <cstdlib>
int main() {
    std::abort();
    return 0;
}`
  },
  emptyInput: {
    filename: 'empty.cpp',
    code: `#include <iostream>
int main() {
    int a;
    if (std::cin >> a) {
        std::cout << "Read: " << a << std::endl;
    } else {
        std::cout << "No input" << std::endl;
    }
    return 0;
}`
  },
  timeout: {
    filename: 'timeout.cpp',
    code: `int main() {
    while (true) {}
    return 0;
}`
  }
};

const JAVA_SPECS = {
  basic: {
    filename: 'Main.java',
    code: `public class Main {
    public static void main(String[] args) {
        System.out.println("Hello Java");
    }
}`,
    expected: 'Hello Java'
  },
  sum: {
    filename: 'Main.java',
    code: `import java.util.Scanner;
public class Main {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        if (sc.hasNextInt()) {
            int a = sc.nextInt();
            int b = sc.nextInt();
            System.out.println("Sum: " + (a + b));
        }
    }
}`
  },
  evenOdd: {
    filename: 'Main.java',
    code: `import java.util.Scanner;
public class Main {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        if (sc.hasNextInt()) {
            int n = sc.nextInt();
            System.out.println(n % 2 == 0 ? "Even" : "Odd");
        }
    }
}`
  },
  maxArray: {
    filename: 'Main.java',
    code: `import java.util.Scanner;
public class Main {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        if (sc.hasNextInt()) {
            int n = sc.nextInt();
            int max = Integer.MIN_VALUE;
            for (int i = 0; i < n; i++) {
                int val = sc.nextInt();
                if (val > max) max = val;
            }
            System.out.println("Max: " + max);
        }
    }
}`
  },
  compilationErr: {
    filename: 'SyntaxErr.java',
    code: `public class SyntaxErr {
    public static void main(String[] args) {
        invalid_java_syntax
    }
}`
  },
  runtimeErr: {
    filename: 'RuntimeErr.java',
    code: `public class RuntimeErr {
    public static void main(String[] args) {
        int[] arr = new int[2];
        System.out.println(arr[5]);
    }
}`
  },
  emptyInput: {
    filename: 'Empty.java',
    code: `import java.util.Scanner;
public class Empty {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        if (sc.hasNextInt()) {
            System.out.println("Read: " + sc.nextInt());
        } else {
            System.out.println("No input");
        }
    }
}`
  },
  timeout: {
    filename: 'Timeout.java',
    code: `public class Timeout {
    public static void main(String[] args) {
        while (true) {}
    }
}`
  }
};

const PYTHON_SPECS = {
  basic: {
    filename: 'main.py',
    code: `print("Hello Python")`,
    expected: 'Hello Python'
  },
  sum: {
    filename: 'main.py',
    code: `import sys
tokens = [int(x) for x in sys.stdin.read().split()]
if len(tokens) >= 2:
    print(f"Sum: {tokens[0] + tokens[1]}")`
  },
  evenOdd: {
    filename: 'even_odd.py',
    code: `import sys
tokens = sys.stdin.read().split()
if tokens:
    n = int(tokens[0])
    print("Even" if n % 2 == 0 else "Odd")`
  },
  maxArray: {
    filename: 'max.py',
    code: `import sys
tokens = [int(x) for x in sys.stdin.read().split()]
if tokens:
    n = tokens[0]
    arr = tokens[1:1+n]
    print(f"Max: {max(arr)}")`
  },
  compilationErr: {
    filename: 'syntax_error.py',
    code: `def broken(
    print("missing parenthesis")`
  },
  runtimeErr: {
    filename: 'runtime_error.py',
    code: `x = 10 / 0`
  },
  emptyInput: {
    filename: 'empty.py',
    code: `import sys
s = sys.stdin.read().strip()
if s:
    print("Read:", s)
else:
    print("No input")`
  },
  timeout: {
    filename: 'timeout.py',
    code: `while True: pass`
  }
};

const JS_SPECS = {
  basic: {
    filename: 'main.js',
    code: `console.log("Hello JavaScript");`,
    expected: 'Hello JavaScript'
  },
  sum: {
    filename: 'main.js',
    code: `const fs = require('fs');
const tokens = fs.readFileSync(0, 'utf-8').trim().split(/\\s+/);
if (tokens.length >= 2) {
    const a = parseInt(tokens[0], 10);
    const b = parseInt(tokens[1], 10);
    console.log('Sum: ' + (a + b));
}`
  },
  evenOdd: {
    filename: 'even_odd.js',
    code: `const fs = require('fs');
const input = fs.readFileSync(0, 'utf-8').trim();
if (input) {
    const n = parseInt(input, 10);
    console.log(n % 2 === 0 ? 'Even' : 'Odd');
}`
  },
  maxArray: {
    filename: 'max.js',
    code: `const fs = require('fs');
const tokens = fs.readFileSync(0, 'utf-8').trim().split(/\\s+/).map(Number);
if (tokens.length > 0) {
    const n = tokens[0];
    const arr = tokens.slice(1, 1 + n);
    console.log('Max: ' + Math.max(...arr));
}`
  },
  compilationErr: {
    filename: 'syntax_error.js',
    code: `const x = {;`
  },
  runtimeErr: {
    filename: 'runtime_error.js',
    code: `null.undefinedProperty();`
  },
  emptyInput: {
    filename: 'empty.js',
    code: `const fs = require('fs');
const input = fs.readFileSync(0, 'utf-8').trim();
console.log(input ? 'Read: ' + input : 'No input');`
  },
  timeout: {
    filename: 'timeout.js',
    code: `while (true) {}`
  }
};

async function main() {
  console.log('\n=============================================');
  console.log('   Compilix QA Automation Full Matrix Test');
  console.log('=============================================\n');

  await runTestsForLanguage('cpp', C_PLUS_PLUS_SPECS);
  await runTestsForLanguage('java', JAVA_SPECS);
  await runTestsForLanguage('python', PYTHON_SPECS);
  await runTestsForLanguage('javascript', JS_SPECS);

  console.log('\n=============================================');
  console.log('             TEST RESULTS MATRIX');
  console.log('=============================================\n');

  const passedCount = testResults.filter((r) => r.status === 'PASSED').length;
  const totalCount = testResults.length;

  console.log(`Total Tests Executed: ${totalCount}`);
  console.log(`Tests Passed:         ${passedCount}`);
  console.log(`Tests Failed:         ${totalCount - passedCount}`);
  console.log(`Pass Rate:            ${((passedCount / totalCount) * 100).toFixed(1)}%\n`);

  // Print markdown table
  console.log('| Language | Test Category | Status | Expected Output | Actual Output | Error Details |');
  console.log('| :--- | :--- | :---: | :--- | :--- | :--- |');
  for (const r of testResults) {
    const exp = r.expected.replace(/\n/g, ' ');
    const act = (r.actual || '').replace(/\n/g, ' ');
    const notes = (r.notes || '').replace(/\n/g, ' ').slice(0, 80);
    console.log(`| **${r.language.toUpperCase()}** | ${r.category} | ${r.status === 'PASSED' ? '✅ PASSED' : '❌ FAILED'} | \`${exp}\` | \`${act}\` | ${notes || 'None'} |`);
  }

  if (passedCount !== totalCount) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Test matrix execution error:', err);
  process.exit(1);
});
