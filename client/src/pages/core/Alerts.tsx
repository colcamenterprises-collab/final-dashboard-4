import { useEffect, useState } from 'react';
import AlertList from '@/components/core/AlertList';
export default function Alerts(){const [d,setD]=useState<any>(null);useEffect(()=>{fetch('/api/core/alerts',{credentials:'include'}).then(r=>r.json()).then(setD)},[]);return <div className='space-y-3'><h1 className='text-2xl font-semibold'>Alerts</h1><AlertList alerts={d?.alerts||[]}/></div>}
