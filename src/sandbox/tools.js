/**
 * Local Tool Execution Sandbox
 * Executes tools without external API dependencies
 */

const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Configuration
const MAX_OUTPUT_SIZE = 50000; // 50KB limit
const MAX_LINES = 500;
const SLEEP_TIMEOUT = 30000; // 30s for sleep commands

/**
 * Execute shell command with sandboxing
 */
async function bash(command, options = {}) {
  try {
    const { timeout = SLEEP_TIMEOUT, workdir = '.', env = process.env } = options;

    // Block dangerous commands
    const blockedPatterns = ['rm -rf /', 'rm -rf ~', 'dd if=/dev/zero', 'mkfs', 'format'];
    if (blockedPatterns.some(p => command.toLowerCase().includes(p))) {
      throw new Error(`Blocked dangerous command pattern: ${p}`);
    }

    // Execute command
    const startTime = Date.now();
    let output = '';
    let error = '';

    try {
      const result = execSync(command, {
        encoding: 'utf8',
        timeout,
        cwd: workdir,
        env,
        stdio: ['pipe', 'pipe', 'pipe'],
        maxBuffer: MAX_OUTPUT_SIZE
      });
      
      output = result.stdout;
      
      if (result.stderr) {
        error = result.stderr;
      }

      return {
        success: true,
        output: output.trim(),
        error: error.trim(),
        duration: Date.now() - startTime,
        command: command
      };

    } catch (execError) {
      const exitCode = execError.status || execError.code;
      
      if (execError.message.includes('timeout')) {
        return {
          success: false,
          error: `Command timed out after ${timeout}ms`,
          output: output,
          command: command
        };
      }

      return {
        success: false,
        error: `Exit code ${exitCode}: ${execError.message}\n${error}`, 
        output: output,
        command: command
      };
    }
  } catch (e) {
    return {
      success: false,
      error: `Execution error: ${e.message}`
    };
  }
}

/**
 * Read file content
 */
function read(filepath, options = {}) {
  const { encoding = 'utf8', limitLines = MAX_LINES } = options;
  
  if (!fs.existsSync(filepath)) {
    return { error: 'File not found', filepath };
  }

  try {
    const content = fs.readFileSync(filepath, { encoding });
    
    // Limit output size
    if (content.length > MAX_OUTPUT_SIZE) {
      const lines = content.split('\n');
      const truncated = lines.slice(0, limitLines).join('\n') + '\n...[truncated]';
      return {
        filepath,
        size: content.length,
        lines: lines.length,
        content: truncated
      };
    }

    return {
      filepath,
      size: content.length,
      lines: content.split('\n').length,
      content: content
    };
  } catch (error) {
    return { error: `Read error: ${error.message}`, filepath };
  }
}

/**
 * Search file contents
 */
function grep(pattern, path, options = {}) {
  const { flags = 'i', maxResults = 20, workdir = '.' } = options;
  
  // Build grep command
  const args = ['grep', `-${flags}`, '-A', '2', '-B', '2'];
  
  if (maxResults > 0) {
    args.push('-m', maxResults.toString());
  }
  
  args.push(pattern, path);
  
  return bash(args.join(' '), { workdir });
}

/**
 * Write file content
 */
