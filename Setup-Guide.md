# Setup Guide for ECC-Local-Universal

**Complete Installation & Configuration Guide** | **Last Updated**: 2026-04-05

---

## 📋 **Pre-Flight Checklist**

Before starting, ensure you have:
- [ ] **4GB+ RAM** available (minimum 2GB)
- [ ] **10GB+ storage** for model files
- [ ] **Node.js 18+** installed (`node --version`)
- [ ] **Git** installed (`git --version`)
- [ ] **Internet access** for model downloads

---

## 🚀 **Installation Steps**

### Step 1: Clone Repository

```bash
# Clone ECC-Local-Universal
cd /home/agent/
git clone https://github.com/affaan-m/everything-claude-code.git ecc-local-universal
cd ecc-local-universal

# Verify clone
ls -la src/
ls -la config/
```

**Expected Output:**
```
drwxrwxr-x   6 agent agent 4096 Apr  5 22:55 src/
drwxrwxr-x   2 agent agent 4096 Apr  5 22:55 config/
```

---

### Step 2: Choose Provider & Install

#### Option A: Ollama (Recommended for Beginners)

**Install Ollama:**
```bash
curl -fsSL https://ollama.com/install.sh | sh
```

**Verify Installation:**
```bash
ollama --version
# Expected: ollama 0.1.32+ (Linux)
```

**Pull Model:**
```bash
# For hardware < 8GB RAM (Fast)
ollama pull llama3.2:1b

# For hardware 8-16GB RAM (Balanced)
ollama pull llama3.1:8b

# For hardware > 24GB RAM (High Quality)
ollama pull llama3.1:70b
```

**Start Ollama Server:**
```bash
# Start in background
ollama serve &

# Verify server is running
curl http://localhost:11434/api/tags
```

**Expected Output:**
```json
{"models":[{"name":"llama3.1:8b","model":"llama3.1:8b",...}]}
```

#### Option B: Llama.cpp (For Performance) **

**Download llama.cpp:**
```bash
mkdir -p /tmp/llama
cd /tmp/llama
wget https://github.com/ggml-org/llama.cpp/releases/download/v0.0.1/llama-server-v0.0.1-x86_64-linux-gnu
chmod +x llama-server
sudo mv llama-server /usr/local/bin/
```

**Download Model:**
```bash
# Using Ollama to pull model, then move to llama.cpp
ollama pull llama3.1:8b

# Extract model path (Linux)
MODEL_PATH=$(ollama list | grep llama3.1:8b | awk '{print $2}')
mv "$MODEL_PATH" /home/agent/models/
```

**Start Llama.cpp Server:**
```bash
# Basic usage
llama-server -m /home/agent/models/llama-3.1-8b.gguf -c 8192 -t 4 --port 11434

# With GPU support (if NVIDIA)
llama-server -m /home/agent/models/llama-3.1-8b.gguf -c 8192 -t 4 --port 11434 --gpu 0

# Verify server
curl http://localhost:11434/v1/models
```

**Expected Output:**
```json
{"models":[{"name":"llama-3.1-8b.gguf",...}]}
```

#### Option C: Custom Gateway (Advanced)

If using custom API gateway (e.g., OpenRouter, Groq, or self-hosted):

```bash
# Example with OpenRouter
export ECC_LOCAL_BASE_URL="https://openrouter.ai/api/v1"
export ECC_LOCAL_MODEL="meta-llama/llama-3.1-8b-instruct:free"
```

---

### Step 3: Configure Environment

**Create `.env` file** (optional, but recommended):

```bash
# Create .env file
cd /home/agent/ecc-local-universal
cat > .env << 'EOF'
# Provider Configuration
ECC_LOCAL_PROVIDER=ollama

# API Endpoint
ECC_LOCAL_BASE_URL=http://localhost:11434

# Model Configuration
ECC_LOCAL_MODEL=llama3.1:8b

# Performance Tuning
ECC_LOCAL_TEMPERATURE=0.7
ECC_LOCAL_MAX_TOKENS=4096
ECC_LOCAL_CONTEXT_WINDOW=8192

# Paths
ECC_LOCAL_MODELS=/home/agent/models
EOF
```

**Or set directly:**
```bash
export ECC_LOCAL_PROVIDER="ollama"
export ECC_LOCAL_BASE_URL="http://localhost:11434"
export ECC_LOCAL_MODEL="llama3.1:8b"
export ECC_LOCAL_TEMPERATURE="0.7"
```

---

### Step 4: Verify Installation

**Run Health Check:**
```bash
cd /home/agent/ecc-local-universal
export ECC_LOCAL_PROVIDER="ollama"
export ECC_LOCAL_BASE_URL="http://localhost:11434"
export ECC_LOCAL_MODEL="llama3.1:8b"

node src/index.js test
```

**Expected Output:**
```
🚀 Initializing ECC-Local-Universal...
✓ Local LLM available: llama3.1:8b
✓ Model: llama3.1:8b
✓ Provider: ollama

🧪 Running System Tests...
  ✓ LLM Availability
  ✓ Model List
  ✓ Tool Execution
  ✓ File Operations

Results: 4 passed, 0 failed
```

