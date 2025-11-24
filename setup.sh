#!/bin/bash

echo "🐳 Docker Ollama Interview Setup - Bypassing GLIBC Issues"
echo "=========================================================="

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker not found. Please install Docker first:"
    echo "   https://docs.docker.com/engine/install/"
    exit 1
fi

# Check if Docker Compose is available
if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
    echo "❌ Docker Compose not found. Please install Docker Compose:"
    echo "   https://docs.docker.com/compose/install/"
    exit 1
fi

echo "✅ Docker and Docker Compose are available"

# Check if Docker daemon is running
if ! docker info &> /dev/null; then
    echo "❌ Docker daemon is not running. Please start Docker:"
    echo "   sudo systemctl start docker"
    echo "   # or start Docker Desktop if using Windows/Mac"
    exit 1
fi

echo "✅ Docker daemon is running"

# Install npm dependencies
echo ""
echo "📦 Installing Node.js dependencies..."
npm install

if [ $? -ne 0 ]; then
    echo "❌ Failed to install dependencies"
    exit 1
fi

echo "✅ Dependencies installed"

# Pull and start Ollama container
echo ""
echo "🚀 Starting Ollama container..."
docker-compose up -d

if [ $? -ne 0 ]; then
    echo "❌ Failed to start Ollama container"
    exit 1
fi

echo "✅ Ollama container started"

# Wait for Ollama to be healthy
echo ""
echo "⏳ Waiting for Ollama to be ready (may take 30-60 seconds)..."
timeout=120
counter=0

while [ $counter -lt $timeout ]; do
    if docker-compose exec -T ollama curl -s http://localhost:11434/api/tags > /dev/null 2>&1; then
        echo "✅ Ollama is ready!"
        break
    fi
    echo -n "."
    sleep 2
    counter=$((counter + 2))
done

if [ $counter -ge $timeout ]; then
    echo ""
    echo "❌ Ollama failed to start within $timeout seconds"
    echo "Check logs with: docker-compose logs ollama"
    exit 1
fi

# Download the model
echo ""
echo "🤖 Downloading llama2:7b model (this may take 10-15 minutes)..."
docker-compose exec ollama ollama pull llama2:7b

if [ $? -ne 0 ]; then
    echo "❌ Failed to download model"
    echo "You can try manually: npm run pull-model"
    exit 1
fi

echo "✅ Model downloaded successfully"

# Run basic test
echo ""
echo "🧪 Running connectivity test..."
npm run test-docker

if [ $? -eq 0 ]; then
    echo ""
    echo "🎉 Setup completed successfully!"
    echo ""
    echo "Available commands:"
    echo "  npm run test-docker     # Basic connectivity test"
    echo "  npm run test-interview  # Full interview simulation"
    echo "  npm run logs           # View Ollama logs"
    echo "  npm run status         # Check container status"
    echo "  npm run stop           # Stop containers"
    echo "  npm run start          # Start containers"
    echo ""
    echo "🎯 Your local AI is ready for the MERN interview app!"
else
    echo "⚠️  Setup completed but tests failed. Check the setup."
fi
