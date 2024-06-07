#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { program } from 'commander';

// CLI options
program
    .option('-e, --exclude <dirs>', 'Comma-separated list of directories to exclude', 'node_modules,.svelte-kit,.vscode,projectContext')
    .option('-f, --exclude-files <files>', 'Comma-separated list of files to exclude', 'package-lock.json')
    .parse(process.argv);

const options = program.opts();
const cwd = process.cwd();
const outputDir = path.join(cwd, 'projectContext');
const markdownOutputDir = path.join(outputDir, 'markdown');
const jsonOutputDir = path.join(outputDir, 'json');
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const markdownFilename = `projectScope_${timestamp}.md`;
const jsonFilename = `projectStructure_${timestamp}.json`;
const markdownFilePath = path.join(markdownOutputDir, markdownFilename);
const jsonFilePath = path.join(jsonOutputDir, jsonFilename);
const excludeDirs = options.exclude.split(',');
const excludeFiles = options.excludeFiles.split(',');

// Create output directories if they don't exist
if (!fs.existsSync(markdownOutputDir)) {
    fs.mkdirSync(markdownOutputDir, { recursive: true });
}
if (!fs.existsSync(jsonOutputDir)) {
    fs.mkdirSync(jsonOutputDir, { recursive: true });
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

// Main execution
generateJSON();
generateMarkdown();

console.log(`Project structure data saved in projectContext/json/${jsonFilename}`);
console.log(`Project scope documentation generated in projectContext/markdown/${markdownFilename}`);