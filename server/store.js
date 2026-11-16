import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

export function openStore(directory) {
  mkdirSync(directory, { recursive: true });
  const db = new DatabaseSync(resolve(directory, 'trends.sqlite'));
  db.exec(`PRAGMA journal_mode=WAL;
    CREATE TABLE IF NOT EXISTS items (id TEXT PRIMARY KEY, data TEXT NOT NULL, first_seen TEXT NOT NULL, last_seen TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS snapshots (id TEXT, at TEXT, views INTEGER, likes INTEGER, PRIMARY KEY(id,at));
    CREATE TABLE IF NOT EXISTS observations (id TEXT, at TEXT, metrics TEXT NOT NULL, PRIMARY KEY(id,at));
    CREATE TABLE IF NOT EXISTS followers (id TEXT, at TEXT, count INTEGER, PRIMARY KEY(id,at));
    CREATE TABLE IF NOT EXISTS sources (id TEXT PRIMARY KEY, data TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS reports (day TEXT PRIMARY KEY, data TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS topics (id TEXT PRIMARY KEY, data TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS topic_items (topic_id TEXT, item_id TEXT, discovered_at TEXT, last_seen TEXT, PRIMARY KEY(topic_id,item_id));
    CREATE TABLE IF NOT EXISTS topic_runs (topic_id TEXT, at TEXT, source TEXT, count INTEGER, added INTEGER, state TEXT, PRIMARY KEY(topic_id,at,source));`);
  return {
    saveItems(items, at) {
      const itemStmt=db.prepare('INSERT INTO items VALUES(?,?,?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data,last_seen=excluded.last_seen');
      const metricStmt=db.prepare('INSERT OR IGNORE INTO snapshots VALUES(?,?,?,?)');
      const observationStmt=db.prepare('INSERT OR IGNORE INTO observations VALUES(?,?,?)');
      db.exec('BEGIN');
      try { for(const item of items) { const old=db.prepare('SELECT data FROM items WHERE id=?').get(item.id);const before=old?JSON.parse(old.data):{};const merged={...item,tags:[...new Set([...(before.tags||[]),...(item.tags||[])])],categories:[...new Set([...(before.categories||[]),...(item.categories||[])])]};itemStmt.run(item.id, JSON.stringify(merged),at,at); if(Number.isFinite(item.metrics.views)) metricStmt.run(item.id,at,item.metrics.views,item.metrics.likes??null);if(Object.values(item.metrics).some(Number.isFinite))observationStmt.run(item.id,item.metricAt||at,JSON.stringify(item.metrics)); } db.exec('COMMIT'); } catch(e) {db.exec('ROLLBACK');throw e;}
    },
    items() {return db.prepare('SELECT * FROM items ORDER BY last_seen DESC').all().map(r=>({...JSON.parse(r.data),firstSeen:r.first_seen,lastSeen:r.last_seen}));},
    updateItemData(item){const {firstSeen,lastSeen,...data}=item;db.prepare('UPDATE items SET data=? WHERE id=?').run(JSON.stringify(data),item.id);},
    history(id) { const rows=db.prepare('SELECT at,metrics FROM observations WHERE id=? ORDER BY at DESC LIMIT 288').all(id).reverse().map(r=>({at:r.at,...JSON.parse(r.metrics)}));return rows.length?rows:db.prepare('SELECT at,views,likes FROM snapshots WHERE id=? ORDER BY at DESC LIMIT 288').all(id).reverse(); },
    saveSource(value) {db.prepare('INSERT OR REPLACE INTO sources VALUES(?,?)').run(value.id,JSON.stringify(value));},
    sources() {return db.prepare('SELECT data FROM sources').all().map(r=>JSON.parse(r.data));},
    saveFollowers(id,at,count) {db.prepare('INSERT OR IGNORE INTO followers VALUES(?,?,?)').run(id,at,count);},
    followers(id) {return db.prepare('SELECT at,count FROM followers WHERE id=? ORDER BY at DESC LIMIT 288').all(id).reverse();},
    saveTopic(topic){db.prepare('INSERT OR REPLACE INTO topics VALUES(?,?)').run(topic.id,JSON.stringify(topic));},
    topics(){return db.prepare('SELECT data FROM topics').all().map(r=>JSON.parse(r.data));},
    topicItems(id){return db.prepare('SELECT item_id AS id,discovered_at AS discoveredAt,last_seen AS lastSeen FROM topic_items WHERE topic_id=? ORDER BY discovered_at DESC').all(id);},
    saveTopicRun(id,source,items,at,state){
      let added=0;
      const exists=db.prepare('SELECT 1 FROM topic_items WHERE topic_id=? AND item_id=?');
      const upsert=db.prepare('INSERT INTO topic_items VALUES(?,?,?,?) ON CONFLICT(topic_id,item_id) DO UPDATE SET last_seen=excluded.last_seen');
      for(const item of items){if(!exists.get(id,item.id))added++;upsert.run(id,item.id,at,at);}
      db.prepare('INSERT OR REPLACE INTO topic_runs VALUES(?,?,?,?,?,?)').run(id,at,source,items.length,added,state);
      return added;
    },
    topicHistory(id){return db.prepare('SELECT at,source,count,added,state FROM topic_runs WHERE topic_id=? ORDER BY at DESC LIMIT 120').all(id);},
    prune() {const cutoff=new Date(Date.now()-30*86400000).toISOString();for(const table of ['snapshots','followers','observations','topic_runs']) db.prepare(`DELETE FROM ${table} WHERE at<?`).run(cutoff);db.prepare('DELETE FROM items WHERE last_seen<?').run(cutoff);db.prepare('DELETE FROM topic_items WHERE item_id NOT IN (SELECT id FROM items)').run();},
    saveReport(report){db.prepare('INSERT OR REPLACE INTO reports VALUES(?,?)').run(report.date,JSON.stringify(report));},
    reports(){return db.prepare('SELECT data FROM reports ORDER BY day DESC LIMIT 90').all().map(r=>JSON.parse(r.data));},
    report(day){const row=db.prepare('SELECT data FROM reports WHERE day=?').get(day);return row?JSON.parse(row.data):null;},
    close() {db.close();}
  };
}
