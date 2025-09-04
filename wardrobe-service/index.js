// Wardrobe Service - MongoDB Database Connection
const express = require('express');
const { MongoClient, ObjectId } = require('mongodb');
const cors = require('cors');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = process.env.PORT || 3002;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// MongoDB Connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/vyom_wardrobe';
let db;

async function initDatabase() {
  try {
    const client = new MongoClient(MONGODB_URI);
    await client.connect();
    db = client.db();
    
    // Create indexes
    await db.collection('clothing_items').createIndex({ userId: 1 });
    await db.collection('clothing_items').createIndex({ category: 1 });
    
    console.log('✅ Wardrobe Service: MongoDB Connected');
  } catch (error) {
    console.error('❌ Wardrobe Service: MongoDB Connection Failed:', error);
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

// Wardrobe Routes
app.get('/items', authenticateToken, async (req, res) => {
  try {
    const { category, color, season } = req.query;
    
    let filter = { userId: req.user.uuid };
    
    if (category) filter.category = category;
    if (color) filter.colors = { $in: [color] };
    if (season) filter.seasons = { $in: [season] };
    
    const items = await db.collection('clothing_items')
      .find(filter)
      .sort({ createdAt: -1 })
      .toArray();
    
    res.json({
      success: true,
      count: items.length,
      items
    });
  } catch (error) {
    console.error('Get items error:', error);
    res.status(500).json({ error: 'Failed to retrieve items' });
  }
});

app.post('/items', authenticateToken, async (req, res) => {
  try {
    const {
      name,
      category,
      colors,
      seasons,
      occasions,
      brand,
      size,
      purchasePrice,
      imageUri
    } = req.body;
    
    const clothingItem = {
      userId: req.user.uuid,
      name,
      category,
      colors: Array.isArray(colors) ? colors : [colors],
      seasons: Array.isArray(seasons) ? seasons : [seasons],
      occasions: Array.isArray(occasions) ? occasions : [occasions],
      brand,
      size,
      purchasePrice: purchasePrice ? parseFloat(purchasePrice) : 0,
      imageUri,
      wearCount: 0,
      favorite: false,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    const result = await db.collection('clothing_items').insertOne(clothingItem);
    
    res.json({
      success: true,
      item: {
        id: result.insertedId,
        ...clothingItem
      }
    });
  } catch (error) {
    console.error('Add item error:', error);
    res.status(500).json({ error: 'Failed to add item' });
  }
});

app.put('/items/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const updates = { ...req.body };
    delete updates._id;
    updates.updatedAt = new Date();
    
    const result = await db.collection('clothing_items').updateOne(
      { _id: new ObjectId(id), userId: req.user.uuid },
      { $set: updates }
    );
    
    if (result.matchedCount === 0) {
      return res.status(404).json({ error: 'Item not found' });
    }
    
    const updatedItem = await db.collection('clothing_items').findOne({
      _id: new ObjectId(id)
    });
    
    res.json({
      success: true,
      item: updatedItem
    });
  } catch (error) {
    console.error('Update item error:', error);
    res.status(500).json({ error: 'Failed to update item' });
  }
});

app.delete('/items/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await db.collection('clothing_items').deleteOne({
      _id: new ObjectId(id),
      userId: req.user.uuid
    });
    
    if (result.deletedCount === 0) {
      return res.status(404).json({ error: 'Item not found' });
    }
    
    res.json({
      success: true,
      message: 'Item deleted successfully'
    });
  } catch (error) {
    console.error('Delete item error:', error);
    res.status(500).json({ error: 'Failed to delete item' });
  }
});

app.get('/analytics', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.uuid;
    
    const totalItems = await db.collection('clothing_items').countDocuments({ userId });
    
    const categoryStats = await db.collection('clothing_items').aggregate([
      { $match: { userId } },
      { $group: { _id: '$category', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]).toArray();
    
    const colorStats = await db.collection('clothing_items').aggregate([
      { $match: { userId } },
      { $unwind: '$colors' },
      { $group: { _id: '$colors', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]).toArray();
    
    const totalValue = await db.collection('clothing_items').aggregate([
      { $match: { userId } },
      { $group: { _id: null, total: { $sum: '$purchasePrice' } } }
    ]).toArray();
    
    res.json({
      success: true,
      analytics: {
        totalItems,
        totalValue: totalValue[0]?.total || 0,
        categories: categoryStats.map(c => ({ category: c._id, count: c.count })),
        colors: colorStats.map(c => ({ color: c._id, count: c.count }))
      }
    });
  } catch (error) {
    console.error('Analytics error:', error);
    res.status(500).json({ error: 'Failed to get analytics' });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    service: 'wardrobe-service', 
    status: 'healthy',
    database: db ? 'connected' : 'disconnected'
  });
});

// Initialize and start server
initDatabase().then(() => {
  app.listen(PORT, () => {
    console.log(`👗 Wardrobe Service running on port ${PORT}`);
  });
});