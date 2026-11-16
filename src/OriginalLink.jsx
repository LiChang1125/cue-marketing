import React from 'react';
import {originalHref} from '../shared/original.js';
export default function OriginalLink({item,children,keepText=false,...props}){const href=originalHref(item);return href?<a {...props} href={href} target="_blank" rel="noreferrer">{children}</a>:keepText?<span>{children}</span>:null;}
