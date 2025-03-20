import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Check if main.tsx exists
const mainTsxPath = path.resolve(__dirname, 'client', 'src', 'main.tsx');
console.log(`Checking if main.tsx exists at: ${mainTsxPath}`);
console.log(`File exists: ${fs.existsSync(mainTsxPath)}`);

// List directory structure
function listDir(dir, level = 0) {
  const indent = '  '.repeat(level);
  console.log(`${indent}Directory: ${dir}`);
  
  const items = fs.readdirSync(dir, { withFileTypes: true });
  for (const item of items) {
    if (item.isDirectory()) {
      if (level < 2) { // Only go 2 levels deep to avoid too much output
        listDir(path.join(dir, item.name), level + 1);
      } else {
        console.log(`${indent}  Directory: ${item.name} (not listing contents)`);
      }
    } else {
      console.log(`${indent}  File: ${item.name}`);
    }
  }
}

// Check client directory structure
console.log('\nClient directory structure:');
listDir(path.resolve(__dirname, 'client'));

// Check if index.html exists
const indexHtmlPath = path.resolve(__dirname, 'client', 'index.html');
console.log(`\nChecking if index.html exists at: ${indexHtmlPath}`);
console.log(`File exists: ${fs.existsSync(indexHtmlPath)}`);

if (fs.existsSync(indexHtmlPath)) {
  const indexHtml = fs.readFileSync(indexHtmlPath, 'utf8');
  console.log(`\nindex.html content:`);
  console.log(indexHtml);
}