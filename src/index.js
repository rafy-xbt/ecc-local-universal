#!/usr/bin/env node
/**
 * ECC-Local-Universal CLI
 * Everything Claude Code with Local LLM Support
 * 
 * Usage:
 *   npx ecc-local plan "Build authentication system"
 *   npx ecc-local review --file auth.js
 *   npx ecc-local tdd "calculate fibonacci" --language javascript
 */

const { LocalLLMAdapter } = require('./llm/adapter');
const { ModelRouter } = require('./llm/model-router');
const { bash, read, write, edit, grep, glob, python } = require('./sandbox/tools');

// Configuration
const CONFIG = {
  model: process.env.ECC_LOCAL_MODEL || 'llama-3.1-8b-instruct',
  provider: process.env.ECC_LOCAL_PROVIDER || 'ollama',
  baseURL: process.env.ECC_LOCAL_BASE_URL || 'http://localhost:11434',
  modelDir: process.env.ECC_LOCAL_MODELS || null,
  temperature: parseFloat(process.env.ECC_LOCAL_TEMPERATURE) || 0.7
};

// Initialize components
let adapter;
let router;

/**
 * Initialize the system
 */
async function init() {
  console.log('🚀 Initializing ECC-Local-Universal...');
  
  // Initialize LLM Adapter
  adapter = new LocalLLMAdapter(CONFIG);
  
  // Initialize Model Router
  router = new ModelRouter(adapter, CONFIG.modelDir);
  
  // Check availability
  const available = await adapter.isAvailable();
  
  if (!available) {
    console.error('\n❌ Error: Local LLM is not available');
    console.log('\nSetup instructions:');
    console.log('1. Install Ollama: https://ollama.ai');
    console.log('2. Pull a model: ollama pull llama3.1');
    console.log(`3. Or set: export ECC_LOCAL_BASE_URL="http://your-server:port"`);
    console.log(`4. Or set: export ECC_LOCAL_PROVIDER="llama-cpp" if using llama.cpp`);
    process.exit(1);
  }
  
  const models = await adapter.listModels();
  console.log(`✓ Local LLM available: ${models.join(', ')}`);
  console.log(`✓ Model: ${CONFIG.model}`);
  console.log(`✓ Provider: ${CONFIG.provider}`);
  
  return { adapter, router };
}

/**
 * Execute a plan using local LLM
 */
async function executePlan(description, context = {}) {
  console.log('\n📋 Executing Plan:', description);
  
  // Select appropriate model
  const modelSelection = router.selectModel('planner');
  console.log(`🧠 Using model type: ${modelSelection.type}`);
  
  // Update adapter settings
  await router.updateAdapter(modelSelection);
  
  // Get model info with fallback
  const modelInfo = await adapter.getModelInfo();
  const modelName = modelInfo ? (modelInfo.name || modelInfo.model) : modelSelection.type;
  console.log(`📊 Model: ${modelName || 'Local LLM'}`);
  
  // Construct system prompt
  const systemPrompt = `You are an expert planner for ${description}. ${JSON.stringify(context)}`;
  
  // Send to LLM
  const result = await adapter.sendMessage(
    systemPrompt,
    'Create a detailed, step-by-step plan for this task. Include: Context, Strategy, Steps (phased), Risks, and Verification. Be specific and actionable.',
    [
      { name: 'Read', description: 'Read file content', parameters: { filepath: '/tmp/project' } },
      { name: 'Bash', description: 'Execute system commands', parameters: { command: 'ls -la' } }
    ]
  );
  
  console.log('\n📝 PLAN RESULT:');
  console.log(result.content);
  
  return { plan: result.content, model: result.model };
}

/**
 * Review code using local LLM
 */
async function executeReview(filepath) {
  console.log('\n🔍 Executing Code Review:', filepath);
  
  // Read file
  const fileContent = read(filepath);
  if (fileContent.error) {
    console.error('❌ Error reading file:', fileContent.error);
    return null;
  }
  
  console.log(`📄 File size: ${fileContent.size} bytes, ${fileContent.lines} lines`);
  
  // Select code review model
  const modelSelection = router.selectModel('code-reviewer');
  await router.updateAdapter(modelSelection);
  
  // Construct prompt
  const systemPrompt = `You are an expert code reviewer. Review the following code for security, performance, and best practices.`;
  
  const userPrompt = `File: ${filepath}\n${fileContent.content.substring(0, 8000)}`;
  
  // Send to LLM
  const result = await adapter.sendMessage(
    systemPrompt,
    userPrompt,
    [
      { name: 'Read', description: 'Read file', parameters: { filepath } },
      { name: 'Grep', description: 'Search for patterns', parameters: { pattern: 'console.log|error|undefined', path: filepath } }
    ]
  );
  
  console.log('\n📝 REVIEW RESULT:');
  console.log(result.content);
  
  return { review: result.content, model: result.model };
}

