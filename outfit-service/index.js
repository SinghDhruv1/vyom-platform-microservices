// Outfit Service - AI Recommendation Engine
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3003;

app.use(cors());
app.use(express.json());

// Service URLs (can be configured via environment variables)
const WARDROBE_SERVICE_URL = process.env.WARDROBE_SERVICE_URL || 'http://localhost:3002';

// Auth middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'vyom_auth_secret');
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(403).json({ error: 'Invalid or expired token' });
  }
};

// Outfit Generation Algorithm
const generateOutfitRecommendation = (clothingItems, preferences = {}) => {
  const { occasion = 'casual', season = 'all-year', style = 'comfortable' } = preferences;
  
  // Filter items based on preferences
  const availableItems = clothingItems.filter(item => {
    const matchesOccasion = !occasion || item.occasions?.includes(occasion);
    const matchesSeason = !season || season === 'all-year' || item.seasons?.includes(season);
    return matchesOccasion && matchesSeason;
  });
  
  // Categorize items
  const categories = {
    top: availableItems.filter(item => ['top', 'shirt', 'blouse', 't-shirt'].includes(item.category)),
    bottom: availableItems.filter(item => ['bottom', 'pants', 'jeans', 'skirt', 'shorts'].includes(item.category)),
    outerwear: availableItems.filter(item => ['outerwear', 'jacket', 'coat', 'blazer'].includes(item.category)),
    footwear: availableItems.filter(item => ['footwear', 'shoes', 'boots', 'sneakers'].includes(item.category)),
    accessories: availableItems.filter(item => ['accessory', 'belt', 'bag', 'jewelry'].includes(item.category))
  };
  
  // Generate multiple outfit combinations
  const outfits = [];
  
  for (let i = 0; i < 3; i++) {
    const outfit = {
      id: `outfit_${Date.now()}_${i}`,
      occasion,
      season,
      style,
      items: [],
      confidence: 0.85 + (Math.random() * 0.1), // Random confidence 85-95%
      description: ''
    };
    
    // Select items for outfit
    if (categories.top.length > 0) {
      const randomTop = categories.top[Math.floor(Math.random() * categories.top.length)];
      outfit.items.push(randomTop);
    }
    
    if (categories.bottom.length > 0) {
      const randomBottom = categories.bottom[Math.floor(Math.random() * categories.bottom.length)];
      outfit.items.push(randomBottom);
    }
    
    if (categories.outerwear.length > 0 && Math.random() > 0.5) {
      const randomOuterwear = categories.outerwear[Math.floor(Math.random() * categories.outerwear.length)];
      outfit.items.push(randomOuterwear);
    }
    
    if (categories.footwear.length > 0) {
      const randomFootwear = categories.footwear[Math.floor(Math.random() * categories.footwear.length)];
      outfit.items.push(randomFootwear);
    }
    
    if (categories.accessories.length > 0 && Math.random() > 0.3) {
      const randomAccessory = categories.accessories[Math.floor(Math.random() * categories.accessories.length)];
      outfit.items.push(randomAccessory);
    }
    
    // Generate description
    const itemNames = outfit.items.map(item => item.name).join(', ');
    outfit.description = `Perfect ${occasion} outfit for ${season}: ${itemNames}`;
    
    if (outfit.items.length >= 2) { // At least top + bottom
      outfits.push(outfit);
    }
  }
  
  return outfits.filter(outfit => outfit.items.length > 0);
};

// Outfit Routes
app.post('/generate', authenticateToken, async (req, res) => {
  try {
    const { preferences = {} } = req.body;
    
    // Get user's wardrobe from wardrobe service
    const wardrobeResponse = await axios.get(`${WARDROBE_SERVICE_URL}/items`, {
      headers: {
        'Authorization': req.headers.authorization
      }
    });
    
    if (!wardrobeResponse.data.success) {
      return res.status(400).json({ error: 'Failed to fetch wardrobe items' });
    }
    
    const clothingItems = wardrobeResponse.data.items;
    
    if (clothingItems.length === 0) {
      return res.json({
        success: true,
        outfits: [],
        message: 'No clothing items found. Add some items to your wardrobe first!'
      });
    }
    
    // Generate outfit recommendations
    const outfits = generateOutfitRecommendation(clothingItems, preferences);
    
    res.json({
      success: true,
      count: outfits.length,
      outfits,
      preferences,
      wardrobeItemsCount: clothingItems.length
    });
    
  } catch (error) {
    console.error('Outfit generation error:', error);
    
    // If wardrobe service is not available, provide fallback
    if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
      return res.status(503).json({ 
        error: 'Wardrobe service temporarily unavailable',
        fallback: true
      });
    }
    
    res.status(500).json({ error: 'Failed to generate outfit recommendations' });
  }
});

app.get('/suggestions', authenticateToken, async (req, res) => {
  try {
    const { weather, event } = req.query;
    
    // Weather-based suggestions
    const suggestions = {
      sunny: ['light colors', 'breathable fabrics', 'sun hat', 'sandals'],
      rainy: ['waterproof jacket', 'boots', 'umbrella', 'quick-dry clothes'],
      cold: ['layers', 'warm coat', 'boots', 'scarf'],
      hot: ['lightweight fabrics', 'shorts', 't-shirt', 'sunglasses']
    };
    
    // Event-based suggestions
    const eventSuggestions = {
      meeting: ['business casual', 'blazer', 'dress shoes', 'minimal accessories'],
      date: ['smart casual', 'nice top', 'good shoes', 'subtle jewelry'],
      workout: ['activewear', 'sneakers', 'moisture-wicking fabric'],
      party: ['dressy outfit', 'statement piece', 'dress shoes', 'accessories']
    };
    
    res.json({
      success: true,
      suggestions: {
        weather: weather ? suggestions[weather] || [] : [],
        event: event ? eventSuggestions[event] || [] : [],
        general: ['Match colors well', 'Consider the occasion', 'Comfort is key', 'Express your personality']
      }
    });
  } catch (error) {
    console.error('Suggestions error:', error);
    res.status(500).json({ error: 'Failed to get suggestions' });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    service: 'outfit-service', 
    status: 'healthy',
    dependencies: {
      wardrobeService: WARDROBE_SERVICE_URL
    }
  });
});

app.listen(PORT, () => {
  console.log(`👔 Outfit Service running on port ${PORT}`);
});