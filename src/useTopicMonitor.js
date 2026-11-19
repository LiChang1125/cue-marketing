import {useEffect, useState} from 'react';
import {searchLiveTopic} from './live-topic.js';
import {monitorRound} from '../shared/yupi-monitor.js';

const empty = {key:'', items:[], community:[], coverage:[], ok:0, running:false, added:null};
export function useTopicMonitor(query, days) {
  const [lookup, setLookup] = useState(empty);
  useEffect(() => {
    if (!query) { setLookup(empty); return; }
    const key = query + '|' + days;
    const controller = new AbortController();
    const observations = new Map();
    let previous = new Map(), timer, due = 0, running = false, added = null;
    function publish() {
      if (controller.signal.aborted) return;
      const parts = [...observations.values()];
      setLookup({key, running, added, items:parts.flatMap(p=>p.items), community:parts.flatMap(p=>p.community),
        coverage:parts.map(p=>({name:p.name, ok:p.ok, count:p.items.length+p.community.length})),
        ok:parts.filter(p=>p.ok).length});
    }
    async function scan() {
      if (controller.signal.aborted || running || document.hidden || Date.now() < due) return;
      running = true;
      publish();
      const fresh = new Map();
      try {
        await searchLiveTopic(query, days, controller.signal, (name, items, ok, community=[]) => {
          const part = {name, items, ok, community};
          fresh.set(name, part);
          observations.set(name, part);
          publish();
        });
        const result = monitorRound(previous, [...fresh.values()], days);
        added = [...fresh.values()].some(p=>p.ok&&previous.has(p.name)) ? result.added : null;
        previous = result.sources;
        for (const name of observations.keys()) if (!fresh.has(name)) observations.delete(name);
      } finally {
        if (!controller.signal.aborted) {
          running = false;
          publish();
          due = Date.now() + 300000;
          timer = setTimeout(scan, 300000);
        }
      }
    }
    scan();
    document.addEventListener('visibilitychange',scan);
    return () => {
      controller.abort();
      clearTimeout(timer);
      document.removeEventListener('visibilitychange',scan);
    };
  }, [query, days]);
  return lookup;
}
