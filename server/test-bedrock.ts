import dotenv from 'dotenv';
import { BedrockService } from './src/services/BedrockService.js';
import { SessionConfig } from './src/types/InterviewTypes.js';

// Load environment variables
dotenv.config();

async function testBedrockService() {
  console.log('🚀 Testing AWS Bedrock Service...\n');

  try {
    // Initialize Bedrock service
    const bedrockService = new BedrockService();
    console.log('✅ BedrockService initialized');
    console.log(`   Region: ${process.env.AWS_REGION}`);
    console.log(`   Model: ${process.env.BEDROCK_MODEL_ID}`);
    console.log(`   Profile: ${process.env.AWS_PROFILE}\n`);

    // Test 1: Connection test
    console.log('📡 Test 1: Testing connection to AWS Bedrock...');
    const isConnected = await bedrockService.testConnection();
    
    if (isConnected) {
      console.log('✅ Connection successful!\n');
    } else {
      console.log('❌ Connection failed!\n');
      return;
    }

    // Test 2: Generate initial interview question
    console.log('📝 Test 2: Generating initial interview question...');
    const config: SessionConfig = {
      role: 'Software Engineer',
      seniority: 'Senior',
      company: 'Tech Corp',
      interviewTypes: ['behavioral', 'technical'],
      durationMinutes: 30,
      questionFamiliarity: 'mixed',
      interviewMode: 'mock'
    };

    const initialQuestion = await bedrockService.generateInitialQuestion(config, 'John');
    console.log('✅ Generated question:');
    console.log('---');
    console.log(initialQuestion);
    console.log('---\n');

    // Test 3: Test response appropriateness check
    console.log('🔍 Test 3: Testing response appropriateness analyzer...');
    const testResponse = 'I have 5 years of experience working with React and TypeScript. I led a team of 3 developers to build a scalable web application that serves 100k users daily.';
    const analysis = await bedrockService.analyzeResponseApproppriateness(
      testResponse,
      'Tell me about your experience with React.'
    );
    console.log('✅ Analysis result:');
    console.log(JSON.stringify(analysis, null, 2));
    console.log('');

    console.log('🎉 All tests completed successfully!');
    console.log('\n✨ Bedrock LLM Service is working correctly!');

  } catch (error: any) {
    console.error('❌ Error during testing:', error);
    if (error.message) {
      console.error('   Message:', error.message);
    }
    if (error.$metadata) {
      console.error('   AWS Error:', JSON.stringify(error.$metadata, null, 2));
    }
    process.exit(1);
  }
}

// Run the test
testBedrockService();
