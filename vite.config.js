import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import {resolve} from 'node:path';
// The Pages reader reuses the newsroom cards and brand tools with a static data transport.
const pagesReader={
 name:'cue-pages-reader',enforce:'pre',
 resolveId(id,from){
   if(!from?.replaceAll('\\','/').includes('/integrations/aihot/overlay/apps/web/'))return;
   return ({
     '../lib/use-brand-data':resolve('pulse/use-data.js'),
     '../features/hot/Sparkline':resolve('pulse/Sparkline.tsx'),
     '../components/shell/PhoneBar':resolve('pulse/PhoneBar.jsx')
   })[id];
 }
};
export default defineConfig({plugins:[pagesReader,react()],build:{rollupOptions:{input:{main:resolve('index.html'),pulse:resolve('pulse/index.html')}}}});
