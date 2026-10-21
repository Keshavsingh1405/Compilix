/**
 * Controller providing supported language metadata and starter templates
 */

export const SUPPORTED_LANGUAGES_META = [
  {
    id: 'cpp',
    name: 'C++',
    version: 'GCC (C++17)',
    fileName: 'main.cpp',
    monacoLanguage: 'cpp',
    starterCode: `#include <iostream>

int main() {
    std::cout << "Hello from C++ in Compilix!" << std::endl;
    return 0;
}
`
  },
  {
    id: 'java',
    name: 'Java',
    version: 'OpenJDK 21',
    fileName: 'Main.java',
    monacoLanguage: 'java',
    starterCode: `public class Main {
    public static void main(String[] args) {
        System.out.println("Hello from Java in Compilix!");
    }
}
`
  },
  {
    id: 'python',
    name: 'Python',
    version: 'Python 3.12',
    fileName: 'main.py',
    monacoLanguage: 'python',
    starterCode: `def main():
    print("Hello from Python in Compilix!")

if __name__ == "__main__":
    main()
`
  },
  {
    id: 'javascript',
    name: 'JavaScript',
    version: 'Node.js 22',
    fileName: 'main.js',
    monacoLanguage: 'javascript',
    starterCode: `function main() {
    console.log("Hello from JavaScript in Compilix!");
}

main();
`
  }
];

export function getLanguages(_req, res) {
  res.json({
    success: true,
    languages: SUPPORTED_LANGUAGES_META
  });
}
