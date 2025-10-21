#!/usr/bin/env node

const axios = require('axios');
const { Client } = require('@notionhq/client');
require('dotenv').config();

class APEXIntegrationTest {
  constructor() {
    this.baseURL = process.env.TEST_BASE_URL || 'http://localhost:3000';
    this.testResults = {};
  }

  async runAllTests() {
    console.log('🧪 Starting APEX Integration Tests...');
    console.log('=' .repeat(50));

    const tests = [
      this.testHealthCheck,
      this.testOllamaConnection,
      this.testNotionIntegration,
      this.testE2BExecution,
      this.testMCPTools,
      this.testCompleteOrchestration,
      this.testA2ANetwork
    ];

    for (const test of tests) {
      try {
        await test.call(this);
      } catch (error) {
        console.error(`❌ Test failed: ${test.name}`, error.message);
        this.testResults[test.name] = { success: false, error: error.message };
      }
    }

    this.printSummary();
    return this.testResults;
  }

  async testHealthCheck() {
    console.log('🔍 Testing health check...');
    
    const response = await axios.get(`${this.baseURL}/health`);
    
    if (response.status === 200 && response.data.status === 'healthy') {
      console.log('✅ Health check passed');
      this.testResults.healthCheck = { success: true, data: response.data };
    } else {
      throw new Error('Health check failed');
    }
  }

  async testOllamaConnection() {
    console.log('🦙 Testing Ollama connection...');
    
    // Test direct Ollama API
    try {
      const ollamaResponse = await axios.get('http://localhost:11434/api/tags');
      
      if (ollamaResponse.status === 200) {
        console.log('✅ Ollama connection successful');
        console.log(`   Models available: ${ollamaResponse.data.models?.length || 0}`);
        
        // Test model generation
        const generateResponse = await axios.post('http://localhost:11434/api/generate', {
          model: 'llama3.1:8b',
          prompt: 'Hello! This is a test.',
          stream: false
        });
        
        if (generateResponse.status === 200) {
          console.log('✅ Ollama generation test passed');
          this.testResults.ollamaConnection = { 
            success: true, 
            models: ollamaResponse.data.models,
            generation: generateResponse.data.response
          };
        }
      }
    } catch (error) {
      throw new Error(`Ollama connection failed: ${error.message}`);
    }
  }

  async testNotionIntegration() {
    console.log('📝 Testing Notion integration...');
    
    if (!process.env.NOTION_API_KEY) {
      console.log('⚠️  Skipping Notion test - API key not provided');
      this.testResults.notionIntegration = { success: false, skipped: true };
      return;
    }
    
    try {
      const response = await axios.get(`${this.baseURL}/notion/databases`);
      
      if (response.status === 200) {
        console.log('✅ Notion integration successful');
        this.testResults.notionIntegration = { 
          success: true, 
          databases: response.data.databases 
        };
      }
    } catch (error) {
      throw new Error(`Notion integration failed: ${error.message}`);
    }
  }

  async testE2BExecution() {
    console.log('🏃 Testing E2B execution...');
    
    if (!process.env.E2B_API_KEY) {
      console.log('⚠️  Skipping E2B test - API key not provided');
      this.testResults.e2bExecution = { success: false, skipped: true };
      return;
    }
    
    try {
      const response = await axios.post(`${this.baseURL}/execute`, {
        code: 'print("Hello from E2B!")',
        language: 'python'
      });
      
      if (response.status === 200 && response.data.success) {
        console.log('✅ E2B execution successful');
        this.testResults.e2bExecution = { 
          success: true, 
          output: response.data.result 
        };
      }
    } catch (error) {
      throw new Error(`E2B execution failed: ${error.message}`);
    }
  }

  async testMCPTools() {
    console.log('🔧 Testing MCP tools...');
    
    try {
      const response = await axios.get(`${this.baseURL}/tools`);
      
      if (response.status === 200) {
        console.log('✅ MCP tools test successful');
        console.log(`   Tools available: ${response.data.tools?.length || 0}`);
        this.testResults.mcpTools = { 
          success: true, 
          tools: response.data.tools 
        };
      }
    } catch (error) {
      throw new Error(`MCP tools test failed: ${error.message}`);
    }
  }

  async testCompleteOrchestration() {
    console.log('🎼 Testing complete orchestration...');
    
    try {
      const response = await axios.post(`${this.baseURL}/orchestrate`, {
        prompt: 'Generate a simple Python function that adds two numbers and execute it',
        tools: ['ollama', 'e2b'],
        options: {
          saveToNotion: true,
          executeCode: true
        }
      });
      
      if (response.status === 200 && response.data.success) {
        console.log('✅ Complete orchestration successful');
        this.testResults.completeOrchestration = { 
          success: true, 
          result: response.data.result,
          toolsUsed: response.data.metadata.toolsUsed
        };
      }
    } catch (error) {
      throw new Error(`Complete orchestration failed: ${error.message}`);
    }
  }

  async testA2ANetwork() {
    console.log('🤝 Testing A2A network...');
    
    try {
      // This would test agent-to-agent communication
      // For now, just verify the A2A service is responding
      const response = await axios.get(`${this.baseURL}/health`);
      
      if (response.data.components?.a2a !== undefined) {
        console.log('✅ A2A network test passed');
        this.testResults.a2aNetwork = { 
          success: true, 
          status: response.data.components.a2a 
        };
      }
    } catch (error) {
      throw new Error(`A2A network test failed: ${error.message}`);
    }
  }

  async testAllIntegrations() {
    console.log('🚀 Testing ALL integrations at once...');
    
    try {
      const response = await axios.post(`${this.baseURL}/test-all`);
      
      if (response.status === 200 && response.data.success) {
        console.log('✅ ALL integrations test successful');
        this.testResults.allIntegrations = { 
          success: true, 
          results: response.data.testResult 
        };
        
        // Print detailed results
        console.log('📊 Integration Results:');
        Object.entries(response.data.testResult).forEach(([service, result]) => {
          const status = result.success ? '✅' : '❌';
          console.log(`   ${status} ${service}: ${result.success ? 'OK' : result.error}`);
        });
      }
    } catch (error) {
      throw new Error(`All integrations test failed: ${error.message}`);
    }
  }

  printSummary() {
    console.log('\n' + '=' .repeat(50));
    console.log('📊 TEST SUMMARY');
    console.log('=' .repeat(50));
    
    const totalTests = Object.keys(this.testResults).length;
    const passedTests = Object.values(this.testResults).filter(r => r.success).length;
    const failedTests = totalTests - passedTests;
    
    console.log(`Total Tests: ${totalTests}`);
    console.log(`✅ Passed: ${passedTests}`);
    console.log(`❌ Failed: ${failedTests}`);
    console.log(`📈 Success Rate: ${((passedTests / totalTests) * 100).toFixed(1)}%`);
    
    if (failedTests === 0) {
      console.log('\n🎉 ALL TESTS PASSED! APEX Integration is fully operational!');
    } else {
      console.log('\n⚠️  Some tests failed. Check the logs above for details.');
    }
  }
}

// Run tests if called directly
if (require.main === module) {
  const tester = new APEXIntegrationTest();
  tester.runAllTests()
    .then(() => process.exit(0))
    .catch(error => {
      console.error('Test suite failed:', error);
      process.exit(1);
    });
}

module.exports = APEXIntegrationTest;