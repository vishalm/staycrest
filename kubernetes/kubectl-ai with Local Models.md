# kubectl-ai with Local Models

This guide explains how to set up and use kubectl-ai with local LLM models using Ollama.

## Prerequisites

- [kubectl](https://kubernetes.io/docs/tasks/tools/) installed and configured
- [kubectl-ai](https://github.com/GoogleCloudPlatform/kubectl-ai) plugin installed
- [Ollama](https://ollama.com/) installed and running

## Installation

### 1. Install Ollama

Follow the installation instructions on the [Ollama website](https://ollama.com/download).

### 2. Install kubectl-ai

```bash
# For macOS with Homebrew
brew install kubectl-ai

# For Linux/WSL
curl -LO "https://github.com/GoogleCloudPlatform/kubectl-ai/releases/latest/download/kubectl-ai_$(uname -s)_$(uname -m)"
chmod +x kubectl-ai_$(uname -s)_$(uname -m)
sudo mv kubectl-ai_$(uname -s)_$(uname -m) /usr/local/bin/kubectl-ai
```

## Pull an LLM Model to Ollama

```bash
# Pull the model you want to use
ollama pull llama3:8b
# or for other models:
# ollama pull gemma3:4b
# ollama pull mistral-small3.1
```

## Configuration

You can configure kubectl-ai to use Ollama in two different ways:

### Method 1: Environment Variables

Add these lines to your `.bashrc`, `.zshrc`, or equivalent shell configuration file:

```bash
export OPENAI_ENDPOINT="http://localhost:11434/v1"
export OPENAI_DEPLOYMENT_NAME="llama3"  # or whatever model you want to use
export OPENAI_API_KEY="n/a"

# Optional: Create an alias for easier use
alias kai=kubectl-ai
```

Source your updated configuration:
```bash
source ~/.bashrc  # or ~/.zshrc
```

### Method 2: Command Line Arguments

Run kubectl-ai directly with command line arguments to specify the Ollama provider and model:

```bash
kubectl-ai --llm-provider ollama --model llama3:8b --enable-tool-use-shim
```

The `--enable-tool-use-shim` flag helps models properly use tool calling capabilities.

## Usage Examples

### Generate a Deployment Manifest

```bash
kubectl-ai write a deployment with nginx and a service that exposes port 80
```

### Interactive Mode

Start an interactive session with kubectl-ai:

```bash
kubectl-ai --llm-provider ollama --model llama3:8b shell
```

### Discover Available Models

List all available models in your Ollama installation:

```bash
kubectl-ai --llm-provider ollama models
```

## Recommended Models for kubectl-ai

For optimal results with kubectl-ai, these models work well:

- llama3:8b - Good balance of performance and resource usage
- gemma3:4b - Lightweight model that works well on machines with less RAM
- llama3:70b - High-performance model (requires more RAM)
- mistral-small3.1 - Another good option with excellent k8s knowledge

## System Requirements

Different models have different hardware requirements:

- 8GB RAM: Suitable for 4B models
- 16GB RAM: Recommended for 8B models
- 32GB+ RAM: Required for larger models (70B+)

## Troubleshooting

### Common Issues

1. **Connection refused errors**:
   - Ensure Ollama is running: `ollama serve`

2. **Out of memory errors**:
   - Use a smaller model or increase available RAM

3. **Model not found**:
   - Check model name: `ollama list`
   - Pull the model: `ollama pull MODEL_NAME`

4. **Slow responses**:
   - First inference is typically slower
   - Consider using the `--keep-alive` flag with Ollama

## Additional Resources

- [kubectl-ai GitHub Repository](https://github.com/GoogleCloudPlatform/kubectl-ai)
- [Ollama Documentation](https://github.com/ollama/ollama)
- [Ollama Model Library](https://ollama.com/library)