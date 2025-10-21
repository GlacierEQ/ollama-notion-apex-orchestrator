#!/usr/bin/env node

const express = require('express');
const { Client } = require('@notionhq/client');
const axios = require('axios');
const WebSocket = require('ws');
require('dotenv').config();

const OllamaClient = require('./clients/ollama');
const NotionManager = require('./services/notion');
const MCPOrchestrator = require('./services/mcp');
const E2BExecutor = require('./services/e2b');
const A2ANetwork = require('./services/a2a');
const FunctionRouter = require('./services/function-router');

class OllamaNotionApexOrchestrator {
  constructor() {
    this.app = express();
    this.port = process.env.PORT || 3000;
    
    // Initialize core components
    this.ollama = new OllamaClient({
      baseURL: process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
      models: {
        general: process.env.OLLAMA_MODEL_GENERAL || 'llama3.1:8b',
        code: process.env.OLLAMA_MODEL_CODE || 'deepseek-coder:6.7b',
        reasoning: process.env.OLLAMA_MODEL_REASONING || 'deepseek-r1:67b',
        vision: process.env.OLLAMA_MODEL_VISION || 'llava:13b'
      }
    });
    
    this.notion = new NotionManager({
      apiKey: process.env.NOTION_API_KEY,
      databaseId: process.env.NOTION_DATABASE_ID
    });
    
    this.mcp = new MCPOrchestrator({
      port: process.env.MCP_SERVER_PORT || 3001,
      toolsEnabled: process.env.MCP_TOOLS_ENABLED === 'true'
    });
    
    this.e2b = new E2BExecutor({
      apiKey: process.env.E2B_API_KEY,
      template: process.env.E2B_SANDBOX_TEMPLATE || 'python'
    });
    
    this.a2a = new A2ANetwork({
      enabled: process.env.A2A_NETWORK_ENABLED === 'true',
      agentId: process.env.A2A_AGENT_ID || 'ollama-apex-agent',
      discoveryPort: process.env.A2A_DISCOVERY_PORT || 3002
    });
    
    this.functionRouter = new FunctionRouter({
      ollama: this.ollama,
      notion: this.notion,
      mcp: this.mcp,
      e2b: this.e2b,
      a2a: this.a2a
    });
    
    this.setupMiddleware();
    this.setupRoutes();
  }
  
  setupMiddleware() {
    this.app.use(express.json({ limit: '50mb' }));
    this.app.use(express.urlencoded({ extended: true }));
    
    // CORS for web clients
    this.app.use((req, res, next) => {
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
      if (req.method === 'OPTIONS') {
        res.sendStatus(200);
      } else {
        next();
      }
    });
  }
  
