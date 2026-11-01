export function send(res, status, payload) {
  res.statusCode = status;
  res.setHeader('Content-Type','application/json; charset=utf-8');
  res.setHeader('Cache-Control','no-store');
  res.end(JSON.stringify(payload));
}
export async function body(req, maxBytes=1_000_000) {
  let raw='';
  for await (const chunk of req) { raw += chunk; if(raw.length > maxBytes) throw Object.assign(new Error('Request too large'),{status:413}); }
  if(!raw) return {};
  try { return JSON.parse(raw); } catch { throw Object.assign(new Error('Invalid request body'),{status:400}); }
}
export function sameOrigin(req) {
  const origin=req.headers.origin;
  if(!origin) return false;
  try {
    const parsed=new URL(origin);
    const configured=process.env.APP_ORIGIN;
    if(configured) return parsed.origin===configured;
    return parsed.host.toLowerCase()===String(req.headers.host||'').toLowerCase() && (parsed.protocol==='https:' || parsed.hostname==='localhost' || parsed.hostname==='127.0.0.1');
  } catch { return false; }
}
export function cookies(req) {
  const out={};
  for(const part of String(req.headers.cookie||'').split(';')) { const i=part.indexOf('='); if(i>0) out[part.slice(0,i).trim()]=decodeURIComponent(part.slice(i+1).trim()); }
  return out;
}
export function setCookie(res,name,value,{httpOnly=true,maxAge=0}={}) {
  const secure=process.env.NODE_ENV==='production';
  const attrs=[`${name}=${encodeURIComponent(value)}`,'Path=/','SameSite=Lax',`Max-Age=${maxAge}`];
  if(httpOnly) attrs.push('HttpOnly');
  if(secure) attrs.push('Secure');
  const previous=res.getHeader('Set-Cookie');
  res.setHeader('Set-Cookie',[...(Array.isArray(previous)?previous:previous?[previous]:[]),attrs.join('; ')]);
}
export function clearCookie(res,name,httpOnly=true) { setCookie(res,name,'',{httpOnly,maxAge:0}); }
export function methodNotAllowed(res,allowed) { res.setHeader('Allow',allowed.join(', ')); return send(res,405,{error:'Method not allowed'}); }
