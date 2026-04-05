const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

/**
 * Local LLM Adapter - Anthropic API ↔ Local LLM Bridge
 * Supports llama.cpp, Ollama, and custom local API gateways
 */
class LocalLLMAdapter {
  constructor(config = {}) {
    this.model = config.model || 'llama-3.1-8b-instruct';
    this.provider = config.provider || 'ollama'; // 'ollama', 'llama-cpp', 'gateway'
    this.baseURL = config.baseURL || 'http://localhost:11434';
    this.temperature = config.temperature || 0.7;
    this.maxTokens = config.maxTokens || 4096;
    this.contextWindow = config.contextWindow || 8192;
    this.systemPrompt = config.systemPrompt || `
You are a helpful AI assistant running in a local development environment.
You have access to tools that can help you analyze code, run tests, and modify files.
Be precise, concise, and verify your work before suggesting changes.
  `;

    // Cache for model info
    this.modelInfo = null;
  }

  /**
   * Check if local LLM is available
   */
  async isAvailable() {
    try {
      if (this.provider === 'ollama') {
        const result = execSync(`curl -s http://${this.baseURL}/api/tags`, { encoding: 'utf8' });
        return JSON.parse(result).models.length > 0;
      } else {
        // Gateway mode (llama-cpp or custom) - check if endpoint is reachable
        const result = await fetch(`${this.baseURL}/v1/models`, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' }
        });
        return result.ok;
      }
    } catch (error) {
      console.error('Failed to check LLM availability:', error.message);
      return false;
    }
  }

  /**
   * List available local models
   */
  async listModels() {
    if (this.provider === 'ollama') {
      try {
        const result = execSync(`curl -s http://${this.baseURL}/api/tags`, { encoding: 'utf8' });
        const data = JSON.parse(result);
        return data.models.map(m => m.name);
      } catch {
        return [];
      }
    } else if (this.provider === 'llama-cpp') {
      // Return default models for llama.cpp
      return ['llama-3.1-8b-instruct.Q8_0.gguf', 'llama-3.2-1b-instruct.Q8_0.gguf'];
    }
    return [];
  }

  /**
   * Get model info
   */
  async getModelInfo() {
    if (!this.modelInfo) {
      try {
        if (this.provider === 'ollama') {
          const result = execSync(`curl -s http://${this.baseURL}/api/tags`, { encoding: 'utf8' });
          const data = JSON.parse(result);
          this.modelInfo = data.models.find(m => m.name === this.model || m.name.includes(this.model)) || data.models[0] || null;
        } else {
          // For llama-cpp gateway, try to get model info via v1/models endpoint
          const result = await fetch(`${this.baseURL}/v1/models`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
          });
          if (result.ok) {
            const data = await result.json();
            this.modelInfo = data.data && data.data.length > 0 ? data.data[0] : null;
          } else {
            this.modelInfo = null;
          }
        }
      } catch (e) {
        this.modelInfo = { name: this.model, size: 'Unknown', context: 4096 };
      }
    }
    return this.modelInfo;
  }

  /**
   * Send message to local LLM
   * Converts Claude API format to provider-specific format
   */
  async sendMessage(systemPrompt, userMessage, tools = [], stream = false) {
    const messages = [{ role: 'system', content: systemPrompt }, 
                     { role: 'user', content: userMessage }];

    if (stream) {
      return this.streamResponse(messages, tools);
    }

    try {
      const response = await this.sendRequest(messages, tools);
      return response;
    } catch (error) {
      console.error('LLM API Error:', error.message);
      throw new Error(`Failed to get response from ${this.provider} LLM: ${error.message}`);
    }
  }

  /**
   * Send request to local LLM (handles provider-specific formatting)
   */
  async sendRequest(messages, tools) {
    if (this.provider === 'ollama') {
      return await this.sendToOllama(messages, tools);
    } else if (this.provider === 'llama-cpp') {
      // llama.cpp needs different handling - typically via HTTP gateway
      return await this.sendToHTTPGateway(messages, tools);
    } else {
      return await this.sendToHTTPGateway(messages, tools);
    }
  }

  /**
   * Send to Ollama
   */
  async sendToOllama(messages, tools) {
    const requestBody = {
      model: this.model,
      messages: messages,
      options: {
        temperature: this.temperature,
        num_predict: this.maxTokens
      },
      stream: false
    };

    const body = JSON.stringify(requestBody);
    const response = await fetch(`${this.baseURL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: body
    });

    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.statusText}`);
    }

    const result = await response.json();
    return {
      content: result.message.content,
      model: result.model,
      done: result.done
    };
  }

  /**
   * Send to HTTP Gateway (Llama.cpp completion style)
   */
  async sendToHTTPGateway(messages, tools) {
    // Llama.cpp uses completion format, not chat format
    // Build prompt from messages
    let prompt = '';
    
    if (this.systemPrompt) {
      prompt += `SYSTEM: ${this.systemPrompt}\n\n`;
    }
    
    // Convert messages to prompt format
    if (messages.length > 0) {
      prompt += `USER: ${messages[0].content}\n\nASSISTANT: `;
      
      // Add follow-up messages as context
      if (messages.length > 1) {
        for (const msg of messages.slice(1)) {
          prompt += `${msg.role}: ${msg.content}\n\n`;
        }
      }
    }

    // For local LLMs, we assume they support basic completion
    // Send as completion request
    const requestBody = {
      prompt: prompt,
      max_tokens: this.maxTokens,
      temperature: this.temperature,
      system: this.systemPrompt
    };

    const body = JSON.stringify(requestBody);
    
    // Try standard llama.cpp endpoint first
    const url = `${this.baseURL}/v1/completions`;
    
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: body
      });

      if (!response.ok) {
        // Try alternative endpoint
        const altUrl = `${this.baseURL}/chat/completions`;
        const altResponse = await fetch(altUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: body
        });
        
        if (!altResponse.ok) {
          throw new Error(`Gateway API error: ${response.statusText}`);
        }
        
        const altResult = await altResponse.json();
        return {
          content: altResult.choices && altResult.choices[0]?.message?.content || '',
          model: altResult.model,
          done: true
        };
      }

      const result = await response.json();
      
      // Parse completion
      const content = result.choices && result.choices[0]?.text || result.completion || '';
      
      // Try to extract JSON if it's a tool call response
      let toolCalls = null;
      if (content.trim().startsWith('{')) {
        try {
          const parsed = JSON.parse(content);
          // Check if this is a tool call response
          if (parsed.tools || parsed.tool_calls) {
            toolCalls = parsed.tools || parsed.tool_calls || null;
            content = JSON.stringify(parsed);
          }
        } catch (e) {
          // Not JSON, treat as plain text
        }
      }

      return {
        content: content.trim(),
        tool_calls: toolCalls,
        model: result.model
      };
    } catch (error) {
      throw new Error(`Gateway API error: ${response?.statusText || error.message}`);
    }
  }

  /**
   * Stream response from Ollama
   */
  async streamResponse(messages, tools) {
    const requestBody = {
      model: this.model,
      messages: messages,
      options: {
        temperature: this.temperature,
        num_predict: this.maxTokens
      },
      stream: true
    };

    const response = await fetch(`${this.baseURL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      throw new Error(`Ollama streaming error: ${response.statusText}`);
    }

    const chunks = [];
    for await (const chunk of response.body) {
      const data = JSON.parse(chunk);
      if (data.message.content) {
        chunks.push(data.message.content);
        // Emit to stream (would use Node.js Readable stream in production)
      }
    }

    return {
      content: chunks.join(''),
      model: data.model,
      done: data.done
    };
  }

  /**
   * Update model configuration
   */
  setModel(modelName) {
    this.model = modelName;
    this.modelInfo = null; // Clear cache
    return this;
  }

  /**
   * Update temperature
   */
  setTemperature(temp) {
    this.temperature = Math.max(0, Math.min(2, temp));
    return this;
  }

  /**
   * Get current configuration
   */
  getConfiguration() {
    return {
      model: this.model,
      provider: this.provider,
      baseURL: this.baseURL,
      temperature: this.temperature,
      maxTokens: this.maxTokens,
      contextWindow: this.contextWindow
    };
  }

  /**
   * Check if current model can handle the requested tools
   */
  async checkCapability(requiredTools) {
    // For local LLMs, assume capability but warn about tool use limitations
    const models = await this.listModels();
    const currentModel = models.find(m => m.toLowerCase().includes(this.model.toLowerCase()));
    
    // Most local LLMs struggle with tool use, but some support it
    return {
      supported: requiredTools.length === 0 || requiredTools.length <= 2,
      model: currentModel,
      note: 'Local LLMs may have limited tool use support'
    };
  }
}

// Export for use in other modules
module.exports = { LocalLLMAdapter };

// CLI test
if (require.main === module) {
  async function test() {
    const adapter = new LocalLLMAdapter({ provider: 'ollama' });
    
    console.log('Testing Local LLM Adapter...');
    
    if (await adapter.isAvailable()) {
      console.log('✓ Local LLM is available');
      
      const models = await adapter.listModels();
      console.log('Available models:', models);
      
      if (models.includes(adapter.model)) {
        console.log('Testing message...');
        const result = await adapter.sendMessage(
          'You are a helpful assistant.',
          'Hello, how are you?',
          []
        );
        console.log('Response:', result.content.substring(0, 100));
      } else {
        console.log('Warning: Model not found. Available:', models);
      }
    } else {
      console.log('✗ Local LLM not available. Check if Ollama is running:');
      console.log('  curl http://localhost:11434/api/tags');
    }
  }

  test().catch(console.error);
}
