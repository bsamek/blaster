// Content script entry point for ChatGPT
import { ChatGPTAdapter } from './chatgpt-adapter';
import { initializeAdapter } from '../adapter-initializer';

initializeAdapter(new ChatGPTAdapter());
