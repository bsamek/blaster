// Content script entry point for Claude
import { ClaudeAdapter } from './claude-adapter';
import { initializeAdapter } from '../adapter-initializer';

initializeAdapter(new ClaudeAdapter());
