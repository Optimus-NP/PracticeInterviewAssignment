import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import InterviewController from './controllers/InterviewController.js';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Initialize controllers
const interviewController = new InterviewController();

// Security middleware
app.use(helmet());

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.API_RATE_LIMIT_WINDOW_MS || '900000'), // 15 minutes
  max: parseInt(process.env.API_RATE_LIMIT_MAX_REQUESTS || '100'), // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});
app.use(limiter);

// CORS configuration
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? process.env.FRONTEND_URL 
    : ['http://localhost:3000', 'http://localhost:5173'],
  credentials: true
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health check endpoint
app.get('/health', interviewController.healthCheck);

// API Routes
app.get('/api/role-config', interviewController.getRoleConfig);
app.post('/api/sessions', interviewController.createSession);
app.post('/api/sessions/message', interviewController.sendMessage);
app.get('/api/sessions/:sessionId', interviewController.getSession);
app.get('/api/sessions/:sessionId/evaluation', interviewController.getEvaluation);

// Error handling middleware
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

// 404 handler
app.use('*', (req: express.Request, res: express.Response) => {
  res.status(404).json({
    error: 'Route not found',
    path: req.originalUrl
  });
});

// Database connection
async function connectToDatabase(): Promise<void> {
  try {
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
      throw new Error('MONGODB_URI environment variable is not set');
    }

    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB successfully');
  } catch (error) {
    console.error('Failed to connect to MongoDB:', error);
    process.exit(1);
  }
}

// Start server
async function startServer(): Promise<void> {
  try {
    // Connect to database
    await connectToDatabase();

    // Start HTTP server
    app.listen(PORT, async () => {
      console.log(`Interview Practice Partner API running on port ${PORT}`);
      console.log(`Health check: http://localhost:${PORT}/health`);
      console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
      
      // Show which LLM service is configured
      if (process.env.USE_BEDROCK === 'true') {
        console.log(`LLM Service: AWS Bedrock (Primary)`);
        console.log(`  Region: ${process.env.AWS_REGION || 'us-west-2'}`);
        console.log(`  Model: ${process.env.BEDROCK_MODEL_ID || 'anthropic.claude-3-5-sonnet-20241022-v2:0'}`);
        console.log(`  Profile: ${process.env.AWS_PROFILE || 'default'}`);
        console.log(`  Fallback: Ollama (if Bedrock fails)`);
      } else {
        console.log(`LLM Service: Ollama`);
        console.log(`  URL: ${process.env.OLLAMA_BASE_URL || 'http://localhost:11434'}`);
        console.log(`  Model: ${process.env.OLLAMA_MODEL || 'llama2:7b'}`);
      }
    });

  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully');
  await mongoose.connection.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully');
  await mongoose.connection.close();
  process.exit(0);
});

// Start the application
startServer().catch(console.error);

export default app;
