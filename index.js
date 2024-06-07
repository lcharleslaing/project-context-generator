#!/usr/bin/env node
"use strict";
import fs from 'fs';
import path from 'path';
import { program } from 'commander';

// Read exclusions from .gitignore (if it exists)
const cwd = process.cwd();
let defaultExclude = ['.git'];
try {
    const gitignoreContent = fs.readFileSync(path.join(cwd, '.gitignore'), 'utf-8');
    defaultExclude = [...defaultExclude, ...gitignoreContent.split('\n').map(line => line.trim()).filter(line => line && !line.startsWith('#'))];
} catch (err) {
    // If .gitignore is missing, it will just continue with the default exclude list.
}

// CLI options
program
    .option('-e, --exclude <dirs>', 'Comma-separated list of additional directories to exclude')
    .option('-f, --exclude-files <files>', 'Comma-separated list of additional files to exclude')
    .parse(process.argv);

const options = program.opts();
const additionalExcludeDirs = options.exclude ? options.exclude.split(',') : [];
const additionalExcludeFiles = options.excludeFiles ? options.excludeFiles.split(',') : [];
const excludeDirs = [...defaultExclude, ...additionalExcludeDirs];
const excludeFiles = [...additionalExcludeFiles];

const outputDir = path.join(cwd, 'projectContext');
const markdownOutputDir = path.join(outputDir, 'markdown');
const jsonOutputDir = path.join(outputDir, 'json');
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const markdownFilename = `projectScope_${timestamp}.md`;
const jsonFilename = `projectStructure_${timestamp}.json`;
const markdownFilePath = path.join(markdownOutputDir, markdownFilename);
const jsonFilePath = path.join(jsonOutputDir, jsonFilename);

// Create output directories if they don't exist
if (!fs.existsSync(markdownOutputDir)) {
    fs.mkdirSync(markdownOutputDir, { recursive: true });
}
if (!fs.existsSync(jsonOutputDir)) {
    fs.mkdirSync(jsonOutputDir, { recursive: true });
}

// Function to determine the appropriate comment syntax based on file extension
function getCommentSyntax(extension) {
    switch (extension) {
        case '.js':
        case '.jsx':
        case '.ts':
        case '.tsx':
            return '//';
        case '.css':
        case '.scss':
        case '.sass':
            return '/* */';
        case '.svelte':
            return ''; // Svelte comment syntax
        case '.html':
            return '';
        case '.md':
            return '';
        case '.gitignore':
            return '#';
        case '.json':
            return null; // JSON does not support comments
        default:
            return null; // No comment added for unknown extensions
    }
}


// Function to process each file
function processFile(filePath, commentSyntax) {
    let fileContent = fs.readFileSync(filePath, 'utf-8');
    // Check for shebang before adding comment
    if (fileContent.startsWith("#!")) {
        return;  // Skip files with shebangs
    }

    const relativePath = path.relative(cwd, filePath);

    // Regex to match existing comment with the relative path (or remove incorrect ones)
    const commentRegex = new RegExp(`^[\\s]*${commentSyntax}\\s*${relativePath}\\s*$`, 'm');
    fileContent = fileContent.replace(commentRegex, '');

    // Prepend the new comment if the file supports comments
    if (commentSyntax) {
        fileContent = `${commentSyntax} ${relativePath}\n${fileContent}`;
        fs.writeFileSync(filePath, fileContent, 'utf-8');
    }
}

// Function to determine if a file/directory should be excluded
function isExcluded(filePath) {
    const filename = path.basename(filePath);
    return excludeDirs.some(dir => filePath.includes(dir)) || excludeFiles.includes(filename);
}

// Function to generate the JSON file
function generateJSON() {
    const projectStructure = {};

    function walkDirectory(dirPath, currentObject) {
        const files = fs.readdirSync(dirPath);
        files.forEach(file => {
            const fullPath = path.join(dirPath, file);
            if (!isExcluded(fullPath)) {
                if (fs.statSync(fullPath).isDirectory()) {
                    currentObject[file] = {};
                    walkDirectory(fullPath, currentObject[file]);
                } else {
                    const content = fs.readFileSync(fullPath, 'utf-8');
                    currentObject[file] = content; // Store file content
                }
            }
        });
    }

    walkDirectory(cwd, projectStructure);
    fs.writeFileSync(jsonFilePath, JSON.stringify(projectStructure, null, 2), 'utf-8');
}

// Function to generate the markdown file
function generateMarkdown() {
    const processedFiles = new Set();
    const projectScopeMarkdown = [];

    function walkDirectory(dirPath, depth = 0) {
        const files = fs.readdirSync(dirPath);
        const markdown = [];
        files.forEach(file => {
            const fullPath = path.join(dirPath, file);
            const relativePath = path.relative(cwd, fullPath);

            if (!processedFiles.has(relativePath)) {
                processedFiles.add(relativePath);
                if (fs.statSync(fullPath).isDirectory() && !isExcluded(fullPath)) {
                    markdown.push(`${'#'.repeat(depth + 1)} ${relativePath}`);
                    markdown.push(walkDirectory(fullPath, depth + 1));
                } else if (!isExcluded(fullPath)) {
                    const content = fs.readFileSync(fullPath, 'utf-8');
                    markdown.push(
                        `${'#'.repeat(depth + 2)} ${relativePath}\n\n\`\`\`${path.extname(file).slice(1) || 'txt'}\n${content}\n\`\`\`\n\n`
                    );
                }
            }
        });
        return markdown.join('\n');
    }

    projectScopeMarkdown.push(walkDirectory(cwd)); // Walk the cwd directly
    fs.writeFileSync(markdownFilePath, projectScopeMarkdown.join('\n'), 'utf-8');
}


// --- Main script execution ---
// Comment files first
fs.readdirSync(cwd).forEach(file => {
    const fullPath = path.join(cwd, file);
    if (!isExcluded(fullPath) && fs.statSync(fullPath).isFile()) {
        const extension = path.extname(file);
        const commentSyntax = getCommentSyntax(extension);
        processFile(fullPath, commentSyntax);
    }
});

generateJSON();
generateMarkdown();

console.log(`Project structure data saved in projectContext/json/${jsonFilename}`);
console.log(`Project scope documentation generated in projectContext/markdown/${markdownFilename}`);
