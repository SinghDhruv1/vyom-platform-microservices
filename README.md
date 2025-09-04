# 🚀 Vyom Platform Microservices

Complete microservices architecture for Vyom Platform - Wardrobe Management System

## 🌐 Live API Gateway

**Production URL:** `https://vyom-platform-api.onrender.com`

## 📁 Architecture

```
vyom-microservices/
├── api-gateway/           # Main API Gateway (Deploy this)
│   └── index.js          # Complete API with all services
├── auth-service/         # Authentication microservice  
├── wardrobe-service/     # Wardrobe management
├── user-profile-service/ # User profiles
└── package.json          # Dependencies
```

## 🚀 Quick Deploy to Render

1. **Connect this GitHub repo to Render.com**
2. **Build Command:** `npm install`
3. **Start Command:** `npm start`
4. **Auto-deploy:** Enabled

## 📱 React Native Integration

```javascript
const API_BASE_URL = 'https://vyom-platform-api.onrender.com';

// Authentication
const login = async (email, password) => {
  const response = await fetch(`${API_BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  return response.json();
};

// Wardrobe
const getWardrobe = async (token) => {
  const response = await fetch(`${API_BASE_URL}/wardrobe/items`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  return response.json();
};

// Outfits
const generateOutfit = async (token, preferences) => {
  const response = await fetch(`${API_BASE_URL}/outfits/generate`, {
    method: 'POST',
    headers: { 
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json' 
    },
    body: JSON.stringify(preferences)
  });
  return response.json();
};
```

## 🔥 API Endpoints

### Authentication
- `POST /auth/login` - User login
- `POST /auth/register` - Register new user  
- `GET /auth/me` - Get current user

### Wardrobe Management
- `GET /wardrobe/items` - Get all clothing items
- `POST /wardrobe/items` - Add new clothing item

### Outfit Planning
- `POST /outfits/generate` - AI outfit recommendations

### User Profile
- `GET /profile` - Get user profile
- `PUT /profile` - Update user profile

## 👥 Test Users

- **Email:** `93anil199@gmail.com` - **Password:** `any`
- **Email:** `admin@vyom.com` - **Password:** `any`

## 🔧 Features

✅ **Complete Authentication System**  
✅ **JWT Token Management**  
✅ **Wardrobe Item Management**  
✅ **AI Outfit Recommendations**  
✅ **User Profile Management**  
✅ **CORS Enabled for Mobile Apps**  
✅ **Production Ready**  
✅ **Global Accessibility**

## 🌟 Production Ready

This API Gateway is production-ready for:
- Multiple concurrent users
- Real-time React Native requests  
- Global beta user access
- Secure authentication flows