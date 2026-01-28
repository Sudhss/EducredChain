import OpenAI from "openai";
import { AppError, ServiceUnavailableError, toAppError } from '../utils/errors';

// Custom error class for AI service errors
export class AIError extends AppError {
  constructor(message: string, public readonly operation: string, details?: unknown) {
    super(
      `AI service error (${operation}): ${message}`,
      'AI_SERVICE_ERROR',
      500,
      details
    );
  }
}

// Initialize OpenAI client with proper error handling
const getOpenAIClient = () => {
  const apiKey = import.meta.env.VITE_OPENAI_API_KEY;
  
  if (!apiKey) {
    throw new AIError('OpenAI API key is not configured', 'initialization', {
      help: 'Please set VITE_OPENAI_API_KEY in your .env file'
    });
  }

  try {
    return new OpenAI({
      apiKey,
      timeout: 30000, // 30 seconds timeout
      maxRetries: 2,
    });
  } catch (error) {
    throw new AIError('Failed to initialize OpenAI client', 'initialization', error);
  }
};

const client = getOpenAIClient();

/**
 * Generate an AI-based summary of given credential content
 */
export const generateSummary = async (text: string): Promise<string> => {
  if (!text?.trim()) {
    throw new AIError('Input text is required', 'generateSummary');
  }

  try {
    const model = import.meta.env.VITE_OPENAI_MODEL || 'gpt-4';
    const response = await client.chat.completions.create({
      model,
      messages: [
        { 
          role: "system", 
          content: "You are a helpful assistant that summarizes educational credentials in a concise, professional tone. Focus on key achievements, skills, and qualifications." 
        },
        { 
          role: "user", 
          content: `Please summarize the following credential information:\n\n${text}`
        }
      ],
      max_tokens: 150,
      temperature: 0.3,
    });

    const result = response.choices[0]?.message?.content?.trim();
    if (!result) {
      throw new AIError('No content in AI response', 'generateSummary', { response });
    }

    return result;
  } catch (error) {
    const appError = toAppError(error, 'Failed to generate summary');
    
    if (appError.message.includes('rate limit')) {
      throw new AIError(
        'Rate limit exceeded. Please try again later.',
        'generateSummary',
        { originalError: appError }
      );
    }
    
    if (appError.message.includes('timeout') || appError.message.includes('ECONNRESET')) {
      throw new ServiceUnavailableError('OpenAI');
    }
    
    throw new AIError(appError.message, 'generateSummary', error);
  }
};
/**
 * Answer user questions based on credential content
 */
export const askQuestion = async (question: string, context: string): Promise<string> => {
  if (!question?.trim()) {
    throw new AIError('Question is required', 'askQuestion');
  }
  
  if (!context?.trim()) {
    throw new AIError('Context is required to answer the question', 'askQuestion');
  }

  try {
    const model = import.meta.env.VITE_OPENAI_MODEL || 'gpt-4';
    const response = await client.chat.completions.create({
      model,
      messages: [
        {
          role: "system",
          content: `You are an expert credential analyst. Answer questions strictly based on the provided credential content.\n` +
                  `If the information is not available in the provided context, respond with "The information is not available in the provided credential."\n` +
                  `Do not make up or assume any information not present in the context.`
        },
        {
          role: "user",
          content: `Credential Content:\n${context}\n\nQuestion: ${question}\n\nAnswer:`
        }
      ],
      max_tokens: 300,
      temperature: 0.1,
    });

    const answer = response.choices[0]?.message?.content?.trim() || 
                  "I couldn't generate an answer. Please try again or rephrase your question.";

    return answer;
  } catch (error) {
    const appError = toAppError(error, 'Failed to generate answer');
    
    if (appError.message.includes('rate limit')) {
      throw new AIError(
        'Rate limit exceeded. Please try again in a moment.',
        'askQuestion',
        { originalError: appError }
      );
    }
    
    if (appError.message.includes('context length')) {
      throw new AIError(
        'The provided context is too long. Please provide a shorter context or split it into smaller parts.',
        'askQuestion',
        { contextLength: context.length }
      );
    }
    
    if (appError.message.includes('timeout') || appError.message.includes('ECONNRESET')) {
      throw new ServiceUnavailableError('OpenAI');
    }
    
    throw new AIError(appError.message, 'askQuestion', error);
  }
};