  setupRoutes() {
    // Health check
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        components: {
          ollama: this.ollama.isConnected(),
          notion: this.notion.isConnected(),
          mcp: this.mcp.isActive(),
          e2b: this.e2b.isAvailable(),
          a2a: this.a2a.isConnected()
        }
      });
    });
    
    // Main orchestration endpoint
    this.app.post('/orchestrate', async (req, res) => {
      try {
        const { prompt, context, tools, options } = req.body;
        
        console.log('🚀 Starting APEX orchestration:', prompt);
        
        const result = await this.functionRouter.route({
          prompt,
          context: context || {},
          tools: tools || ['all'],
          options: options || {}
        });
        
        // Save to Notion if enabled
        if (this.notion.isConnected()) {
          await this.notion.saveInteraction({
            prompt,
            result,
            timestamp: new Date().toISOString(),
            tools: result.toolsUsed
          });
        }
        
        res.json({
          success: true,
          result,
          metadata: {
            timestamp: new Date().toISOString(),
            processingTime: result.processingTime,
            toolsUsed: result.toolsUsed
          }
        });
        
      } catch (error) {
        console.error('Orchestration error:', error);
        res.status(500).json({
          success: false,
          error: error.message,
          timestamp: new Date().toISOString()
        });
      }
    });
    
    // Notion integration endpoints
    this.app.get('/notion/databases', async (req, res) => {
      try {
        const databases = await this.notion.listDatabases();
        res.json({ success: true, databases });
      } catch (error) {
        res.status(500).json({ success: false, error: error.message });
      }
    });
    
    this.app.post('/notion/page', async (req, res) => {
      try {
        const page = await this.notion.createPage(req.body);
        res.json({ success: true, page });
      } catch (error) {
        res.status(500).json({ success: false, error: error.message });
      }
    });
    
    // E2B execution endpoint
    this.app.post('/execute', async (req, res) => {
      try {
        const { code, language, context } = req.body;
        const result = await this.e2b.execute({ code, language, context });
        res.json({ success: true, result });
      } catch (error) {
        res.status(500).json({ success: false, error: error.message });
      }
    });
    
    // MCP tools endpoint
    this.app.get('/tools', async (req, res) => {
      try {
        const tools = await this.mcp.listTools();
        res.json({ success: true, tools });
      } catch (error) {
        res.status(500).json({ success: false, error: error.message });
      }
    });
    
    // Test endpoint for complete integration
    this.app.post('/test-all', async (req, res) => {
      try {
        const testResult = await this.runCompleteTest();
        res.json({ success: true, testResult });
      } catch (error) {
        res.status(500).json({ success: false, error: error.message });
      }
    });
  }
  
  async runCompleteTest() {
    console.log('🧪 Running complete integration test...');
    const results = {};
    
    // Test Ollama
    try {
      const ollamaTest = await this.ollama.generate({
        model: 'llama3.1:8b',
        prompt: 'Hello! This is a test of the Ollama integration.'
      });
      results.ollama = { success: true, response: ollamaTest };
    } catch (error) {
      results.ollama = { success: false, error: error.message };
    }
    
    // Test Notion
    try {
      const notionTest = await this.notion.createTestPage();
      results.notion = { success: true, pageId: notionTest.id };
    } catch (error) {
      results.notion = { success: false, error: error.message };
    }
    
    // Test E2B
    try {
      const e2bTest = await this.e2b.execute({
        code: 'print("Hello from E2B sandbox!")',
        language: 'python'
      });
      results.e2b = { success: true, output: e2bTest.output };
    } catch (error) {
      results.e2b = { success: false, error: error.message };
    }
    
    // Test MCP Tools
    try {
      const mcpTest = await this.mcp.listTools();
      results.mcp = { success: true, toolCount: mcpTest.length };
    } catch (error) {
      results.mcp = { success: false, error: error.message };
    }
    
    // Test A2A Network
    try {
      const a2aTest = await this.a2a.ping();
      results.a2a = { success: true, networkStatus: a2aTest };
    } catch (error) {
      results.a2a = { success: false, error: error.message };
    }
    
    return results;
  }
  
  async initialize() {
    console.log('🚀 Initializing APEX Orchestrator...');
    
    try {
      // Initialize all components
      await Promise.all([
        this.ollama.connect(),
        this.notion.initialize(),
        this.mcp.start(),
        this.e2b.initialize(),
        this.a2a.connect()
      ]);
      
      console.log('✅ All components initialized successfully');
      return true;
    } catch (error) {
      console.error('❌ Initialization failed:', error);
      return false;
    }
  }
  
  async start() {
    const initialized = await this.initialize();
    
    if (!initialized) {
      console.error('❌ Failed to initialize - exiting');
      process.exit(1);
    }
    
    this.app.listen(this.port, () => {
      console.log(`🚀 APEX Orchestrator running on http://localhost:${this.port}`);
      console.log('📊 Health check: GET /health');
      console.log('🎯 Main endpoint: POST /orchestrate');
      console.log('🧪 Test all: POST /test-all');
    });
    
    // Graceful shutdown
    process.on('SIGTERM', async () => {
      console.log('🛑 Shutting down gracefully...');
      await this.shutdown();
      process.exit(0);
    });
  }
  
  async shutdown() {
    await Promise.all([
      this.mcp.stop(),
      this.e2b.cleanup(),
      this.a2a.disconnect()
    ]);
    console.log('✅ Shutdown complete');
  }
}

// Start the orchestrator
if (require.main === module) {
  const orchestrator = new OllamaNotionApexOrchestrator();
  orchestrator.start().catch(console.error);
}

module.exports = OllamaNotionApexOrchestrator;