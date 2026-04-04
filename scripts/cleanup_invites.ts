import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

// Fix __dirname issue in tsx modules if any, but since we are running locally:
dotenv.config({ path: path.join(process.cwd(), '.env') });

async function clearPending() {
  try {
    const uri = process.env.MONGODB_URI;
    if (!uri) throw new Error('No MONGODB_URI found in .env');

    await mongoose.connect(uri);
    console.log("Connected to MongoDB.");

    const result = await mongoose.connection.collection('friendrequests').deleteMany({ status: 'pending' });
    console.log(`✅ Deleted ${result.deletedCount} pending invites!`);

    process.exit(0);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}

clearPending();
