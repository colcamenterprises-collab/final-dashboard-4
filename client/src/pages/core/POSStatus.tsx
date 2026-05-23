import { useEffect, useState } from 'react';
import SourceHealthPanel from '@/components/core/SourceHealthPanel';
export default function POSStatus(){const [d,setD]=useState<any>(null);useEffect(()=>{fetch('/api/system/pos-status',{credentials:'include'}).then(r=>r.json()).then(setD)},[]);if(!d)return <div>Loading...</div>;return <div className='space-y-3'><h1 className='text-2xl font-semibold'>POS Status</h1><SourceHealthPanel source={d}/></div>}
