import test from 'node:test';
import assert from 'node:assert/strict';
import {searchHackerNews,monitorRound} from '../shared/yupi-monitor.js';
import {brandSlug,parseMentions,comparePosts} from '../server/instagram-mentions.js';
import {communityForTopic} from '../shared/community.js';

test('monitor compares successful rounds and ignores duplicate and historic URLs',()=>{
  const part=(urls,ok=true)=>({name:'A',ok,items:urls.map(url=>({url})),community:[]});
  const first=monitorRound(new Map(),[part(['one'])]);
  assert.equal(first.added,0);
  const outage=monitorRound(first.sources,[part([],false)]);
  assert.equal(monitorRound(outage.sources,[{...part(['one','two','two']),community:[{url:'two'}]}]).added,1);
  assert.equal(monitorRound(first.sources,[{...part([]),items:[{url:'past',historical:true}]}]).added,0);
});
test('Hacker News uses dated story search and keeps real discussion counts',async()=>{
  const hit={objectID:'123',title:'A new camera',created_at:new Date().toISOString(),points:0,num_comments:2};
  const posts=await searchHackerNews('camera',7,new AbortController().signal,async endpoint=>{
    assert.equal(endpoint.searchParams.get('tags'),'story');
    assert.equal(endpoint.searchParams.get('query'),'camera');
    return Response.json({hits:[hit,hit,{...hit,objectID:'456',created_at:'2001-01-01'}]});
  });
  assert.equal(posts.length,1);assert.equal(posts[0].points,0);assert.equal(posts[0].replies,2);
  assert.equal(posts[0].url,'https://news.ycombinator.com/item?id=123');
});
test('Instagram resolves brand synonyms and compares only the same original post',()=>{
  const html='<h1>Asics Instagram followers, mentions and creators</h1><table><tr><th><a class="ml-post" href="https://www.instagram.com/p/id/"><span class="ml-caption">GEL-NIMBUS</span></a></th><td data-label="Author">@runner</td><td data-label="Date">2026-11-07</td><td data-label="Likes">1,200</td><td data-label="Comments">0</td></tr></table>';
  const now=Date.parse('2026-11-19');
  assert.equal(brandSlug('亚瑟士'),'asics');
  assert.equal(brandSlug('../foo'),null);
  assert.throws(()=>parseMentions(html,'lego',now));
  const posts=parseMentions(html,'asics',now);
  assert.equal(posts[0].likes,1200);assert.equal(posts[0].replies,0);
  assert.equal(comparePosts(posts)[0].likeChange,undefined);
  const checkedAt='2026-11-18T00:00:00Z';
  const compared=comparePosts(posts,{checkedAt,items:[{...posts[0],likes:1180,replies:1}]});
  assert.equal(compared[0].likeChange,20);assert.equal(compared[0].replyChange,-1);
  assert.equal(communityForTopic({instagramTopics:{asics:{items:compared}}},'亚瑟士',30,posts,now)[0].posts.length,1);
});
