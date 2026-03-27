const cors = require('cors');

const defaultOrigins = [
  'http://127.0.0.1:5500',
  'http://localhost:5500',
  'https://127.0.0.1:5500',
  'https://localhost:5500',
  'http://127.0.0.1:3000',
  'http://localhost:3000',
  'https://127.0.0.1:3000',
  'https://localhost:3000'
];

const envOrigins = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map(origin => origin.trim())
  .filter(Boolean);

const allowedOrigins = Array.from(new Set([...defaultOrigins, ...envOrigins]));

const corsOptions = {
  origin(origin, callback){
    if(!origin || allowedOrigins.length === 0 || allowedOrigins.includes(origin)){
      return callback(null, true);
    }
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  optionsSuccessStatus: 204
};

module.exports = {
  corsOptions,
  corsMiddleware: cors(corsOptions)
};
