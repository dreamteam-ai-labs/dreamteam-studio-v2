import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import apiRoutes from './routes/api.routes.js';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
// First try parent directory (dreamteam/.env), then local (studio-v2/.env)
dotenv.config({ path: join(__dirname, '../../.env') });
dotenv.config(); // Also load local .env to override if needed

// Create Express app
const app = express();
const PORT = process.env.PORT || 3002;

// Middleware
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// API Routes
app.use('/api', apiRoutes);

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(join(__dirname, '../client/dist')));
  
  // Catch all handler for client-side routing
  app.get('*', (req, res) => {
    res.sendFile(join(__dirname, '../client/dist/index.html'));
  });
}

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════════════╗
║       DreamTeam Studio V2 - Backend          ║
╠══════════════════════════════════════════════╣
║  🚀 Server running on port ${PORT}             ║
║  📊 Database: PostgreSQL (Neon)              ║
║  🔄 n8n Integration: ${process.env.N8N_WEBHOOK_URL ? 'Configured' : 'Not configured'}          ║
║  🌍 Environment: ${process.env.NODE_ENV || 'development'}                  ║
╚══════════════════════════════════════════════╝
  `);
});