// Local development / integration-test D1 facade. Never bundled into Cloudflare Worker.
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
export function database(path=':memory:'){
 const sql=new DatabaseSync(path);sql.exec(readFileSync(new URL('migrations/0001_intel.sql',import.meta.url),'utf8'));
 const stmt=(query,args=[])=>({bind:(...values)=>stmt(query,values),async all(){return {results:sql.prepare(query).all(...args)};},async first(){return sql.prepare(query).get(...args)||null;},async run(){const out=sql.prepare(query).run(...args);return {success:true,meta:{changes:Number(out.changes)}};},_query:query,_args:args});
 return {prepare:query=>stmt(query),async batch(items){sql.exec('BEGIN');try{const results=[];for(const item of items)results.push(await item.run());sql.exec('COMMIT');return results;}catch(e){sql.exec('ROLLBACK');throw e;}},close:()=>sql.close(),raw:sql};
}
