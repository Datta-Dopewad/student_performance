import { MongoClient } from 'mongodb';

const uri=process.env.MONGODB_URI;
if(!uri)throw new Error('MongoDB Atlas is not configured. Add MONGODB_URI to the Vercel project environment.');
const options={maxPoolSize:5,minPoolSize:0,serverSelectionTimeoutMS:8000,connectTimeoutMS:8000,appName:'student-performance-classroom'};
const cached=globalThis.__studentPerformanceMongo;
export const mongoClient=cached?.client||new MongoClient(uri,options);
const client=mongoClient;
const connected=cached?.connected||client.connect();
if(!cached)globalThis.__studentPerformanceMongo={client,connected};
export const dbPromise=connected.then(()=>client.db(process.env.MONGODB_DB||'student_performanceDB'));
export async function database(){return dbPromise}
