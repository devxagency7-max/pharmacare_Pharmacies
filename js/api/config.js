/**
 * config.js — Single source of truth for all API base URLs.
 *
 * Requests go through Vercel rewrites (/backend → backend server)
 * so the browser always calls HTTPS and avoids Mixed-Content blocks.
 *
 * If running locally (not on Vercel), change these to:
 *   const API_BASE   = 'http://204.168.149.185/api/v1';
 *   const FILES_BASE = 'http://204.168.149.185/api/files';
 */
const API_BASE   = '/backend';
const FILES_BASE = '/backend-files';