**If you see errors:**
```bash
# Check Ollama is running
ps aux | grep ollama

# Check if port is in use
netstat -tlnp | grep 11434

# Restart if needed
killall ollama
ollama serve
```

---

### Step 5: First Workflow Test

**Test Planning:**
```bash
export ECC_LOCAL_PROVIDER="ollama"
export ECC_LOCAL_BASE_URL="http://localhost:11434"
export ECC_LOCAL_MODEL="llama3.1:8b"

node src/index.js plan "Build REST API dengan Node.js"
```

**Expected Behavior:**
- Should generate comprehensive plan with phases
- Response time: ~10-30 seconds depending on model size
- No errors, clean output

---

## 🔧 **Troubleshooting Common Issues**

### Issue 1: "Local LLM is not available"

**Symptoms:**
```
❌ Error: Local LLM is not available
```

**Diagnosis:**
```bash
# Check if Ollama is running
ps aux | grep ollama

# Check if port is listening
netstat -tlnp | grep 11434

# Try manual curl
curl http://localhost:11434/v1/models
```

**Solutions:**
```bash
# Solution A: Start Ollama
ollama serve

# Solution B: Check model exists
ollama list

# Solution C: Verify network
ping localhost
```

---

### Issue 2: "Bad Request" or HTTP 400

**Symptoms:**
```
LLM API Error: Gateway API error: Bad Request
```

**Diagnosis:**
```bash
# Check model name matches
ollama list
# Compare with: export ECC_LOCAL_MODEL

# Check server logs
cat ~/ollama/logs/ollama.log | tail -50
```

**Solutions:**
```bash
# Solution A: Fix model name
export ECC_LOCAL_MODEL="$(ollama list | grep llama3.1 | awk '{print $2}')"

# Solution B: Restart server
killall ollama
ollama serve &

# Solution C: Clear Ollama cache
ollama rm llama3.1:8b
ollama pull llama3.1:8b
```

---

### Issue 3: Slow Response / Timeout

**Symptoms:**
- Response takes >60 seconds
- "Request timed out after 10 minutes"

**Diagnosis:**
```bash
# Check system resources
free -h
uptime

# Check CPU usage
htop
```

**Solutions:**
```bash
# Solution A: Reduce context window
export ECC_LOCAL_CONTEXT_WINDOW="4096"

# Solution B: Use smaller model
export ECC_LOCAL_MODEL="llama3.2:1b"

# Solution C: Increase timeout
# Edit src/index.js and increase timeout values
```

---

### Issue 4: Memory Issues / OOM Killer

**Symptoms:**
- System crashes
- "Out of memory" errors

**Diagnosis:**
```bash
# Check memory usage
cat /proc/meminfo | grep MemAvailable

# Check for OOM killer
dmesg | grep -i "killed process"
```

**Solutions:**
```bash
# Solution A: Use smaller model
export ECC_LOCAL_MODEL="llama3.2:1b"

# Solution B: Reduce context
export ECC_LOCAL_CONTEXT_WINDOW="2048"

# Solution C: Increase system swap
sudo fallocate -l 4G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
```

---

## 🎯 **Performance Tuning**

### For Hardware < 8GB RAM
```
ECC_LOCAL_MODEL=llama3.2:1b
ECC_LOCAL_CONTEXT_WINDOW=2048
ECC_LOCAL_TEMPERATURE=0.5
```

### For Hardware 8-16GB RAM
```
ECC_LOCAL_MODEL=llama3.1:8b
ECC_LOCAL_CONTEXT_WINDOW=4096
ECC_LOCAL_TEMPERATURE=0.7
```

### For Hardware > 24GB RAM
```
ECC_LOCAL_MODEL=llama3.1:70b
ECC_LOCAL_CONTEXT_WINDOW=8192
ECC_LOCAL_TEMPERATURE=0.3
```

### Temperature Settings
- **0.1-0.3**: Deterministic, good for planning/code
- **0.5-0.7**: Balanced, good for review
- **0.8-1.0**: Creative, good for brainstorming
- **>1.0**: Very random, rarely useful

---

## 📊 **Verification Checklist**

After setup, run these checks:

- [ ] **Health Check**: `node src/index.js test` - All 4 tests pass
- [ ] **Planning**: `node src/index.js plan "test"` - Generates plan
- [ ] **Review**: `node src/index.js review src/index.js` - Analyzes code
- [ ] **TDD**: `node src/index.js tdd "test" --language javascript` - Workflow runs
- [ ] **Performance**: Response time < 60 seconds for simple tasks
- [ ] **Stability**: No crashes after 10+ iterations

---

## 🎓 **Next Steps**

1. **Read Original ECC**: Review [CLAUDE.md](./CLAUDE.md) for full features
2. **Explore Agents**: Check `src/agents/` for available agents
3. **Customize**: Modify `config/default.yaml` for your needs
4. **Deploy**: Push to GitHub using provided instructions

---

**Setup Complete! 🎉**

**Need Help?**
- Check [Troubleshooting.md](./Troubleshooting.md)
- Review [README.md](./README.md)
- Open GitHub Issues

**End of Setup Guide**
