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
 if(!values.length)return null;let mean=0,min=Infinity,max=-Infinity;
 values.forEach((x,i)=>{mean+=(x-mean)/(i+1);min=Math.min(min,x);max=Math.max(max,x);});
 if(!Number.isFinite(mean))throw Error('Valores numéricos muito grandes para calcular com segurança. Verifique as unidades.');
 return {n:values.length,mean,min,max};
}
function parseWorksheet(sheet,XLSX){
 if(!sheet||!sheet['!ref'])throw Error('Esta planilha está vazia. Selecione outra planilha.');
 const range=XLSX.utils.decode_range(sheet['!ref']);
 if((range.e.r-range.s.r+1)*(range.e.c-range.s.c+1)>2000000)throw Error('Esta planilha é muito grande. Remova linhas e colunas excedentes ou divida a sessão.');
 const rows=XLSX.utils.sheet_to_json(sheet,{header:1,raw:true,defval:'',blankrows:false});
 if(rows.length<2)throw Error('A planilha precisa de cabeçalhos e pelo menos uma linha de dados.');
 const rawHeaders=rows.shift();while(rawHeaders.length&&String(rawHeaders[rawHeaders.length-1]).trim()==='')rawHeaders.pop();
 const headers=rawHeaders.map(h=>String(h).trim());
 if(headers.length<4)throw Error('São necessárias pelo menos quatro colunas: uma para cada sensor.');
 if(headers.some(h=>!h)||new Set(headers).size!==headers.length)throw Error('Use um nome único e não vazio para cada coluna na primeira linha preenchida.');
 if(rows.some(r=>r.slice(headers.length).some(v=>v!==''&&v!==null)))throw Error('Há dados em colunas sem cabeçalho. Preencha os nomes das colunas.');
 return {headers,rows:rows.map(r=>headers.map((_,i)=>r[i]??''))};
}
function thin(points,limit=700){if(points.length<=limit)return points;const out=[points[0]],size=Math.ceil((points.length-2)/Math.floor((limit-2)/2));for(let i=1;i<points.length-1;i+=size){let lo=i,hi=i;for(let j=i;j<Math.min(i+size,points.length-1);j++){if(points[j].y<points[lo].y)lo=j;if(points[j].y>points[hi].y)hi=j;}for(const k of [...new Set([lo,hi])].sort((a,b)=>a-b))out.push(points[k]);}out.push(points[points.length-1]);return out;}
root.CheetahAnalysis={parseCSV,parseWorksheet,number,stats,thin};
if(typeof module!=='undefined')module.exports=root.CheetahAnalysis;
})(typeof window!=='undefined'?window:globalThis);
