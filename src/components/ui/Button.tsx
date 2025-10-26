import React from 'react';
export default function Button({ children, onClick }: any) {
return (
<button onClick={onClick} className="px-3 py-1 rounded bg-slate-800 text-white">{children}</button>
);
}
