import { database } from './db.mjs';
export async function audit(user,action,entityType,entityId=null,metadata={}){const db=await database();await db.collection('audit_logs').insertOne({schoolId:user.schoolId,actorId:user.id,action,entityType,entityId,safeMetadata:metadata,createdAt:new Date()})}
