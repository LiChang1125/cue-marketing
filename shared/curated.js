export const curatedTabs=[['all','全部'],['trends','趋势'],['insights','洞察'],['cases','案例'],['campaigns','营销'],['spaces','空间'],['people','人物'],['news','资讯']];
export const curatedKind=label=>curatedTabs.find(([,name])=>name===label)?.[0]||'news';
