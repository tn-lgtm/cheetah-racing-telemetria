'use strict';
const {parseCSV,number,stats,thin}=CheetahAnalysis;
const $=id=>document.getElementById(id);
const sensors=[{code:'DE',name:'Dianteira esquerda',color:'#69a7ff'},{code:'DD',name:'Dianteira direita',color:'#8dceff'},{code:'TE',name:'Traseira esquerda',color:'#f4d338'},{code:'TD',name:'Traseira direita',color:'#e5b763'}];
let pending=null,current=null,reading=false;
const fmt=n=>n==null?'—':new Intl.NumberFormat('pt-BR',{maximumFractionDigits:2}).format(n);
const axisFmt=n=>new Intl.NumberFormat('pt-BR',{maximumFractionDigits:2,notation:Math.abs(n)>=1e5?'compact':'standard'}).format(n);
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function message(text,error=false){$('message').textContent=text;$('message').classList.toggle('error',error);$('message').hidden=!text;}
function normalize(s){return s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');}
function columnMatch(h,s){const n=normalize(h);return n===s.code.toLowerCase()||n.includes(normalize(s.name))||n.startsWith('curso'+s.code.toLowerCase())||n.startsWith('sensor'+s.code.toLowerCase());}
function drawCard(sensor,i,data){
 const d=data?.series[i],st=d?.stats,unit=data?.unitLabel||'mm';
 const card=document.createElement('article');card.className='sensor-card';card.style.setProperty('--accent',sensor.color);
 const stat=(label,value,suffix)=>`<div class="stat"><span class="stat-label">${label}</span><span class="stat-value">${fmt(value)}<small>${suffix}</small></span></div>`;
 card.innerHTML=`<div class="card-header"><span class="sensor-code">${sensor.code}</span><div><h3>${sensor.name}</h3><p>Sensor de curso · ${unit==='bruto'?'leitura bruta':esc(unit)}</p></div><div class="position" aria-hidden="true">${sensors.map((_,j)=>`<i class="${i===j?'on':''}"></i>`).join('')}</div></div><div class="stats">${stat('Média',st?.mean,unit)}${stat('Mediana',st?.median,unit)}${stat('Coef. de variação',st?.cv,'%')}</div><div class="chart-wrap"><div class="chart-title"><span>${unit==='bruto'?'Leitura bruta':'Curso ('+esc(unit)+')'}</span><span>${esc(data?.xLabel||'Tempo')}</span></div><div class="plot"></div></div><div class="card-bottom"><span>${st?`<strong>${fmt(st.n)}</strong> leituras válidas`:'Nenhuma leitura carregada'}</span><span>${d?`${fmt(d.invalid)} desconsideradas`:'Aguardando CSV'}</span></div>`;
 const plot=card.querySelector('.plot');
 if(d?.points.length){createChart(plot,d.points,sensor,data);if(st?.cv===null||st&&Math.abs(st.mean)<(st.sd||0)*.01){const note=document.createElement('div');note.className='card-bottom sensor-note';note.textContent=st.cv===null?(st.n<2?'CV indisponível: são necessárias duas leituras.':'CV indefinido: a média é zero.'):'Média próxima de zero: interprete o CV com cautela.';card.appendChild(note);}}
 else{plot.innerHTML=`<div class="empty-chart">${data?'Sem leituras válidas neste sensor':'Importe um CSV para visualizar o gráfico'}</div>`;}
 return card;
}
function createChart(container,points,sensor,data){
 const W=600,H=185,L=49,R=17,T=12,B=30;
 let xmin=data.xMin,xmax=data.xMax,ymin=Infinity,ymax=-Infinity;for(const p of points){ymin=Math.min(ymin,p.y);ymax=Math.max(ymax,p.y);}const pad=(ymax-ymin)*.14||Math.max(Math.abs(ymin)*.08,1);ymin-=pad;ymax+=pad;if(xmin===xmax){xmin-=.5;xmax+=.5;}
 const x=v=>L+(v-xmin)/(xmax-xmin)*(W-L-R),y=v=>T+(ymax-v)/(ymax-ymin)*(H-T-B);
 let lines='';for(let k=0;k<4;k++){const v=ymin+(ymax-ymin)*k/3,yp=y(v);lines+=`<line class="gridline" x1="${L}" x2="${W-R}" y1="${yp}" y2="${yp}"/><text x="${L-9}" y="${yp+4}" text-anchor="end">${axisFmt(v)}</text>`;}
 for(let k=0;k<5;k++){const v=xmin+(xmax-xmin)*k/4;lines+=`<text x="${x(v)}" y="${H-7}" text-anchor="middle">${axisFmt(v)}</text>`;}
 // Break lines where source readings were invalid; retain peaks within each segment.
 const segments=[];let seg=[];for(const p of points){if(seg.length&&p.row!==seg[seg.length-1].row+1){segments.push(seg);seg=[];}seg.push(p);}if(seg.length)segments.push(seg);
 let paths='';for(const s of segments){const small=thin(s,Math.max(4,Math.floor(700*s.length/points.length)));if(small.length===1)paths+=`<circle cx="${x(small[0].x)}" cy="${y(small[0].y)}" r="2" fill="${sensor.color}"/>`;else paths+=`<path d="${small.map((p,i)=>(i?'L':'M')+x(p.x).toFixed(2)+','+y(p.y).toFixed(2)).join(' ')}" fill="none" stroke="${sensor.color}" stroke-width="1.8" stroke-linejoin="round"/>`;}
 container.innerHTML=`<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(sensor.name)}: leitura por ${esc(data.xLabel.toLowerCase())}. ${points.length} leituras válidas.">${lines}${paths}<line class="cursor-line" y1="${T}" y2="${H-B}" stroke="#a2b8d2" stroke-dasharray="3 3" visibility="hidden"/><circle class="cursor-dot" r="4" fill="${sensor.color}" stroke="#07101e" stroke-width="2" visibility="hidden"/></svg><div class="tooltip" hidden></div>`;
 const svg=container.querySelector('svg'),tip=container.querySelector('.tooltip'),line=container.querySelector('.cursor-line'),dot=container.querySelector('.cursor-dot');
 svg.addEventListener('pointermove',e=>{const pt=new DOMPoint(e.clientX,e.clientY).matrixTransform(svg.getScreenCTM().inverse());const target=xmin+(pt.x-L)/(W-L-R)*(xmax-xmin);let low=0,high=points.length-1;while(low<high){const mid=(low+high)>>1;if(points[mid].x<target)low=mid+1;else high=mid;}let p=points[low];if(low>0&&Math.abs(points[low-1].x-target)<Math.abs(p.x-target))p=points[low-1];line.setAttribute('x1',x(p.x));line.setAttribute('x2',x(p.x));line.setAttribute('visibility','visible');dot.setAttribute('cx',x(p.x));dot.setAttribute('cy',y(p.y));dot.setAttribute('visibility','visible');tip.textContent=`${fmt(p.x)} ${data.xSuffix} · ${fmt(p.y)} ${data.unitLabel}`;tip.hidden=false;const wrap=container.parentElement.getBoundingClientRect();tip.style.left=Math.max(5,Math.min(e.clientX-wrap.left+12,wrap.width-tip.offsetWidth-8))+'px';tip.style.top='24px';});
 svg.addEventListener('pointerleave',()=>{tip.hidden=true;line.setAttribute('visibility','hidden');dot.setAttribute('visibility','hidden');});
}
function render(data){current=data;$('cards').replaceChildren(...sensors.map((s,i)=>drawCard(s,i,data)));$('filename').textContent=data?data.name:'Aguardando uma sessão';$('mode-label').textContent=data?(data.demo?'DEMONSTRAÇÃO':'CSV CARREGADO'):'SEM ARQUIVO';$('mode-label').className='mode-label '+(data?(data.demo?'demo':'real'):'');$('session-meta').textContent=data?`${fmt(data.total)} amostras · 4 canais`:'4 posições · análise independente';$('demo').textContent=data?.demo?'Limpar demonstração':'Explorar demonstração';}
function buildDataset(parsed,map,time,unit,name,demo=false){
 if(new Set(map).size!==4||map.some(i=>i<0))throw Error('Escolha quatro colunas diferentes, uma para cada sensor.');
 if(time>=0&&map.includes(time))throw Error('A coluna de tempo deve ser diferente das colunas dos sensores.');
 let xs=parsed.rows.map((r,i)=>time<0?i+1:number(r[time]));
 if(xs.some(x=>x===null))throw Error('A coluna de tempo contém valores vazios ou inválidos. Corrija o CSV ou selecione “Número da amostra”.');
 if(xs.some((x,i)=>i>0&&x<xs[i-1]))throw Error('O tempo precisa estar em ordem crescente. Confira a coluna selecionada ou use “Número da amostra”.');
 const th=time<0?'':normalize(parsed.headers[time]);const isMs=th.includes('ms')||th.includes('milisseg');
 const explicitSeconds=th==='tempos'||th==='times'||th.includes('segundo');
 const xSuffix=time<0?'amostra':isMs?'ms':explicitSeconds?'s':'(tempo)';
 const xLabel=time<0?'Amostra':isMs?'Tempo (ms)':explicitSeconds?'Tempo (s)':'Tempo (unidade do CSV)';
 const series=map.map(col=>{const points=[];parsed.rows.forEach((r,i)=>{const v=number(r[col]);if(v!==null)points.push({x:xs[i],y:v,row:i});});return {points,stats:stats(points.map(p=>p.y)),invalid:parsed.rows.length-points.length};});
 if(series.every(s=>!s.stats))throw Error('Nenhuma leitura numérica foi encontrada. Confira as colunas e o separador decimal.');
 return {series,name,demo,total:parsed.rows.length,unitLabel:unit==='raw'?'bruto':unit,xMin:xs[0],xMax:xs[xs.length-1],xSuffix,xLabel};
}
async function receive(file){
 if(!file||reading)return;message('');if(!/\.csv$/i.test(file.name)){message('Selecione um arquivo com extensão .csv.',true);return;}if(file.size>20*1024*1024){message('O limite é de 20 MB por arquivo. Divida a sessão em arquivos menores.',true);return;}
 reading=true;$('upload').disabled=true;$('upload').textContent='Lendo arquivo…';
 try{const parsed=parseCSV(await file.text());pending={...parsed,name:file.name};$('map-fields').replaceChildren();
 for(let i=0;i<5;i++){const label=document.createElement('label');label.textContent=i<4?sensors[i].name:'Eixo horizontal';const select=document.createElement('select');select.id='col-'+i;select.add(new Option(i<4?'Selecione a coluna':'Número da amostra','-1'));parsed.headers.forEach((h,j)=>select.add(new Option(h,String(j))));const match=i<4?parsed.headers.findIndex(h=>columnMatch(h,sensors[i])):parsed.headers.findIndex(h=>/^(tempo|time|timestamp)/.test(normalize(h)));select.value=String(match);label.append(select);$('map-fields').append(label);}
 $('unit').value=parsed.headers.some(h=>/mm/i.test(h))?'mm':'raw';$('mapping').hidden=false;message(`${file.name}: ${fmt(parsed.rows.length)} linhas encontradas. Confira as colunas e a unidade antes de analisar.`);$('col-0').focus();
 }catch(e){pending=null;$('mapping').hidden=true;message(e.message,true);}finally{reading=false;$('upload').disabled=false;$('upload').textContent='Selecionar CSV';$('file').value='';}
}
$('upload').addEventListener('click',()=>$('file').click());$('file').addEventListener('change',e=>receive(e.target.files[0]));
for(const event of ['dragenter','dragover'])$('dropzone').addEventListener(event,e=>{e.preventDefault();$('dropzone').classList.add('drag');});
for(const event of ['dragleave','drop'])$('dropzone').addEventListener(event,e=>{e.preventDefault();$('dropzone').classList.remove('drag');});
$('dropzone').addEventListener('drop',e=>{if(e.dataTransfer.files.length!==1){message('Importe um CSV por vez com as quatro colunas de sensores.',true);return;}receive(e.dataTransfer.files[0]);});
$('apply').addEventListener('click',()=>{if(!pending)return;try{const data=buildDataset(pending,[0,1,2,3].map(i=>Number($('col-'+i).value)),Number($('col-4').value),$('unit').value,pending.name);render(data);$('mapping').hidden=true;pending=null;const invalid=data.series.reduce((n,s)=>n+s.invalid,0);message(invalid?`Arquivo analisado. ${fmt(invalid)} leituras vazias ou inválidas foram desconsideradas; confira a contagem em cada sensor.`:'Arquivo analisado. Os gráficos e indicadores usam os dados da sessão importada.');}catch(e){message(e.message,true);}});
$('cancel').addEventListener('click',()=>{pending=null;$('mapping').hidden=true;message('');});
function demoCSV(){const lines=['tempo_s,curso_DE_mm,curso_DD_mm,curso_TE_mm,curso_TD_mm'];for(let i=0;i<600;i++){const t=i*.02;const values=sensors.map((_,j)=>{const bump=8*Math.exp(-Math.pow((t-4.5-j*.06)/.2,2))-5*Math.exp(-Math.pow((t-8)/.3,2));return (21+j*2+3*Math.sin(t*2.2+j*.2)+1.2*Math.sin(t*12+j)+.5*Math.cos(t*29)+bump).toFixed(3);});lines.push([t.toFixed(2),...values].join(','));}return lines.join('\n');}
$('demo').addEventListener('click',()=>{pending=null;$('mapping').hidden=true;if(current?.demo){render(null);message('');return;}render(buildDataset(parseCSV(demoCSV()),[1,2,3,4],0,'mm','Sessão simulada · 12 segundos',true));message('Demonstração com dados simulados. Importe seu CSV para analisar uma sessão real.');});
$('template').addEventListener('click',()=>{const blob=new Blob(['\uFEFFtempo_s,curso_DE_mm,curso_DD_mm,curso_TE_mm,curso_TD_mm\n'],{type:'text/csv;charset=utf-8'});const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='modelo-cheetah-racing.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);message('Modelo baixado com os cabeçalhos. Preencha uma linha por amostra e mantenha a unidade indicada nas colunas.');});
render(null);
