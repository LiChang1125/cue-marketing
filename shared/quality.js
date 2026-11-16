// Evidence must be in the article, not in the query that found it.
export function meaningfulContent(item){
  const title=String(item.originalTitle||item.title||'').trim(),author=String(item.creator||'');
  if(title.length<4)return false;
  if(/转发微博|转发抽|抽奖|粉丝福利|超话|打榜|应援|签到|代拍|吃瓜|绯闻|路透|私信下单|代购接单|求购|出闲置|招聘岗位|实习生招聘|日结兼职/.test(title))return false;
  if(/后援会|打投组|应援站|粉丝站|娱乐爆料/.test(author))return false;
  if(/强军|外交|军事演习|导弹|重要讲话|学习贯彻|伟大复兴|时政新闻/.test(title))return false;
  const tags=title.match(/#[^#\s]+/g)||[];
  const prose=title.replace(/#[^#\s]+/g,'').replace(/[\p{P}\p{S}\s]/gu,'');
  if(tags.length>=4&&prose.length<18&&!/推出|发布新|限定系列|快闪开业|联名装备/.test(title))return false;
  if(/(.)\1{6,}/u.test(title))return false;
  return true;
}
