import dotenv from 'dotenv';
import { LLMService } from './src/services/LLMService.js';
import { SessionConfig } from './src/types/InterviewTypes.js';

// Load environment variables
dotenv.config();

async function testUnifiedService() {
  console.log('🚀 Testing Unified LLM Service...\n');
  console.log('Environment Settings:');
  console.log(`  USE_BEDROCK: ${process.env.USE_BEDROCK}`);
  console.log(`  AWS_REGION: ${process.env.AWS_REGION}`);
  console.log(`  BEDROCK_MODEL_ID: ${process.env.BEDROCK_MODEL_ID}`);
  console.log(`  AWS_PROFILE: ${process.env.AWS_PROFILE}\n`);

  try {
    // Initialize LLM service
    console.log('📡 Initializing LLM Service...\n');
    const llmService = new LLMService();
    
    // Wait a moment for initialization to complete
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Check which service is active
    const activeService = await llmService.getActiveServiceName();
    console.log(`\n✅ Active Service: ${activeService}\n`);

    if (activeService === 'None') {
      console.error('❌ No LLM service initialized!');
      return;
    }

    // Test connection
    console.log('📡 Testing connection...');
    const isConnected = await llmService.testConnection();
    
    if (!isConnected) {
      console.log('❌ Connection failed!\n');
      return;
    }
    
    console.log('✅ Connection successful!\n');

    // Test 1: Generate Interview Plan
    console.log('📋 Test 1: Generating interview plan...');
    const config: SessionConfig = {
      role: 'Software Engineer',
      seniority: 'Senior',
      company: 'Tech Corp',
      interviewTypes: ['behavioral', 'technical', 'system_design'],
      durationMinutes: 45,
      questionFamiliarity: 'mixed',
      interviewMode: 'mock'
    };

    const plan = await llmService.generateInterviewPlan(config);
    console.log('✅ Generated plan:');
    console.log(`   Role: ${plan.role}`);
    console.log(`   Seniority: ${plan.seniority}`);
    console.log(`   Evaluation Categories: ${plan.evaluationCategories.length}`);
    plan.evaluationCategories.forEach(cat => {
      console.log(`     - ${cat.name} (weight: ${cat.weight})`);
    });
    console.log(`   Interview Phases: ${plan.interviewPhases.length}`);
    console.log(`   Scoring Rubric Levels: ${plan.scoringRubric.length}`);
    console.log('');

    // Test 2: Generate Initial Question
    console.log('📝 Test 2: Generating initial question...');
    const question = await llmService.generateInitialQuestion(config, 'John');
    console.log('✅ Generated question:');
    console.log('---');
    console.log(question.substring(0, 300) + '...');
    console.log('---\n');

    console.log('🎉 All tests completed successfully!');
    console.log(`\n✨ Using ${activeService} for LLM operations!`);

  } catch (error: any) {
    console.error('❌ Error during testing:', error);
    if (error.message) {
      console.error('   Message:', error.message);
    }
    process.exit(1);
  }
}

// Run the test
testUnifiedService();
