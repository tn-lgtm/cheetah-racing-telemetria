(function(root){
'use strict';
function parseRows(text,delimiter){
 const rows=[];let row=[],field='',quoted=false,closed=false;
 for(let i=0;i<text.length;i++){
  const c=text[i];
  if(quoted){if(c==='"'){if(text[i+1]==='"'){field+='"';i++;}else{quoted=false;closed=true;}}else field+=c;}
  else if(c===delimiter){row.push(field.trim());field='';closed=false;}
  else if(c==='\n'||c==='\r'){if(c==='\r'&&text[i+1]==='\n')i++;row.push(field.trim());if(row.some(v=>v!==''))rows.push(row);row=[];field='';closed=false;}
  else if(c==='"'){if(field.trim()||closed)throw Error('Aspas inválidas no CSV. Confira o arquivo.');field='';quoted=true;}
  else {if(closed&&!/\s/.test(c))throw Error('Há texto após uma coluna entre aspas. Confira o CSV.');field+=c;}
 }
 if(quoted)throw Error('O CSV contém aspas sem fechamento.');
 row.push(field.trim());if(row.some(v=>v!==''))rows.push(row);return rows;
}
function parseCSV(text){
 text=text.replace(/^\uFEFF/,'');if(!text.trim())throw Error('O arquivo está vazio.');
 let first='',quoted=false;for(let i=0;i<text.length;i++){const c=text[i];if(c==='"')quoted=!quoted;if(!quoted&&(c==='\r'||c==='\n'))break;first+=c;}
 let delimiter=',',score=-1;for(const d of [',',';','\t']){const n=parseRows(first,d)[0]?.length||0;if(n>score){score=n;delimiter=d;}}
 const rows=parseRows(text,delimiter);if(rows.length<2)throw Error('O CSV precisa de um cabeçalho e pelo menos uma linha de dados.');
 const headers=rows.shift();if(headers.length<4)throw Error('São necessárias pelo menos quatro colunas: uma para cada sensor.');
 if(headers.some(h=>!h)||new Set(headers).size!==headers.length)throw Error('Use um nome único e não vazio para cada coluna.');
 if(rows.some(r=>r.length!==headers.length))throw Error('Há linhas com quantidade de colunas diferente do cabeçalho. Verifique o separador e as vírgulas decimais.');
 return {headers,rows,delimiter};
}
function number(value){if(value==null||String(value).trim()==='')return null;const s=String(value).trim().replace(',','.');if(!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(s))return null;const n=Number(s);return Number.isFinite(n)?n:null;}
function stats(values){
 if(!values.length)return null;let mean=0,m2=0,min=Infinity,max=-Infinity;
 values.forEach((x,i)=>{const delta=x-mean;mean+=delta/(i+1);m2+=delta*(x-mean);min=Math.min(min,x);max=Math.max(max,x);});
 const sorted=[...values].sort((a,b)=>a-b),n=values.length,mid=Math.floor(n/2),median=n%2?sorted[mid]:sorted[mid-1]/2+sorted[mid]/2;
 const sd=n>1?Math.sqrt(Math.max(0,m2)/(n-1)):null;
 const cv=sd!==null&&mean!==0?sd/Math.abs(mean)*100:null;
 if(!Number.isFinite(mean)||!Number.isFinite(median)||!Number.isFinite(m2)||(cv!==null&&!Number.isFinite(cv)))throw Error('Valores numéricos muito grandes para calcular com segurança. Verifique as unidades e o CSV.');
 return {n,mean,median,sd,cv,min,max};
}
function thin(points,limit=700){if(points.length<=limit)return points;const out=[points[0]],size=Math.ceil((points.length-2)/Math.floor((limit-2)/2));for(let i=1;i<points.length-1;i+=size){let lo=i,hi=i;for(let j=i;j<Math.min(i+size,points.length-1);j++){if(points[j].y<points[lo].y)lo=j;if(points[j].y>points[hi].y)hi=j;}for(const k of [...new Set([lo,hi])].sort((a,b)=>a-b))out.push(points[k]);}out.push(points[points.length-1]);return out;}
root.CheetahAnalysis={parseCSV,number,stats,thin};
if(typeof module!=='undefined')module.exports=root.CheetahAnalysis;
})(typeof window!=='undefined'?window:globalThis);
