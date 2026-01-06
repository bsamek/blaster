// Content script entry point for Gemini
import { GeminiAdapter } from './gemini-adapter';
import { initializeAdapter } from '../adapter-initializer';

initializeAdapter(new GeminiAdapter());
