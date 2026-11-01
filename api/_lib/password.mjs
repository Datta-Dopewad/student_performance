import { randomBytes,scrypt as scryptCallback,timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
const scrypt=promisify(scryptCallback);
export async function hashPassword(password){const salt=randomBytes(16),key=await scrypt(password,salt,64,{N:16384,r:8,p:1,maxmem:64*1024*1024});return `scrypt$16384$8$1$${salt.toString('base64url')}$${Buffer.from(key).toString('base64url')}`}
export async function verifyPassword(password,encoded){const [kind,n,r,p,saltText,keyText]=String(encoded||'').split('$');if(kind!=='scrypt'||!saltText||!keyText)return false;try{const expected=Buffer.from(keyText,'base64url'),actual=Buffer.from(await scrypt(password,Buffer.from(saltText,'base64url'),expected.length,{N:+n,r:+r,p:+p,maxmem:64*1024*1024}));return expected.length===actual.length&&timingSafeEqual(expected,actual)}catch{return false}}
