const { LocalLLMAdapter } = require('./adapter');

/**
 * Model Router - Selects optimal local LLM based on task complexity
 * Inspired by Anthropic's Opus (complex) → Sonnet (coding) → Haiku (simple) hierarchy
 */
class ModelRouter {
  constructor(adapter, modelDir = null) {
    this.adapter = adapter;
    this.modelDir = modelDir; // Path to models directory
    this.models = {
      // Complex reasoning tasks (planning, architecture, complex analysis)
      'opus': {
        names: ['llama-3.1-70b-instruct', 'llama-3.2-3b-instruct-Qwen2.5-Coder-32B-Instruct'],
        useFor: ['planner', 'architect', 'security-reviewer', 'e2e-runner'],
        context: 131072,
        temperature: 0.3
      },
      
      // Coding and technical tasks
      'sonnet': {
        names: ['llama-3.1-8b-instruct', 'llama-3.2-3b-instruct-Qwen2.5-Coder-32B-Instruct', 'gemma-2-9b-it'],
        useFor: ['code-reviewer', 'tdd-guide', 'python-reviewer', 'go-reviewer', 'typescript-reviewer'],
        context: 8192,
        temperature: 0.5
      },
      
      // Simple queries and data extraction
      'haiku': {
        names: ['llama-3.2-1b-instruct', 'llama-3.2-3b-instruct'],
        useFor: ['database-reviewer', 'simple-lookup', 'grep-analysis'],
        context: 4096,
        temperature: 0.7
      }
    };
  }

  /**
   * Select model based on agent name
   */
  selectModel(agentName) {
    const mapping = {
      'planner': 'opus',
      'architect': 'opus',
      'security-reviewer': 'opus',
      'e2e-runner': 'opus',
      'code-reviewer': 'sonnet',
      'tdd-guide': 'sonnet',
      'typescript-reviewer': 'sonnet',
      'python-reviewer': 'sonnet',
      'go-reviewer': 'sonnet',
      'java-reviewer': 'sonnet',
      'rust-reviewer': 'sonnet',
      'kotlin-reviewer': 'sonnet',
      'cpp-reviewer': 'sonnet',
      'database-reviewer': 'haiku',
      'build-error-resolver': 'sonnet',
      'refactor-cleaner': 'sonnet',
      'loop-operator': 'opus',
      'harness-optimizer': 'sonnet'
    };

    const modelType = mapping[agentName] || 'sonnet';
    return { type: modelType, config: this.models[modelType] };
  }

  /**
   * Select model based on task complexity
   */
  selectByTask(task, complexity = 'medium') {
    const complexityMap = {
      'low': 'haiku',
      'medium': 'sonnet',
      'high': 'opus'
    };

    const modelType = complexityMap[complexity] || 'sonnet';
    return { type: modelType, config: this.models[modelType] };
  }

  /**
   * Auto-detect optimal model based on available local models
   */
  async autoDetect() {
    const availableModels = await this.adapter.listModels();
    console.log('Available local models:', availableModels);

    // Find best match
    for (const [typeName, config] of Object.entries(this.models)) {
      for (const modelName of config.names) {
        if (availableModels.some(available => 
          available.toLowerCase().includes(modelName.toLowerCase())
        )) {
          console.log(`Detected model: ${modelName} (type: ${typeName})`);
          return { type: typeName, config: config };
        }
      }
    }

    // Default to first available model
    if (availableModels.length > 0) {
      console.log(`Using default: ${availableModels[0]}`);
      return {
        type: 'sonnet',
        config: this.models['sonnet'],
        model: availableModels[0]
      };
    }

    return null;
  }

  /**
   * Update adapter with selected model
   */
  async updateAdapter(selectedConfig) {
    if (!selectedConfig) return;

    // Set model name
    this.adapter.setModel(selectedConfig.model || selectedConfig.type);
    
    // Apply specific settings
    if (selectedConfig.config) {
      this.adapter.setTemperature(selectedConfig.config.temperature || 0.5);
    }

    // Get model info safely (don't fail if null)
    try {
      const info = await this.adapter.getModelInfo();
      this.adapter.modelInfo = info;
    } catch (e) {
      // Ignore if model info retrieval fails
    }

    return this.adapter;
  }

  /**
   * Get recommended model for specific use case
   */
  getRecommendation(useCase) {
    const recommendations = {
      'coding': 'sonnet',
      'planning': 'opus',
      'testing': 'sonnet',
      'debugging': 'sonnet',
      'refactoring': 'sonnet',
      'documentation': 'haiku',
      'simple': 'haiku'
    };

    const modelType = recommendations[useCase.toLowerCase()] || 'sonnet';
    return this.models[modelType];
  }
}

// Export
module.exports = { ModelRouter };
