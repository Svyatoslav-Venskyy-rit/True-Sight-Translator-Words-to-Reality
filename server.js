const { MongoClient } = require('mongodb');
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
const port = 5000; 

app.use(cors());
app.use(bodyParser.json());

const dbURI = 'mongodb+srv://ssv5593:6KEqrm3CDKSr2UyG@information.fx6tk.mongodb.net/?retryWrites=true&w=majority&appName=information';

// MongoDB connection function
async function connectToMongo() {
  try {
    console.log('🔄 Connecting to MongoDB...');
    const client = new MongoClient(dbURI, { useNewUrlParser: true, useUnifiedTopology: true });
    await client.connect();
    console.log('✅ Successfully connected to MongoDB');
    return client;
  } catch (err) {
    console.error('❌ MongoDB Connection Error:', err.message);
    return null; // Prevents further errors if the connection fails
  }
}

// Insert translation data into MongoDB
app.post('/store-translation', async (req, res) => {
  const { originalWord, translatedWord, pexelsImages, date, language } = req.body;

  if (!originalWord || !translatedWord || !pexelsImages || !date || !language) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const client = await connectToMongo();
  if (!client) {
    return res.status(500).json({ error: 'Database connection failed' });
  }

  const db = client.db('translate-visualizer');
  const collection = db.collection('translations');

  try {
    const result = await collection.insertOne({
      originalWord,
      translatedWord,
      pexelsImages,
      date,
      language
    });
    res.status(200).json({ message: '✅ Data saved successfully', result });
  } catch (err) {
    console.error('❌ Error inserting data:', err);
    res.status(500).json({ error: 'Error inserting data into MongoDB' });
  } finally {
    await client.close();
  }
});

// Start the Express server
app.listen(port, async () => {
  console.log(`🚀 Server running at http://localhost:${port}`);

  // Test MongoDB connection when the server starts
  const client = await connectToMongo();
  if (!client) {
    console.error('❌ MongoDB Connection FAILED. Check credentials and internet connection.');
  }
});
