import {assetUrl,mediaUrl} from './urls.js';
import React,{useState} from 'react';
import {directionIds,sectorId} from '../shared/insights.js';
export function fallbackCover(item){const ids=directionIds(item);return '/covers/'+(ids.includes('scent')?'scent':ids.includes('toys')||ids.includes('subculture')||/迪士尼|三丽鸥|宝可梦|chiikawa|labubu|公仔|动漫|动画|虚构|GTA|手办/i.test(item.title)?'culture':'brand')+'.png';}
export default function Cover({item,className='',eager=false}){
  const [failed,setFailed]=useState([]);
  const candidates=[item.imageLocal,item.image].filter((src,index,list)=>typeof src==='string'&&(/^\/media\/[\w.-]+$/.test(src)||/^https:\/\//.test(src))&&!/default_img|placeholder|favicon|site-logo/i.test(src)&&!failed.includes(src)&&list.indexOf(src)===index);
  const original=candidates[0],src=original?mediaUrl(original):assetUrl(fallbackCover(item));
  return <span className={'news-cover '+className} data-cover-kind={original?'original':'fallback'}><img src={src} alt={original?item.title:((directionIds(item).includes('scent')?'香氛':sectorId(item)==='brand'?'品牌':'IP 与文化消费')+'主题配图')} loading={eager?'eager':'lazy'} decoding="async" referrerPolicy="no-referrer" onError={()=>{if(original)setFailed(previous=>[...previous,original]);}}/>{!original&&<small className="cover-credit">主题配图</small>}</span>;
}
