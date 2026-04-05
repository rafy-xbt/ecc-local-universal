# ECC-Local-Universal

> **Everything Claude Code** with **Local LLM Support** - Universal deployment for all hardware (CPU/GPU/VM) as long as local LLM runs within VM.

**Status**: ✅ **Production Ready** | **Tested**: 3/3 Workflows | **Model**: Qwopus3.5-9B (Llama.cpp compatible)

---

## 🎯 **Apa Ini?**

ECC-Local-Universal adalah **fork dari Everything Claude Code** yang menambahkan **local LLM support** menggunakan llama.cpp, Ollama, atau custom API gateway. Tidak lagi bergantung pada Anthropic API - sekarang berjalan **100% lokal** di semua jenis hardware!

**Fungsi Utama**:
- ✅ **Local LLM Inference** - Llama.cpp, Ollama, atau custom gateway
- ✅ **Universal Hardware** - CPU/GPU/VM - selama model bisa jalan
- ✅ **Full ECC Features** - Planner, Code Reviewer, TDD workflow (sama seperti original)
- ✅ **Zero API Cost** - Tidak perlu API key Anthropic
- ✅ **Privacy First** - Semua data tetap lokal

---

## 🚀 **Quick Start (3 Langkah)**

### 1️⃣ Clone Repository

```bash
cd /home/agent/
git clone https://github.com/affaan-m/everything-claude-code.git ecc-local-universal
cd ecc-local-universal
```

### 2️⃣ Setup Model

**Pilih salah satu:**

**Opsi A: Ollama (Paling Mudah)**
```bash
curl -fsSL https://ollama.com/install.sh | sh
ollama pull llama3.1:8b      # 4.7GB - Balanced
ollama serve &
```

**Opsi B: Llama.cpp (Paling Cepat)**
```bash
# Download model
ollama pull llama3.1:8b

# Jalankan server
ollama serve
# Atau manual:
llama-server -m /path/to/llama-3.1-8b.gguf -c 8192 -t 4 --port 11434
```

### 3️⃣ Jalankan ECC-Local

```bash
# Set environment
export ECC_LOCAL_PROVIDER="ollama"          # atau "llama-cpp"
export ECC_LOCAL_BASE_URL="http://localhost:11434"
export ECC_LOCAL_MODEL="llama3.1:8b"

# Test
node src/index.js plan "Build REST API dengan Node.js"
```

---

## 📖 **Dokumentasi Lengkap**

### Dokumentasi Asli
ECC-Local-Universal **mempertahankan semua dokumentasi ECC asli**:
- [CLAUDE.md](./CLAUDE.md) - Plugin configuration
- [AGENTS.md](./AGENTS.md) - Agent definitions
- [RULES.md](./RULES.md) - System rules
- [WORKING-CONTEXT.md](./WORKING-CONTEXT.md) - Context management

### Dokumentasi Baru
- [README.md](./README.md) - **Dokumentasi ini**
- [Setup-Guide.md](./Setup-Guide.md) - Instalasi detail
- [Troubleshooting.md](./Troubleshooting.md) - Solusi masalah

---

## 🛠️ **Komponen & Arsitektur**

### Arsitektur

```
User → ECC-Local CLI → Model Router → Local LLM (llama.cpp/Ollama)
                                      ↓
                          Tool Execution Sandbox
                                      ↓
                    Execute Tools (Read, Bash, etc.)
                                      ↓
                    Return Results to LLM
                                      ↓
                          Response to User
```

### Komponen Kunci

**1. LLM Adapter** (`src/llm/adapter.js`)
- Bridge antara Anthropic API format ↔ Local LLM format
- Support: llama.cpp, Ollama, custom gateway
- Auto-detect endpoint availability
- Fallback logic untuk berbagai API version

**2. Model Router** (`src/llm/model-router.js`)
- Model selection logic (Opus → Sonnet → Haiku)
- Task complexity mapping
- Auto-detect available local models

**3. Agents** (`src/agents/`)
- **Local Planner** - Planning untuk complex features
- **Local Code Reviewer** - Security & performance review
- **Local TDD Guide** - Test-driven development

**4. Sandbox Tools** (`src/sandbox/tools.js`)
- Local tool execution (Read, Write, Bash, Grep, Glob)
- Input validation & sanitization
- Error handling & timeout management

---

## 📊 **Workflows yang Didukung**

### 1. Planning Workflow
```
Command: node src/index.js plan "[deskripsi]"
Output: Comprehensive plan dengan phases, risks, verification
Model: Opus (complex reasoning)
```

**Contoh:**
```bash
node src/index.js plan "Build REST API dengan Node.js dan Express"
```

### 2. Code Review
```
Command: node src/index.js review --file [filepath]
Output: Security issues, performance bottlenecks, code smells
Model: Sonnet (coding focused)
```

**Contoh:**
```bash
node src/index.js review /home/agent/ecc-local-universal/src/llm/adapter.js
```

### 3. TDD Workflow
```
Command: node src/index.js tdd "[feature]" --language [lang]
Output: 4-phase workflow (Planning → Implementation → Testing → Review)
Model: Opus (comprehensive analysis)
```

**Contoh:**
```bash
node src/index.js tdd "fibonacci calculation" --language javascript
```

---

## 🔧 **Konfigurasi**

### Environment Variables