function write(filepath, content, options = {}) {
  const { encoding = 'utf8', create = true } = options;
  
  if (!create && !fs.existsSync(filepath)) {
    return { success: false, error: 'Parent directory not found' };
  }

  try {
    const dir = path.dirname(filepath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(filepath, content, { encoding });
    
    return {
      success: true,
      filepath,
      size: Buffer.byteLength(content, encoding),
      created: fs.statSync(filepath).mtime
    };
  } catch (error) {
    return { success: false, error: error.message, filepath };
  }
}

/**
 * Edit file (read-modify-write)
 */
function edit(filepath, modifications, options = {}) {
  const result = read(filepath);
  if (result.error) return result;

  let content = result.content;
  let changes = [];

  // Parse modifications (array of strings or objects)
  modifications.forEach(mod => {
    if (typeof mod === 'string') {
      // Simple line replacement: "old" -> "new"
      const regex = new RegExp(mod, 'g');
      content = content.replace(regex, options.replace || '');
      changes.push({ type: 'replace', pattern: mod });
    } else if (mod.from !== undefined) {
      // Line-based operations
      const lines = content.split('\n');
      if (mod.delete) {
        lines.splice(mod.from, mod.delete);
        changes.push({ type: 'delete', from: mod.from, count: mod.delete });
      }
      if (mod.insert) {
        lines.splice(mod.from, 0, mod.insert);
        changes.push({ type: 'insert', from: mod.from, text: mod.insert });
      }
    }
  });

  const writeResult = write(filepath, content);
  if (writeResult.success) {
    return {
      success: true,
      filepath,
      changes: changes.length > 0 ? changes : 'No changes made',
      oldSize: result.size,
      newSize: writeResult.size
    };
  }
  
  return writeResult;
}

/**
 * Glob pattern matching (ls -la style)
 */
function glob(pattern, options = {}) {
  const { workdir = '.', maxResults = 100 } = options;
  const fullPattern = path.join(workdir, pattern);
  
  try {
    const results = fs.readdirSync(fullPattern);
    
    // Convert to absolute paths and format
    const files = results.map(f => {
      const fullpath = path.join(fullPattern, f);
      const stats = fs.statSync(fullpath);
      
      if (stats.isDirectory()) {
        return {
          name: f,
          path: fullpath,
          type: 'dir',
          size: 0,
          mtime: stats.mtime
        };
      } else {
        return {
          name: f,
          path: fullpath,
          type: 'file',
          size: stats.size,
          mtime: stats.mtime
        };
      }
    });

    return {
      pattern: pattern,
      workdir: workdir,
      results: files.slice(0, maxResults),
      count: files.length
    };
  } catch (error) {
    return { error: error.message, pattern, workdir };
  }
}

/**
 * Hash file content
 */
function hash(filepath, algorithm = 'sha256') {
  const content = fs.readFileSync(filepath);
  return crypto.createHash(algorithm).update(content).digest('hex');
}

/**
 * Check if path exists and is accessible
 */
function exists(filepath) {
  return fs.existsSync(filepath) && fs.accessSync(filepath, fs.constants.R_OK);
}

/**
 * Compare two file hashes
 */
function fileCompare(file1, file2, algorithm = 'sha256') {
  return hash(file1, algorithm) === hash(file2, algorithm);
}

/**
 * Execute Python code (for data analysis tasks)
 */
async function python(code, options = {}) {
  const { workdir = '.', timeout = 30000 } = options;
  
  const script = `
import sys
import os

# Redirect stdout for capture
import io

# Execute the code
try:
    exec(compile(code, '<string>', 'exec'))
    print('OK')
except Exception as e:
    print(f'ERROR: {e}', file=sys.stderr)
    sys.exit(1)
`;

  const command = `cd "${workdir}" && python3 -c "${script.replace(/"/g, '\\')}" 2>&1`;
  
  return bash(command, { timeout, workdir });
}

/**
 * Execute Node.js code (for JavaScript utilities)
 */
async function nodejs(code, options = {}) {
  const { workdir = '.', timeout = 30000 } = options;
  
  // Write temp file
  const tmpfile = path.join(workdir, `tmp_${Date.now()}.js`);
  fs.writeFileSync(tmpfile, code);
  
  const command = `cd "${workdir}" && node "${tmpfile}" 2>&1`;
  
  const result = await bash(command, { timeout, workdir });
  
  // Cleanup
  try {
    fs.unlinkSync(tmpfile);
  } catch (e) {}
  
  return result;
}

/**
 * List directory contents (ls -la style)
 */
function listDir(dirPath, options = {}) {
  const { maxFiles = 100, showHidden = false } = options;
  
  try {
    let results = fs.readdirSync(dirPath);
    
    if (!showHidden) {
      results = results.filter(f => !f.startsWith('.'));
    }
    
    // Get stats for each file
    const details = results.map(f => {
      const fullpath = path.join(dirPath, f);
      const stats = fs.statSync(fullpath);
      
      return {
        name: f,
        path: fullpath,
        isDirectory: stats.isDirectory(),
        size: stats.size,
        mtime: stats.mtime,
        permissions: stats.mode
      };
    });

    return {
      dir: dirPath,
      entries: details.slice(0, maxFiles),
      total: details.length
    };
  } catch (error) {
    return { error: error.message, dir: dirPath };
  }
}

/**
 * Create sandboxed environment
 */
function createSandbox(workdir) {
  const sandboxPath = path.join(workdir, '.ecc-sandbox');
  
  if (fs.existsSync(sandboxPath)) {
    return sandboxPath;
  }

  fs.mkdirSync(sandboxPath, { recursive: true });
  
  return sandboxPath;
}

// Export all tools
module.exports = {
  bash,
  read,
  write,
  edit,
  grep,
  glob,
  hash,
  exists,
  fileCompare,
  python,
  nodejs,
  listDir,
  createSandbox
};

// CLI test
if (require.main === module) {
  async function test() {
    console.log('Testing Local Tools Sandbox...');
    
    // Test read
    const result = read('/etc/hostname');
    console.log('Hostname:', result.content || result.error);

    // Test write
    const testFile = '/tmp/ecc-test.txt';
    await write(testFile, 'Hello ECC-Local!', { create: true });
    console.log('Written to:', testFile);
    console.log('Size:', result.size);

    // Test bash
    const bashResult = await bash('echo "Current dir: $(pwd)"', { workdir: '.' });
    console.log('Bash output:', bashResult.output);

    // Test glob
    const files = glob('*.js', { maxResults: 3 });
    console.log('Found JS files:', files.results.map(f => f.name));

    console.log('All tests passed!');
  }

  test().catch(console.error);
}
