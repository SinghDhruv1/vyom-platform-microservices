// Vyom Platform API Gateway - Service Discovery & Routing
const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '10mb' }));

// Microservice URLs (configurable via environment variables)
const SERVICES = {
  AUTH: process.env.AUTH_SERVICE_URL || 'http://localhost:3001',
  WARDROBE: process.env.WARDROBE_SERVICE_URL || 'http://localhost:3002',
  OUTFIT: process.env.OUTFIT_SERVICE_URL || 'http://localhost:3003',
  PROFILE: process.env.PROFILE_SERVICE_URL || 'http://localhost:3004'
};

// Helper function to proxy requests to microservices
const proxyRequest = async (req, res, serviceUrl, path) => {
  try {
    const config = {
      method: req.method,
      url: `${serviceUrl}${path}`,
      headers: {
        'Content-Type': 'application/json',
        ...(req.headers.authorization && { 'Authorization': req.headers.authorization })
      },
      ...(req.body && Object.keys(req.body).length > 0 && { data: req.body }),
      ...(req.query && Object.keys(req.query).length > 0 && { params: req.query })
    };
    
    const response = await axios(config);
    res.status(response.status).json(response.data);
  } catch (error) {
    console.error(`Proxy error to ${serviceUrl}${path}:`, error.message);
    
    if (error.response) {
      res.status(error.response.status).json(error.response.data);
    } else if (error.code === 'ECONNREFUSED') {
      res.status(503).json({ 
        error: 'Service temporarily unavailable',
        service: serviceUrl,
        message: 'The requested service is not available at the moment'
      });
    } else {
      res.status(500).json({ 
        error: 'Gateway error',
        message: 'Failed to process request'
      });
    }
  }
};

// API Gateway Info
app.get('/', (req, res) => {
  res.json({
    service: '🚀 Vyom Platform - API Gateway',
    version: '2.0.0-microservices',
    architecture: 'Microservices',
    endpoints: {
      'Authentication': {
        'POST /auth/register': 'Register new user',
        'POST /auth/login': 'User login',
        'GET /auth/me': 'Get current user'
      },
      'Wardrobe Management': {
        'GET /wardrobe/items': 'Get all clothing items',
        'POST /wardrobe/items': 'Add new clothing item',
        'PUT /wardrobe/items/:id': 'Update clothing item',
        'DELETE /wardrobe/items/:id': 'Delete clothing item',
        'GET /wardrobe/analytics': 'Get wardrobe analytics'
      },
      'Outfit Generation': {
        'POST /outfits/generate': 'Generate AI outfit recommendations',
        'GET /outfits/suggestions': 'Get style suggestions'
      },
      'User Profile': {
        'GET /profile': 'Get user profile',
        'PUT /profile': 'Update user profile',
        'POST /profile/style-quiz': 'Complete style personality quiz',
        'GET /profile/recommendations': 'Get personalized recommendations'
      }
    },
    services: {
      authService: SERVICES.AUTH,
      wardrobeService: SERVICES.WARDROBE,
      outfitService: SERVICES.OUTFIT,
      profileService: SERVICES.PROFILE
    },
    reactNativeIntegration: {
      baseURL: req.protocol + '://' + req.get('host'),
      documentation: 'All endpoints support JWT authentication via Authorization header'
    }
  });
});

// Authentication Routes (Proxy to Auth Service)
app.post('/auth/register', (req, res) => {
  proxyRequest(req, res, SERVICES.AUTH, '/register');
});

app.post('/auth/login', (req, res) => {
  proxyRequest(req, res, SERVICES.AUTH, '/login');
});

app.get('/auth/me', (req, res) => {
  proxyRequest(req, res, SERVICES.AUTH, '/me');
});

// Wardrobe Routes (Proxy to Wardrobe Service)
app.get('/wardrobe/items', (req, res) => {
  proxyRequest(req, res, SERVICES.WARDROBE, '/items');
});

app.post('/wardrobe/items', (req, res) => {
  proxyRequest(req, res, SERVICES.WARDROBE, '/items');
});

app.put('/wardrobe/items/:id', (req, res) => {
  proxyRequest(req, res, SERVICES.WARDROBE, `/items/${req.params.id}`);
});

app.delete('/wardrobe/items/:id', (req, res) => {
  proxyRequest(req, res, SERVICES.WARDROBE, `/items/${req.params.id}`);
});

app.get('/wardrobe/analytics', (req, res) => {
  proxyRequest(req, res, SERVICES.WARDROBE, '/analytics');
});

// Outfit Routes (Proxy to Outfit Service)
app.post('/outfits/generate', (req, res) => {
  proxyRequest(req, res, SERVICES.OUTFIT, '/generate');
});

app.get('/outfits/suggestions', (req, res) => {
  proxyRequest(req, res, SERVICES.OUTFIT, '/suggestions');
});

// Profile Routes (Proxy to Profile Service)
app.get('/profile', (req, res) => {
  proxyRequest(req, res, SERVICES.PROFILE, '/profile');
});

app.put('/profile', (req, res) => {
  proxyRequest(req, res, SERVICES.PROFILE, '/profile');
});

app.post('/profile/style-quiz', (req, res) => {
  proxyRequest(req, res, SERVICES.PROFILE, '/style-quiz');
});

app.get('/profile/recommendations', (req, res) => {
  proxyRequest(req, res, SERVICES.PROFILE, '/recommendations/personal');
});

// Health check for all services
app.get('/health', async (req, res) => {
  const healthChecks = {};
  
  for (const [name, url] of Object.entries(SERVICES)) {
    try {
      const response = await axios.get(`${url}/health`, { timeout: 5000 });
      healthChecks[name.toLowerCase()] = {
        status: 'healthy',
        url,
        response: response.data
      };
    } catch (error) {
      healthChecks[name.toLowerCase()] = {
        status: 'unhealthy',
        url,
        error: error.message
      };
    }
  }
  
  const allHealthy = Object.values(healthChecks).every(service => service.status === 'healthy');
  
  res.status(allHealthy ? 200 : 503).json({
    gateway: {
      status: 'healthy',
      version: '2.0.0-microservices'
    },
    services: healthChecks,
    overall: allHealthy ? 'All services operational' : 'Some services are down'
  });
});

// Fallback route
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Route not found',
    availableEndpoints: {
      'GET /': 'API Gateway info',
      'POST /auth/login': 'User authentication',
      'GET /wardrobe/items': 'Get wardrobe',
      'POST /outfits/generate': 'Generate outfits',
      'GET /profile': 'User profile',
      'GET /health': 'Service health check'
    }
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Gateway error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: 'Something went wrong in the API Gateway'
  });
});

app.listen(PORT, () => {
  console.log(`🌐 API Gateway running on port ${PORT}`);
  console.log('📡 Connected services:');
  Object.entries(SERVICES).forEach(([name, url]) => {
    console.log(`   ${name}: ${url}`);
  });
});