/**
 * TDD workflow execution
 */
async function executeTDD(description, language = 'javascript') {
  console.log('\n🧪 Executing TDD Workflow:', description);
  
  // Phase 1: Planning
  console.log('Phase 1: Planning...');
  const plan = await executePlan(`TDD: ${description} in ${language}`);
  
  // Phase 2: Implementation
  console.log('Phase 2: Implementation...');
  
  // Phase 3: Testing
  console.log('Phase 3: Testing...');
  
  // Phase 4: Review
  console.log('Phase 4: Review...');
  
  console.log('\n📝 TDD WORKFLOW RESULT:');
  console.log(plan.plan);
  
  return { workflow: plan.plan };
}

/**
 * Main CLI handler
 */
async function main() {
  try {
    const { adapter, router } = await init();
    
    const command = process.argv[2];
    const args = process.argv.slice(3);
    
    if (!command) {
      console.log(`\nECC-Local-Universal CLI`);
      console.log('Usage: npx ecc-local <command> [options]\n');
      console.log('Commands:');
      console.log('  plan <description>    - Execute planning workflow');
      console.log('  review <file>         - Execute code review on file');
      console.log('  tdd <description>     - Execute TDD workflow');
      console.log('  test                  - Run system tests');
      console.log('\nEnvironment Variables:');
      console.log('  ECC_LOCAL_MODEL       - Model name (default: llama-3.1-8b-instruct)');
      console.log('  ECC_LOCAL_PROVIDER    - Provider: ollama, llama-cpp (default: ollama)');
      console.log('  ECC_LOCAL_BASE_URL    - API endpoint (default: http://localhost:11434)');
      console.log('  ECC_LOCAL_TEMPERATURE - Temperature (default: 0.7)');
      
      process.exit(0);
    }
    
    // Execute command
    switch (command) {
      case 'plan':
        const description = args[0] || 'Default task';
        await executePlan(description, { task: description });
        break;
        
      case 'review':
        const filepath = args[0];
        if (!filepath) {
          console.error('Error: Please provide a file path');
          process.exit(1);
        }
        await executeReview(filepath);
        break;
        
      case 'tdd':
        const tddDesc = args[0] || 'Default task';
        const lang = args[1] || 'javascript';
        await executeTDD(tddDesc, lang);
        break;
        
      case 'test':
        console.log('Running system tests...');
        await runSystemTests();
        break;
        
      default:
        console.error(`Unknown command: ${command}`);
        process.exit(1);
    }
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

/**
 * Run system tests
 */
async function runSystemTests() {
  console.log('\n🧪 Running System Tests...');
  
  const tests = [
    { name: 'LLM Availability', test: async () => {
      const available = await adapter.isAvailable();
      return available ? 'PASS' : 'FAIL';
    }},
    { name: 'Model List', test: async () => {
      const models = await adapter.listModels();
      return models.length > 0 ? 'PASS' : 'FAIL';
    }},
    { name: 'Tool Execution', test: async () => {
      const result = await bash('echo "Test OK"');
      return result.success ? 'PASS' : 'FAIL';
    }},
    { name: 'File Operations', test: async () => {
      const testFile = '/tmp/ecc-test.txt';
      await write(testFile, 'Test');
      const readBack = read(testFile);
      return readBack.content === 'Test' ? 'PASS' : 'FAIL';
    }}
  ];
  
  let passed = 0;
  let failed = 0;
  
  for (const test of tests) {
    try {
      const result = await test.test();
      console.log(`  ${result === 'PASS' ? '✓' : '✗'} ${test.name}`);
      if (result === 'PASS') passed++;
      else failed++;
    } catch (error) {
      console.log(`  ✗ ${test.name}: ${error.message}`);
      failed++;
    }
  }
  
  console.log(`\nResults: ${passed} passed, ${failed} failed`);
  
  if (failed > 0) {
    process.exit(1);
  }
}

// Export for testing
module.exports = {
  init,
  executePlan,
  executeReview,
  executeTDD,
  adapter: null // Will be set after init
};

// Run CLI
main();
