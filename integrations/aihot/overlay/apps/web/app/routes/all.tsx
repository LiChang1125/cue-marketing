import {redirect,useLoaderData} from "react-router";
import type {Route} from "./+types/all";
import type {Screen} from "../components/shell/screens";
import BrandCases from "../components/BrandCases";

export const handle:Screen={tab:"featured",name:"主题搜索"};
export function loader({request}:Route.LoaderArgs){
 const params=new URL(request.url).searchParams;
 const query=params.get("q")?.trim().slice(0,100);
 if(!query)throw redirect("/hot");
 return {query};
}
export function meta(){return [{title:"主题搜索 · CUE"}];}
export default function TopicSearch(){
 const {query}=useLoaderData<typeof loader>();
 return <BrandCases key={query} query={query}/>;
}
