export const curatedTabs=[
  ['all','全部选读'],
  ['news','品牌动态'],
  ['campaigns','创意企划'],
  ['cases','案例笔记'],
  ['insights','深度观点'],
  ['trends','趋势风向'],
  ['spaces','场景体验'],
  ['people','行业人物'],
];

// Source labels are independent of CUE's display names and navigation order.
const sourceKinds=new Map([
  ['全部','all'],['趋势','trends'],['洞察','insights'],['案例','cases'],
  ['营销','campaigns'],['空间','spaces'],['人物','people'],['资讯','news'],
]);
export const curatedKind=label=>sourceKinds.get(label)||curatedTabs.find(([,name])=>name===label)?.[0]||'news';