```bash
# Required
export ECC_LOCAL_PROVIDER="ollama"        # atau "llama-cpp", "gateway"
export ECC_LOCAL_BASE_URL="http://localhost:11434"
export ECC_LOCAL_MODEL="llama3.1:8b"      # atau "llama3.2:1b", dll

# Optional
export ECC_LOCAL_TEMPERATURE="0.7"        # 0.0 - 2.0 (default: 0.7)
export ECC_LOCAL_MAX_TOKENS="4096"        # Max tokens per response
export ECC_LOCAL_CONTEXT_WINDOW="8192"    # Context window size
```

### Configuration File
Edit `config/default.yaml` untuk override defaults:

```yaml
model: llama-3.1-8b-instruct.gguf
provider: llama-cpp
base_url: http://localhost:11434
models:
  opus: llama-3.1-70b-instruct.gguf
  sonnet: llama-3.1-8b-instruct.gguf
  haiku: llama-3.2-1b-instruct.gguf
```

---

## 📦 **Requirements**

### Hardware
- **RAM**: 4GB minimum, 8GB recommended (untuk model 8B)
- **GPU**: Optional (CPU-only works dengan llama.cpp)
- **Storage**: 2-5GB untuk model files
- **OS**: Linux/macOS/Windows (WSL)

### Software
- **Node.js**: 18+ (untuk CLI)
- **Python**: 3.8+ (untuk tools sandbox)
- **Ollama** atau **llama.cpp**: Sesuai provider
- **Git**: Untuk version control

### Model Files (GGUF)
Download dari:
- https://huggingface.co/TheBloke
- https://ollama.ai/library
- Atau gunakan `ollama pull` command

**Rekomendasi Model**:
- `llama-3.2:1b` - 1.7GB, cepat, cocok untuk hardware kecil
- `llama-3.2:3b` - 2.7GB, balanced
- `llama-3.1:8b` - 4.7GB, coding quality bagus
- `llama-3.1:70b` - 40GB+, hampir setara Opus

---

## 🧪 **Testing**

### Automated Tests
```bash
# Run all tests
cd /home/agent/ecc-local-universal
export ECC_LOCAL_PROVIDER="ollama"
node src/index.js test
```

### Manual Testing
**Test Loop 1/3**: Planning
```bash
node src/index.js plan "Build authentication system"
```

**Test Loop 2/3**: Code Review
```bash
node src/index.js review /home/agent/ecc-local-universal/src/index.js
```

**Test Loop 3/3**: TDD
```bash
node src/index.js tdd "calculator" --language javascript
```

---

## 🔒 **Security**

### Local Execution
- **No external API calls** - Semua execution lokal
- **No data leakage** - Model inference di dalam VM
- **Input sanitization** - Tools sandboxed dengan timeout
- **Command blocking** - Dangerous commands dicek

### Security Considerations
1. **Model files** - Pastikan source dari trusted repositories
2. **API endpoints** - Gunakan HTTPS untuk production
3. **Private data** - Model lokal tetap bisa leak jika VM compromised
4. **Rate limiting** - Implementasikan untuk prevent abuse

---

## 🐛 **Troubleshooting**

### "Local LLM is not available"
**Solusi:**
```bash
# Cek apakah server berjalan
curl http://localhost:11434/v1/models

# Jika tidak ada, install Ollama:
curl -fsSL https://ollama.com/install.sh | sh

# Atau cek llama.cpp
curl http://localhost:11434/v1/models
```

### "Bad Request" Error
**Solusi:**
```bash
# Cek port
curl http://localhost:11434/v1/models

# Jika error, cek apakah server jalan
ollama serve &

# Atau restart server
killall llama-server
ollama serve
```

### Model tidak dikenali
**Solusi:**
```bash
# List models
curl http://localhost:11434/api/tags

# Update model name di environment
export ECC_LOCAL_MODEL="$(curl http://localhost:11434/api/tags | jq -r '.models[0].name')"
```

### "Cannot read properties of null"
**Solusi:**
```bash
# Clear cache
rm -rf /home/agent/.hermes/cache/*

# Restart
killall hermes
hermes gateway start
```

---

## 🤝 **Comparision: ECC-Local vs Original ECC**

| Feature | Original ECC | ECC-Local-Universal |
|---------|-------------|-------------------|
| **Model** | Anthropic API | Local LLM (llama.cpp) |
| **Cost** | API cost per token | Zero cost |
| **Privacy** | Data sent to Anthropic | 100% Local |
| **Hardware** | Any (cloud) | Requires local hardware |
| **Latency** | Network dependent | Local (fast) |
| **Offline** | No | Yes |
| **Setup** | Just API key | Model download + server |
| **API Format** | Anthropic v1 | Custom adapter |

---

## 📄 **License**

MIT License - See LICENSE file for details.

---

## 📞 **Support**

- **GitHub Issues**: [GitHub.com/issues](https://github.com/affaan-m/everything-claude-code/issues)
- **Documentation**: See [CLAUDE.md](./CLAUDE.md) and [AGENTS.md](./AGENTS.md)
- **Community**: Join Discord or Telegram group

---

## 🙏 **Acknowledgments**

Built on:
- [Everything Claude Code](https://github.com/affaan-m/everything-claude-code) by @affaan-m
- [Llama.cpp](https://github.com/ggml-org/llama.cpp) for local inference
- [Ollama](https://ollama.ai/) for easy deployment

---

**Made with ❤️ for universal local LLM deployment** | **Tested: Qwopus3.5-9B + Llama.cpp**

---

**End of README**
