const labels = new Map([
  ["label: '热点雷达'", "label: '趋势现场'"], ["label: '搜索'", "label: '品牌搜索'"],
  ['监控词','观察词库'], ['总热点','全部动向'], ['今日新增','今日入选'], ['紧急热点','优先关注'],
  ['实时热点流','最新动向'], ['立即扫描','更新动向'], ['扫描中','更新中'],
  ['热点检查已触发','本轮更新完成'], ['发现新热点','新动向'], ['尚未发现热点','暂无新动向'],
  ['添加你想追踪的技术热点词','可观察品牌、联名系列或消费趋势'], ['搜索热点内容...','搜索品牌、联名或营销主题'],
  ['AI 分析理由','匹配依据'], ['AI 摘要','内容提要'], ['原始内容','内容详情'],
  ["'Twitter'","'推特'"], ["'Bing'","'必应'"], ["'Google'","'谷歌'"], ["'Bilibili'","'哔哩哔哩'"],
  ["'HackerNews'","'黑客新闻社区'"], ["'DuckDuckGo'","'隐私搜索'"]
]);
export function editorialUI(text){
  for(const [from,to] of labels)text=text.replaceAll(from,to);
  if(text.includes('function App()')){
    text="import ResearchBrief from './ResearchBrief';\n"+text
      .replace('const [searchResults, setSearchResults]', 'const [brief,setBrief]=useState(null);\n  const [searchResults, setSearchResults]')
      .replace('const result = await hotspotsApi.search(searchQuery);','setBrief(null);setSearchResults([]);const result = await hotspotsApi.search(searchQuery);setBrief(result.brief);')
      .replace('{/* Search Filter & Sort Bar */}', '<ResearchBrief brief={brief}/>{/* Search Filter & Sort Bar */}')
      .replace('{hotspot.title}</h3>','{hotspot.title}</h3>{hotspot.angle&&<p className="cue-post-proof">{hotspot.angle}{hotspot.metricDisplay?" · "+hotspot.metricDisplay:""}</p>}')
      .replace("return labels[source] || source;", "return ({editorial:'行业媒体',reddit:'红迪社区',instagram:'Instagram',xiaohongshu:'小红书',douyin:'抖音'})[source]||labels[source]||'其他来源';");
  }
  return text
    .replaceAll('相关性 {hotspot.relevance}%',"{hotspot.relevanceReason?.includes('未配置 AI') ? (hotspot.keywordMentioned?'关键词命中':'关键词部分匹配') : '相关性 '+hotspot.relevance+'%'}")
    .replaceAll('{heat.label} {heatScore}',"{hotspot.angle ? (hotspot.metricDisplay?'公开互动':'品牌案例') : [hotspot.viewCount,hotspot.likeCount,hotspot.commentCount,hotspot.retweetCount].some(v=>typeof v==='number') ? heat.label+' '+heatScore : '互动数未公开'}")
    .replaceAll('{hotspot.importance}</span>',"{{low:'一般',medium:'值得留意',high:'重要',urgent:'优先'}[hotspot.importance]}</span>")
    .replace('return labels[source] || source;', "return source==='editorial'?'行业媒体':labels[source]||'其他来源';")
    .replace("showToast(error.message || '添加失败', 'error');","showToast(error.message==='Keyword already exists'?'观察词已存在':'添加失败，请重试','error');")
    .replace("const [searchFilters, setSearchFilters] = useState<FilterState>({ ...defaultFilterState });",
      "const [searchFilters, setSearchFilters] = useState<FilterState>({ ...defaultFilterState, sortBy:'marketing' });")
    .replace('results = sortHotspots(results,', "if(searchFilters.sortBy!=='marketing') results = sortHotspots(results,")
    .replace('filters={searchFilters}', 'marketing filters={searchFilters}')
    .replace('export default function FilterSortBar({ filters, onChange, keywords }', 'export default function FilterSortBar({ filters, onChange, keywords, marketing }')
    .replace('interface FilterSortBarProps {','interface FilterSortBarProps {\n  marketing?: boolean;')
    .replace('{SORT_OPTIONS.map(', "{(marketing?[{value:'marketing',label:'品牌优先',icon:Target},...SORT_OPTIONS]:SORT_OPTIONS).map(")
    .replace("filters.sortBy !== 'createdAt'", "filters.sortBy !== (marketing?'marketing':'createdAt')")
    .replace('onChange({ ...defaultFilterState });',"onChange({ ...defaultFilterState, sortBy:marketing?'marketing':'createdAt' });")
    .replace("{ value: 'twitter', label:", "{ value: 'editorial', label: '行业媒体' },{ value:'reddit',label:'红迪社区' },{ value:'instagram',label:'Instagram' },{ value:'xiaohongshu',label:'小红书' },{ value:'douyin',label:'抖音' },\n  { value: 'twitter', label:")
    .replace('setSearchResults(result.results);',"setSearchResults(result.results); if(!result.results.length)showToast('暂无匹配的品牌动向','success');");
}
