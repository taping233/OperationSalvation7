// Store-only ZIP: browser-produced PNG files are already compressed.
const table=Uint32Array.from({length:256},(_,i)=>{let n=i;for(let j=0;j<8;j++)n=n&1?0xedb88320^(n>>>1):n>>>1;return n>>>0;});
function crc(bytes){let n=0xffffffff;for(const b of bytes)n=table[(n^b)&255]^(n>>>8);return (n^0xffffffff)>>>0;}
function header(size,fields){const b=new Uint8Array(size),v=new DataView(b.buffer);for(const [offset,value,width] of fields)width===2?v.setUint16(offset,value,true):v.setUint32(offset,value,true);return b;}
export function zip(files){
 const chunks=[],directory=[];let offset=0;
 for(const file of files){
  const name=new TextEncoder().encode(file.name),data=file.bytes,check=crc(data);
  const local=header(30,[[0,0x04034b50,4],[4,20,2],[14,check,4],[18,data.length,4],[22,data.length,4],[26,name.length,2]]);
  chunks.push(local,name,data);
  const central=header(46,[[0,0x02014b50,4],[4,20,2],[6,20,2],[16,check,4],[20,data.length,4],[24,data.length,4],[28,name.length,2],[42,offset,4]]);
  directory.push(central,name);offset+=30+name.length+data.length;
 }
 const directorySize=directory.reduce((n,b)=>n+b.length,0);
 const end=header(22,[[0,0x06054b50,4],[8,files.length,2],[10,files.length,2],[12,directorySize,4],[16,offset,4]]);
 return new Blob([...chunks,...directory,end],{type:'application/zip'});
}
