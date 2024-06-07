import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// project-context-generator\add-file-header-comment.js

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '../');

const fileExtensions = {
  '.md': ['<!-- ', ' -->'],
  '.js': ['// ', ''],
  '.jsx': ['// ', ''],
  '.ts': ['// ', ''],
  '.tsx': ['// ', ''],
  '.css': ['/*  ', '  */'],
  '.svelte': ['<!-- ', ' -->'],
  '.html': ['<!-- ', ' -->'],
  '.scss': ['/*  ', '  */'],
  '.sass': ['/*  ', '  */'],
  // Remove JSON files from the list of extensions to handle
};

async function addFileHeaderComment(filePath) {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    const ext = path.extname(filePath);
    const [commentStart, commentEnd] = fileExtensions[ext] || ['// ', ''];

    // Construct the relative path
    const relativePath = path.relative(rootDir, filePath);

    // Escape special characters in the file path for the regular expression
    const escapedPath = relativePath.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');

    // Regex to match existing comment (even if path is different)
    const existingCommentRegex = new RegExp(`^${commentStart}.*${commentEnd}\n?`, 'm');
    const newComment = `${commentStart}${relativePath}${commentEnd}\n`;

    if (existingCommentRegex.test(content)) {
      // Update existing comment
      const newContent = content.replace(existingCommentRegex, newComment);
      await fs.writeFile(filePath, newContent, 'utf-8');
      console.log(`Comment updated in: ${filePath}`);
    } else {
      // Add new comment
      await fs.writeFile(filePath, newComment + content, 'utf-8');
      console.log(`Comment added to: ${filePath}`);
    }
  } catch (err) {
    console.error(`Error processing ${filePath}: ${err}`);
  }
}

async function traverseDirectory(directory) {
  const files = await fs.readdir(directory);
  for (const file of files) {
    const fullPath = path.join(directory, file);
    const stat = await fs.stat(fullPath);

    if (stat.isDirectory()) {
      await traverseDirectory(fullPath);
    } else if (Object.keys(fileExtensions).includes(path.extname(file))) {
      await addFileHeaderComment(fullPath);
    }
  }
}

// Entry point
traverseDirectory(rootDir);
