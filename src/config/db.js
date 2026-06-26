const mongoose = require('mongoose');

const connectDB = async () => {
  const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/baknus_talim';
  let retries = 5;

  while (retries) {
    try {
      const conn = await mongoose.connect(mongoUri);
      console.log(`MongoDB Connected: ${conn.connection.host}`);
      return;
    } catch (error) {
      retries -= 1;
      console.error(`MongoDB Connection Error: ${error.message}. Retrying in 3 seconds... (Retries left: ${retries})`);
      if (retries === 0) {
        process.exit(1);
      }
      await new Promise(res => setTimeout(res, 3000));
    }
  }
};

module.exports = connectDB;
