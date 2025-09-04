// User Profile Service - User Preferences & Profile Management
const express = require('express');
const { MongoClient, ObjectId } = require('mongodb');
const cors = require('cors');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = process.env.PORT || 3004;

app.use(cors());
app.use(express.json());

// MongoDB Connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/vyom_profiles';
let db;

async function initDatabase() {
  try {
    const client = new MongoClient(MONGODB_URI);
    await client.connect();
    db = client.db();
    
    // Create indexes
    await db.collection('user_profiles').createIndex({ userId: 1 }, { unique: true });
    
    console.log('✅ Profile Service: MongoDB Connected');
  } catch (error) {
    console.error('❌ Profile Service: MongoDB Connection Failed:', error);
  }
}

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

// Profile Routes
app.get('/profile', authenticateToken, async (req, res) => {
  try {
    let profile = await db.collection('user_profiles').findOne({ userId: req.user.uuid });
    
    // Create default profile if doesn't exist
    if (!profile) {
      const defaultProfile = {
        userId: req.user.uuid,
        displayName: req.user.email.split('@')[0],
        bio: '',
        avatar: null,
        stylePersonality: [],
        favoriteColors: [],
        sizes: {
          top: '',
          bottom: '',
          shoes: '',
          dress: ''
        },
        preferences: {
          brands: [],
          budget: { min: 0, max: 1000 },
          sustainabilityFocus: false,
          minimalistWardrobe: false
        },
        location: {
          city: '',
          country: '',
          timezone: ''
        },
        settings: {
          notifications: true,
          publicProfile: false,
          shareOutfits: true
        },
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      await db.collection('user_profiles').insertOne(defaultProfile);
      profile = defaultProfile;
    }
    
    res.json({
      success: true,
      profile
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'Failed to retrieve profile' });
  }
});

app.put('/profile', authenticateToken, async (req, res) => {
  try {
    const updates = { ...req.body };
    delete updates._id;
    delete updates.userId;
    updates.updatedAt = new Date();
    
    const result = await db.collection('user_profiles').updateOne(
      { userId: req.user.uuid },
      { 
        $set: updates,
        $setOnInsert: { 
          userId: req.user.uuid,
          createdAt: new Date()
        }
      },
      { upsert: true }
    );
    
    const updatedProfile = await db.collection('user_profiles').findOne({
      userId: req.user.uuid
    });
    
    res.json({
      success: true,
      profile: updatedProfile
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

app.post('/style-quiz', authenticateToken, async (req, res) => {
  try {
    const { answers } = req.body;
    
    // Analyze style personality based on quiz answers
    const stylePersonality = [];
    
    if (answers.lifestyle === 'active') stylePersonality.push('athletic');
    if (answers.lifestyle === 'professional') stylePersonality.push('business-casual');
    if (answers.lifestyle === 'creative') stylePersonality.push('artistic');
    
    if (answers.colors === 'bold') stylePersonality.push('bold');
    if (answers.colors === 'neutral') stylePersonality.push('minimalist');
    if (answers.colors === 'pastels') stylePersonality.push('feminine');
    
    if (answers.fit === 'loose') stylePersonality.push('comfortable');
    if (answers.fit === 'fitted') stylePersonality.push('tailored');
    if (answers.fit === 'oversized') stylePersonality.push('trendy');
    
    // Update user profile with results
    await db.collection('user_profiles').updateOne(
      { userId: req.user.uuid },
      { 
        $set: { 
          stylePersonality,
          quizCompleted: true,
          updatedAt: new Date()
        }
      },
      { upsert: true }
    );
    
    res.json({
      success: true,
      stylePersonality,
      recommendations: {
        categories: ['top', 'bottom', 'outerwear'],
        colors: answers.colors === 'bold' ? ['red', 'blue', 'green'] : ['black', 'white', 'gray'],
        brands: stylePersonality.includes('business-casual') ? ['Hugo Boss', 'Calvin Klein'] : ['Zara', 'H&M']
      }
    });
  } catch (error) {
    console.error('Style quiz error:', error);
    res.status(500).json({ error: 'Failed to process style quiz' });
  }
});

app.get('/recommendations/personal', authenticateToken, async (req, res) => {
  try {
    const profile = await db.collection('user_profiles').findOne({ userId: req.user.uuid });
    
    if (!profile) {
      return res.json({
        success: true,
        recommendations: {
          message: 'Complete your profile to get personalized recommendations!',
          suggestions: ['Take the style quiz', 'Add your favorite colors', 'Set your size preferences']
        }
      });
    }
    
    // Generate personalized recommendations based on profile
    const recommendations = {
      colors: profile.favoriteColors.length > 0 ? profile.favoriteColors : ['navy', 'white', 'black'],
      styles: profile.stylePersonality.length > 0 ? profile.stylePersonality : ['casual'],
      categories: ['top', 'bottom', 'outerwear'],
      tips: []
    };
    
    if (profile.stylePersonality.includes('minimalist')) {
      recommendations.tips.push('Focus on versatile, neutral pieces that mix and match easily');
    }
    if (profile.stylePersonality.includes('bold')) {
      recommendations.tips.push('Don\'t be afraid to add statement pieces and vibrant colors');
    }
    if (profile.stylePersonality.includes('professional')) {
      recommendations.tips.push('Invest in quality blazers and tailored pieces for work');
    }
    
    res.json({
      success: true,
      recommendations
    });
  } catch (error) {
    console.error('Personal recommendations error:', error);
    res.status(500).json({ error: 'Failed to get personal recommendations' });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    service: 'user-profile-service', 
    status: 'healthy',
    database: db ? 'connected' : 'disconnected'
  });
});

// Initialize and start server
initDatabase().then(() => {
  app.listen(PORT, () => {
    console.log(`👤 User Profile Service running on port ${PORT}`);
  });
});