import { randomBytes,createHash } from 'node:crypto';
import { ObjectId } from 'mongodb';
import { database } from './db.mjs';
import { cookies,send } from './http.mjs';
import { hashPassword,verifyPassword } from './password.mjs';
export { hashPassword,verifyPassword } from './password.mjs';
const secret=process.env.SESSION_SECRET;
if(!secret||Buffer.byteLength(secret)<32)throw new Error('SESSION_SECRET must be configured with at least 32 bytes.');
export const randomToken=()=>randomBytes(32).toString('base64url');
export const digestToken=value=>createHash('sha256').update(`${secret}:${value}`).digest('hex');
export function normalizeEmail(email){return String(email||'').trim().toLowerCase()}
export function validScore(value,min=0,max=100){return Number.isFinite(Number(value))&&Number(value)>=min&&Number(value)<=max}
export function asObjectId(value){try{return ObjectId.isValid(value)?new ObjectId(value):null}catch{return null}}
export function idString(value){return value?.toString?.()||''}
export async function auth(req,res,roles=[]){const raw=cookies(req).sp_session;if(!raw){send(res,401,{error:'Please sign in to continue.'});return null}const db=await database(),tokenHash=digestToken(raw);const session=await db.collection('sessions').findOne({tokenHash,expiresAt:{$gt:new Date()}});if(!session){send(res,401,{error:'Your session has expired. Please sign in again.'});return null}const user=await db.collection('users').findOne({_id:session.userId,active:true},{projection:{passwordHash:0}});if(!user){await db.collection('sessions').deleteOne({tokenHash});send(res,401,{error:'Your session has expired. Please sign in again.'});return null}if(roles.length&&!roles.includes(user.role)){send(res,403,{error:'You do not have permission to perform this action.'});return null}const school=await db.collection('schools').findOne({_id:user.schoolId},{projection:{name:1,academicYear:1,atRiskThreshold:1}});if(!school){send(res,401,{error:'Your school account is unavailable.'});return null}req.user={id:user._id,schoolId:user.schoolId,name:user.name,email:user.email,role:user.role,schoolName:school.name,academicYear:school.academicYear,atRiskThreshold:school.atRiskThreshold};return req.user}
export function requireCsrf(req,res){const {sp_csrf}=cookies(req),supplied=req.headers['x-csrf-token'];if(!sp_csrf||!supplied||sp_csrf!==supplied){send(res,403,{error:'Security token expired. Refresh and try again.'});return false}return true}
