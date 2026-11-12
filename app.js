'use strict';
const {parseCSV,number,stats,thin}=CheetahAnalysis;
const $=id=>document.getElementById(id);

/* ───────── constantes e utilidades ───────── */
const sensors=[
 {code:'DE',name:'Dianteira esquerda',color:'#5d9dff'},
 {code:'DD',name:'Dianteira direita',color:'#36d1e6'},
 {code:'TE',name:'Traseira esquerda',color:'#f4d338'},
 {code:'TD',name:'Traseira direita',color:'#ff9a4d'}];
const loadCell={code:'CC',name:'Célula de carga',color:'#b79cff'};
const KG_TO_N=9.80665;
const nf=new Intl.NumberFormat('pt-BR',{maximumFractionDigits:2});
const nfSigned=new Intl.NumberFormat('pt-BR',{maximumFractionDigits:2,signDisplay:'exceptZero'});
const fmt=n=>n==null?'—':nf.format(n);
const fmtS=n=>n==null?'—':nfSigned.format(n);
const axisFmt=n=>new Intl.NumberFormat('pt-BR',{maximumFractionDigits:2,notation:Math.abs(n)>=1e5?'compact':'standard'}).format(n);
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function normalize(s){return s.normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');}
const MAX_BYTES=20*1024*1024;

/* ───────── dataset ───────── */
function buildDataset(parsed,map,time,unit,name,demo=false){
 if(new Set(map).size!==map.length||map.some(i=>i<0))throw Error(map.length>1?`Escolha ${map.length} colunas diferentes, uma para cada sensor.`:'Escolha a coluna com as leituras.');
 if(time>=0&&map.includes(time))throw Error('A coluna de tempo deve ser diferente das colunas dos sensores.');
 const xs=parsed.rows.map((r,i)=>time<0?i+1:number(r[time]));
 if(xs.some(x=>x===null))throw Error('A coluna de tempo contém valores vazios ou inválidos. Corrija o arquivo ou selecione “Número da amostra”.');
 if(xs.some((x,i)=>i>0&&x<xs[i-1]))throw Error('O tempo precisa estar em ordem crescente. Confira a coluna selecionada ou use “Número da amostra”.');
 const th=time<0?'':normalize(parsed.headers[time]);const isMs=th.includes('ms')||th.includes('milisseg');
 const explicitSeconds=th==='tempos'||th==='times'||th.includes('segundo');
 const xSuffix=time<0?'amostra':isMs?'ms':explicitSeconds?'s':'(tempo)';
 const xLabel=time<0?'Amostra':isMs?'Tempo (ms)':explicitSeconds?'Tempo (s)':'Tempo (unidade do arquivo)';
 const series=map.map(col=>{const points=[];parsed.rows.forEach((r,i)=>{const v=number(r[col]);if(v!==null)points.push({x:xs[i],y:v,row:i});});return {points,stats:stats(points.map(p=>p.y)),invalid:parsed.rows.length-points.length};});
 if(series.every(s=>!s.stats))throw Error('Nenhuma leitura numérica foi encontrada. Confira as colunas e o separador decimal.');
 return {series,name,demo,total:parsed.rows.length,unitLabel:unit==='raw'?'bruto':unit,xMin:xs[0],xMax:xs[xs.length-1],xSuffix,xLabel};
}

/* ───────── gráfico ───────── */
function createChart(container,points,sensor,data,height=190){
 const W=Math.max(300,Math.round(container.clientWidth||600)),H=height,L=49,R=17,T=12,B=30;
 let xmin=data.xMin,xmax=data.xMax,ymin=Infinity,ymax=-Infinity;
 for(const p of points){ymin=Math.min(ymin,p.y);ymax=Math.max(ymax,p.y);}
 const pad=(ymax-ymin)*.14||Math.max(Math.abs(ymin)*.08,1);ymin-=pad;ymax+=pad;if(xmin===xmax){xmin-=.5;xmax+=.5;}
 const x=v=>L+(v-xmin)/(xmax-xmin)*(W-L-R),y=v=>T+(ymax-v)/(ymax-ymin)*(H-T-B);
 let lines='';
 for(let k=0;k<4;k++){const v=ymin+(ymax-ymin)*k/3,yp=y(v);lines+=`<line class="gridline" x1="${L}" x2="${W-R}" y1="${yp}" y2="${yp}"/><text x="${L-9}" y="${yp+4}" text-anchor="end">${axisFmt(v)}</text>`;}
 const xt=W<480?3:5;
 for(let k=0;k<xt;k++){const v=xmin+(xmax-xmin)*k/(xt-1);lines+=`<text x="${x(v)}" y="${H-7}" text-anchor="${k===0?'start':k===xt-1?'end':'middle'}">${axisFmt(v)}</text>`;}
 const zeroLine=sensor.signed&&ymin<0&&ymax>0?`<line class="zeroline" x1="${L}" x2="${W-R}" y1="${y(0)}" y2="${y(0)}"/><text class="zerolabel" x="${W-R}" y="${y(0)-5}" text-anchor="end">zero</text>`:'';
 const meanLine=Number.isFinite(sensor.mean)?`<line class="ref" x1="${L}" x2="${W-R}" y1="${y(sensor.mean)}" y2="${y(sensor.mean)}"/>`:'';
 // Quebra a linha onde havia leituras inválidas; preserva picos em cada trecho.
 const segments=[];let seg=[];for(const p of points){if(seg.length&&p.row!==seg[seg.length-1].row+1){segments.push(seg);seg=[];}seg.push(p);}if(seg.length)segments.push(seg);
 let paths='';
 for(const s of segments){const small=thin(s,Math.max(4,Math.floor(700*s.length/points.length)));
  if(small.length===1)paths+=`<circle cx="${x(small[0].x)}" cy="${y(small[0].y)}" r="2" fill="${sensor.color}"/>`;
  else paths+=`<path d="${small.map((p,i)=>(i?'L':'M')+x(p.x).toFixed(2)+','+y(p.y).toFixed(2)).join(' ')}" fill="none" stroke="${sensor.color}" stroke-width="1.8" stroke-linejoin="round"/>`;}
 const f=sensor.signed?fmtS:fmt;
 container.innerHTML=`<svg class="chart" viewBox="0 0 ${W} ${H}" style="height:${H}px" role="img" aria-label="${esc(sensor.name)}: leitura por ${esc(data.xLabel.toLowerCase())}. ${points.length} leituras válidas.">${lines}${zeroLine}${meanLine}${paths}<line class="cursor-line" y1="${T}" y2="${H-B}" stroke="#a2b8d2" stroke-dasharray="3 3" visibility="hidden"/><circle class="cursor-dot" r="4" fill="${sensor.color}" stroke="#07101e" stroke-width="2" visibility="hidden"/></svg><div class="tooltip" hidden></div>`;
 const svg=container.querySelector('svg'),tip=container.querySelector('.tooltip'),line=container.querySelector('.cursor-line'),dot=container.querySelector('.cursor-dot');
 svg.addEventListener('pointermove',e=>{
  const pt=new DOMPoint(e.clientX,e.clientY).matrixTransform(svg.getScreenCTM().inverse());
  const target=xmin+(pt.x-L)/(W-L-R)*(xmax-xmin);let low=0,high=points.length-1;
  while(low<high){const mid=(low+high)>>1;if(points[mid].x<target)low=mid+1;else high=mid;}
  let p=points[low];if(low>0&&Math.abs(points[low-1].x-target)<Math.abs(p.x-target))p=points[low-1];
  line.setAttribute('x1',x(p.x));line.setAttribute('x2',x(p.x));line.setAttribute('visibility','visible');
  dot.setAttribute('cx',x(p.x));dot.setAttribute('cy',y(p.y));dot.setAttribute('visibility','visible');
  tip.textContent=`${fmt(p.x)} ${data.xSuffix} · ${f(p.y)} ${data.unitLabel}`;tip.hidden=false;
  const wrap=container.parentElement.getBoundingClientRect();
  tip.style.left=Math.max(5,Math.min(e.clientX-wrap.left+12,wrap.width-tip.offsetWidth-8))+'px';tip.style.top='24px';});
 svg.addEventListener('pointerleave',()=>{tip.hidden=true;line.setAttribute('visibility','hidden');dot.setAttribute('visibility','hidden');});
}

/* ───────── cards ───────── */
function rangeBar(st){if(!st||!(st.max>st.min))return '';const pos=Math.min(100,Math.max(0,(st.mean-st.min)/(st.max-st.min)*100));return `<div class="range" role="img" aria-label="Posição da média entre o mínimo e o máximo"><div class="span"></div><div class="mean" style="left:${pos}%"></div></div>`;}
/* opts: {kind, position:[i,n]|null, height, emptyText} */
function drawCard(sensor,d,data,opts){
 const st=d?.stats,unit=data?.unitLabel||'mm',signed=d?.zero!=null,f=signed?fmtS:fmt;
 const card=document.createElement('article');card.className='sensor-card';card.style.setProperty('--accent',sensor.color);
 const stat=(label,value)=>`<div class="stat"><span class="stat-label">${label}</span><span class="stat-value">${f(value)}<small>${unit==='bruto'?'':esc(unit)}</small></span></div>`;
 const unitText=unit==='bruto'?'leitura bruta':esc(unit);
 const sub=`${opts.kind} · ${unitText}${signed?` · zero em ${fmt(d.zero)} ${esc(unit)}`:''}`;
 const dots=opts.position?`<div class="position" aria-hidden="true">${Array.from({length:opts.position[1]},(_,j)=>`<i class="${opts.position[0]===j?'on':''}"></i>`).join('')}</div>`:'';
 card.innerHTML=`<div class="card-header"><span class="sensor-code">${sensor.code}</span><div><h4>${sensor.name}</h4><p>${sub}</p></div>${dots}</div><div class="stats">${stat('Média',st?.mean)}${stat('Máximo registrado',st?.max)}${stat('Mínimo registrado',st?.min)}</div>${rangeBar(st)}<div class="chart-wrap"><div class="chart-title"><span>${unit==='bruto'?'Leitura bruta':opts.axis+' ('+esc(unit)+')'}${signed?' · relativo ao zero':''}</span><span>${esc(data?.xLabel||'Tempo')}</span></div><div class="plot"></div></div><div class="card-bottom"><span>${st?`<strong>${fmt(st.n)}</strong> leituras válidas`:'Nenhuma leitura carregada'}</span><span>${d?`${fmt(d.invalid)} desconsideradas`:'Aguardando arquivo'}</span></div>`;
 const plot=card.querySelector('.plot');
 // O gráfico mede a largura real, então só é desenhado depois que o cartão está na página.
 card.draw=()=>{
  if(d?.points.length)createChart(plot,d.points,{...sensor,mean:st.mean,signed},data,opts.height);
  else{plot.innerHTML=`<div class="empty-chart" style="height:${opts.height||190}px">${data?'Sem leituras válidas neste sensor':'Importe um CSV para visualizar o gráfico'}</div>`;}
 };
 return card;
}
function kpi(label,value,suffix,cls=''){return `<div class="kpi ${cls}${value==null?' empty':''}"><span>${label}</span><strong>${value==null?'—':value}${value!=null&&suffix?`<small>${suffix}</small>`:''}</strong></div>`;}
function baseKpis(data){
 const st=data?data.series:[];const valid=st.reduce((n,d)=>n+(d.stats?d.stats.n:0),0),invalid=st.reduce((n,d)=>n+d.invalid,0);
 const dur=data&&data.xMax>=data.xMin?data.xMax-data.xMin:null;
 const unit=!data?'':data.xSuffix==='amostra'?'amostras':data.xSuffix==='(tempo)'?'':data.xSuffix;
 return kpi(data?.xSuffix==='amostra'?'Extensão':'Duração',dur==null?null:fmt(dur),unit)+kpi('Amostras',data?fmt(data.total):null,'')+kpi('Leituras válidas',data?fmt(valid):null,'')+kpi('Desconsideradas',data?fmt(invalid):null,'');
}

/* ───────── importador (um por sensor) ───────── */
function createImporter(o){
 const el=id=>$(o.p+id);
 let pending=null,current=null,reading=false;
 const message=(text,error=false)=>{el('message').textContent=text;el('message').classList.toggle('error',error);el('message').hidden=!text;};
 const reset=()=>{pending=null;el('mapping').hidden=true;};
 function showMapping(parsed,name){
  pending={...parsed,name};el('map-fields').replaceChildren();
  const guess=o.autoMap(parsed.headers);
  o.fields.forEach((f,i)=>{
   const label=document.createElement('label');label.textContent=f;const select=document.createElement('select');select.id=o.p+'col-'+i;
   select.add(new Option('Selecione a coluna','-1'));parsed.headers.forEach((h,j)=>select.add(new Option(h,String(j))));select.value=String(guess.map[i]);label.append(select);el('map-fields').append(label);});
  const tl=document.createElement('label');tl.textContent='Eixo horizontal';const ts=document.createElement('select');ts.id=o.p+'col-time';
  ts.add(new Option('Número da amostra','-1'));parsed.headers.forEach((h,j)=>ts.add(new Option(h,String(j))));ts.value=String(guess.time);tl.append(ts);el('map-fields').append(tl);
  o.onMapping?.(parsed);el('mapping').hidden=false;
  message(`${name}: ${fmt(parsed.rows.length)} linhas encontradas. Confira as colunas${o.hasUnit?' e a unidade':''} antes de analisar.`);
 }
 async function receive(file){
  if(!file||reading)return;message('');
  if(!/\.csv$/i.test(file.name)){message(/\.xlsx?$/i.test(file.name)?'Arquivos Excel não são aceitos. No Excel, use Arquivo › Salvar como › CSV.':'Selecione um arquivo .csv.',true);el('file').value='';return;}
  if(file.size>MAX_BYTES){message('O limite é de 20 MB por arquivo. Divida a sessão em arquivos menores.',true);return;}
  reading=true;reset();el('upload').disabled=true;el('upload').textContent='Lendo arquivo…';
  try{showMapping(parseCSV(await file.text(),o.minCols),file.name);}
  catch(e){reset();message(e.message,true);}
  finally{reading=false;el('upload').disabled=false;el('upload').textContent='Selecionar arquivo';el('file').value='';}
 }
 function setData(data){current=data;o.render(data);}
 el('upload').addEventListener('click',()=>el('file').click());
 el('file').addEventListener('change',e=>receive(e.target.files[0]));
 for(const ev of ['dragenter','dragover'])el('dropzone').addEventListener(ev,e=>{e.preventDefault();el('dropzone').classList.add('drag');});
 for(const ev of ['dragleave','drop'])el('dropzone').addEventListener(ev,e=>{e.preventDefault();el('dropzone').classList.remove('drag');});
 el('dropzone').addEventListener('drop',e=>{if(e.dataTransfer.files.length!==1){message('Importe um CSV por vez.',true);return;}receive(e.dataTransfer.files[0]);});
 el('apply').addEventListener('click',()=>{
  if(!pending)return;
  try{
   const map=o.fields.map((_,i)=>Number($('' +o.p+'col-'+i).value)),time=Number($(o.p+'col-time').value);
   const data=buildDataset(pending,map,time,o.readUnit(),pending.name);setData(data);reset();
   const invalid=data.series.reduce((n,s)=>n+s.invalid,0);
   message(invalid?`Arquivo analisado. ${fmt(invalid)} leituras vazias ou inválidas foram desconsideradas; confira a contagem em cada sensor.`:'Arquivo analisado. Os gráficos e indicadores usam os dados da sessão importada.');
  }catch(e){message(e.message,true);}
 });
 el('cancel').addEventListener('click',()=>{reset();message('');});
 el('demo').addEventListener('click',()=>{
  if(reading)return;reset();
  if(current?.demo){setData(null);message('');return;}
  setData(buildDataset(parseCSV(o.demo.csv(),o.minCols),o.demo.map,0,o.demo.unit,o.demo.name,true));
  message('Demonstração com dados simulados. Importe seu CSV para analisar uma sessão real.');
 });
 el('template').addEventListener('click',()=>{
  const blob=new Blob(['﻿'+o.template+'\n'],{type:'text/csv;charset=utf-8'});const url=URL.createObjectURL(blob),a=document.createElement('a');
  a.href=url;a.download=o.templateName;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  message('Modelo baixado com os cabeçalhos. Preencha uma linha por amostra.');
 });
 return {get current(){return current;},message};
}

/* ───────── sensor de curso ───────── */
const zero={vals:[null,null,null,null],mode:'rel'};

function cursoView(data){
 if(!data)return null;const rel=zero.mode==='rel';
 const series=data.series.map((d,i)=>{
  const z=rel?zero.vals[i]:null;if(z==null||!d.stats)return {...d,zero:null};
  return {...d,zero:z,points:d.points.map(p=>({...p,y:p.y-z})),stats:{...d.stats,mean:d.stats.mean-z,min:d.stats.min-z,max:d.stats.max-z}};});
 return {...data,series,relative:series.some(s=>s.zero!=null)};
}
function carSVG(view){
 const pos=[[64,58],[134,58],[64,170],[134,170]];const vals=sensors.map((_,i)=>view?.series[i]);
 const peak=Math.max(1e-9,...vals.map(d=>d?.stats?Math.max(Math.abs(d.stats.max),Math.abs(d.stats.min)):0));
 const wheels=sensors.map((s,i)=>{const [x,y]=pos[i],d=vals[i],st=d?.stats,h=st?Math.max(4,Math.min(1,Math.abs(st.mean)/peak)*50):0,left=i%2===0,f=d?.zero!=null?fmtS:fmt;
  return `<g style="--c:${s.color}"><rect class="wheel${st?' on':''}" x="${x}" y="${y}" width="22" height="62" rx="6"/>${st?`<rect class="fill" x="${x+3}" y="${y+58-h}" width="16" height="${h}" rx="3"/>`:''}<text class="code" x="${left?x-8:x+30}" y="${y+24}" text-anchor="${left?'end':'start'}">${s.code}</text><text class="val" x="${left?x-8:x+30}" y="${y+44}" text-anchor="${left?'end':'start'}">${st?f(st.mean):'—'}</text></g>`;}).join('');
 return `<svg class="car" viewBox="0 0 220 250" role="img" aria-label="Esquema do carro com a média de curso em cada roda"><text class="nose" x="110" y="22" text-anchor="middle">FRENTE</text><line class="axle" x1="86" x2="134" y1="89" y2="89"/><line class="axle" x1="86" x2="134" y1="201" y2="201"/><path class="body" d="M96 34h28l8 26 4 22v100l-4 24-8 20h-28l-8-20-4-24V82l4-22z"/>${wheels}</svg>`;
}
function renderCurso(){
 const data=cursoImp.current,view=cursoView(data);
 const cards=sensors.map((s,i)=>drawCard(s,view?.series[i],view,{kind:'Sensor de curso',axis:'Curso',position:[i,4]}));
 $('cards').replaceChildren(...cards);cards.forEach(c=>c.draw());
 const unit=view?.unitLabel||'mm',all=view?view.series:[];
 const maxs=all.map(d=>d.stats?.max).filter(v=>v!=null),mins=all.map(d=>d.stats?.min).filter(v=>v!=null);
 const f=view?.relative?fmtS:fmt;
 $('overview').innerHTML=`<div class="car-panel"><h4>${view?.relative?'Curso médio · relativo ao zero':'Curso médio por roda'}</h4>${carSVG(view)}</div><div class="kpis">${baseKpis(view)}${kpi('Curso máximo (todos)',maxs.length?f(Math.max(...maxs)):null,unit,'wide')}${kpi('Curso mínimo (todos)',mins.length?f(Math.min(...mins)):null,unit,'wide')}<div class="legend" aria-label="Legenda">${sensors.map(s=>`<span style="--c:${s.color}"><i></i>${s.code} · ${s.name}</span>`).join('')}</div></div>`;
 $('session-meta').textContent=data?`${fmt(data.total)} amostras · 4 canais`:'4 posições · análise independente';
 $('demo').textContent=data?.demo?'Limpar demonstração':'Explorar demonstração';
 $('zero-unit-label').textContent=`(${unit})`;$('zw-unit').textContent=data?`(${data.xSuffix==='(tempo)'?'unidade do arquivo':data.xSuffix})`:'';
 $('zw-start').placeholder=data?String(data.xMin):'início';$('zw-end').placeholder=data?String(data.xMax):'fim';
 $('zw-apply').disabled=!data;
 updateChip();
}
const cursoImp=createImporter({
 p:'',minCols:4,hasUnit:true,fields:sensors.map(s=>s.name),
 autoMap(headers){
  const match=(h,s)=>{const n=normalize(h);return n===s.code.toLowerCase()||n.includes(normalize(s.name))||n.startsWith('curso'+s.code.toLowerCase())||n.startsWith('sensor'+s.code.toLowerCase());};
  return {map:sensors.map(s=>headers.findIndex(h=>match(h,s))),time:headers.findIndex(h=>/^(tempo|time|timestamp)/.test(normalize(h)))};
 },
 onMapping(parsed){$('unit').value=parsed.headers.some(h=>/mm/i.test(h))?'mm':'raw';},
 readUnit:()=>$('unit').value,
 render:renderCurso,
 demo:{csv(){const lines=['tempo_s,curso_DE_mm,curso_DD_mm,curso_TE_mm,curso_TD_mm'];for(let i=0;i<600;i++){const t=i*.02;const values=sensors.map((_,j)=>{const bump=8*Math.exp(-Math.pow((t-4.5-j*.06)/.2,2))-5*Math.exp(-Math.pow((t-8)/.3,2));return (21+j*2+3*Math.sin(t*2.2+j*.2)+1.2*Math.sin(t*12+j)+.5*Math.cos(t*29)+bump).toFixed(3);});lines.push([t.toFixed(2),...values].join(','));}return lines.join('\n');},map:[1,2,3,4],unit:'mm',name:'Sessão simulada · 12 segundos'},
 template:'tempo_s,curso_DE_mm,curso_DD_mm,curso_TE_mm,curso_TD_mm',templateName:'modelo-cheetah-racing.csv'
});

/* zero */
$('zero-inputs').innerHTML=sensors.map((s,i)=>`<label style="--c:${s.color}"><span><i></i>${s.code}</span><input id="zero-${i}" inputmode="decimal" placeholder="ex.: 38" autocomplete="off" aria-label="Zero da roda ${esc(s.name)}"></label>`).join('');
const zeroFmt=n=>(Math.round(n*1000)/1000).toString().replace('.',',');
function setZeroStatus(text,error=false){const s=$('zero-status');s.textContent=text;s.classList.toggle('error',error);}
function applyZero(){
 const vals=[],bad=[];
 sensors.forEach((s,i)=>{const raw=$('zero-'+i).value.trim();$('zero-'+i).classList.remove('invalid');if(raw===''){vals.push(null);return;}const n=number(raw);if(n===null){bad.push(s.code);$('zero-'+i).classList.add('invalid');vals.push(null);}else vals.push(n);});
 zero.vals=vals;const set=vals.filter(v=>v!=null).length;
 if(bad.length)setZeroStatus(`Valor inválido em ${bad.join(', ')}. Use apenas números, por exemplo 38 ou 38,5.`,true);
 else if(zero.mode==='raw')setZeroStatus('Mostrando os valores do arquivo, sem aplicar o zero.');
 else if(!set)setZeroStatus('Nenhum zero definido: os valores mostrados são os do arquivo.');
 else setZeroStatus(`Valores relativos ao zero: positivo = acima do ponto zero, negativo = abaixo.${set<4?' Rodas sem zero mostram o valor do arquivo.':''}`);
 renderCurso();
}
for(let i=0;i<4;i++)$('zero-'+i).addEventListener('change',applyZero);
for(const [id,mode] of [['zero-mode-rel','rel'],['zero-mode-raw','raw']])$(id).addEventListener('click',()=>{zero.mode=mode;$('zero-mode-rel').setAttribute('aria-pressed',String(mode==='rel'));$('zero-mode-raw').setAttribute('aria-pressed',String(mode==='raw'));applyZero();});
$('zero-clear').addEventListener('click',()=>{for(let i=0;i<4;i++)$('zero-'+i).value='';$('zw-start').value='';$('zw-end').value='';applyZero();});
$('zw-apply').addEventListener('click',()=>{
 const data=cursoImp.current;if(!data){setZeroStatus('Importe uma sessão antes de usar a janela.',true);return;}
 const a=$('zw-start').value.trim()===''?data.xMin:number($('zw-start').value),b=$('zw-end').value.trim()===''?data.xMax:number($('zw-end').value);
 if(a===null||b===null){setZeroStatus('Início e fim precisam ser números.',true);return;}
 if(a>b){setZeroStatus('O início da janela deve ser menor ou igual ao fim.',true);return;}
 const means=[];
 for(let i=0;i<4;i++){const pts=data.series[i].points.filter(p=>p.x>=a&&p.x<=b);if(!pts.length){setZeroStatus(`Não há leituras válidas de ${sensors[i].code} entre ${fmt(a)} e ${fmt(b)}. Ajuste a janela.`,true);return;}means.push(pts.reduce((s,p)=>s+p.y,0)/pts.length);}
 means.forEach((m,i)=>{$('zero-'+i).value=zeroFmt(m);});
 zero.mode='rel';$('zero-mode-rel').setAttribute('aria-pressed','true');$('zero-mode-raw').setAttribute('aria-pressed','false');
 applyZero();setZeroStatus(`Zero definido pela média de ${fmt(a)} a ${fmt(b)} ${data.xSuffix==='(tempo)'?'(unidade do arquivo)':data.xSuffix}. Positivo = acima do ponto zero, negativo = abaixo.`);
});

/* ───────── célula de carga ───────── */
let loadUnit='kg';
function celulaView(data){
 if(!data)return null;const k=loadUnit==='n'?KG_TO_N:1;
 const series=data.series.map(d=>({...d,points:k===1?d.points:d.points.map(p=>({...p,y:p.y*k})),stats:d.stats&&{...d.stats,mean:d.stats.mean*k,min:d.stats.min*k,max:d.stats.max*k}}));
 return {...data,series,unitLabel:loadUnit==='n'?'N':loadUnit==='kg'?'kg':'bruto'};
}
function renderCelula(){
 const view=celulaView(celulaImp.current);
 const card=drawCard(loadCell,view?.series[0],view,{kind:'Célula de carga',axis:'Carga',position:null,height:280});
 $('c-cards').replaceChildren(card);card.draw();
 $('c-overview').innerHTML=baseKpis(view);
 for(const b of document.querySelectorAll('[data-unit]'))b.setAttribute('aria-pressed',String(b.dataset.unit===loadUnit));
 $('c-demo').textContent=celulaImp.current?.demo?'Limpar demonstração':'Explorar demonstração';
 updateChip();
}
const celulaImp=createImporter({
 p:'c-',minCols:1,hasUnit:false,fields:['Leitura da célula de carga'],
 autoMap(headers){
  const time=headers.findIndex(h=>/^(tempo|time|timestamp)/.test(normalize(h)));
  let v=headers.findIndex((h,i)=>i!==time&&/carga|celula|load|forca|force|kg|newton/.test(normalize(h)));
  if(v<0)v=headers.findIndex((_,i)=>i!==time);
  return {map:[v],time};
 },
 readUnit:()=>'kg',
 render:renderCelula,
 demo:{csv(){const lines=['tempo_s,carga_kg'];for(let i=0;i<600;i++){const t=i*.02;lines.push([t.toFixed(2),(60+18*Math.sin(t*1.7)+6*Math.sin(t*9)+1.5*Math.cos(t*31)+45*Math.exp(-Math.pow((t-5)/.25,2))-22*Math.exp(-Math.pow((t-9)/.4,2))).toFixed(3)].join(','));}return lines.join('\n');},map:[1],unit:'kg',name:'Sessão simulada · 12 segundos'},
 template:'tempo_s,carga_kg',templateName:'modelo-celula-de-carga.csv'
});
for(const b of document.querySelectorAll('[data-unit]'))b.addEventListener('click',()=>{loadUnit=b.dataset.unit;renderCelula();});

/* ───────── navegação ───────── */
const panels={
 curso:{team:'suspensao',sensor:'Sensor de curso',teamName:'Suspensão',imp:()=>cursoImp,title:'sensor-title'},
 celula:{team:'suspensao',sensor:'Célula de carga',teamName:'Suspensão',imp:()=>celulaImp,title:'celula-title'},
 powertrain:{team:'powertrain',sensor:'Sem sensores',teamName:'Powertrain'},
 freios:{team:'freios',sensor:'Sem sensores',teamName:'Freios'}};
const teams=['suspensao','powertrain','freios'];
let activePanel='curso',lastSuspension='curso';
const sidebar=$('sidebar'),scrim=$('scrim'),menuBtn=$('open-navigation'),mobileNav=matchMedia('(max-width:1100px)');

function updateChip(){
 const data=panels[activePanel].imp?.().current;
 $('filename').textContent=data?data.name:'Aguardando uma sessão';
 $('mode-label').textContent=data?(data.demo?'DEMONSTRAÇÃO':'ARQUIVO CARREGADO'):'SEM ARQUIVO';
 $('mode-label').className='mode-label '+(data?(data.demo?'demo':'real'):'');
}
function renderActive(){if(activePanel==='curso')renderCurso();else if(activePanel==='celula')renderCelula();else updateChip();}
function setNav(open){document.body.classList.toggle('nav-open',open);scrim.hidden=!open;menuBtn.setAttribute('aria-expanded',String(open));if(open)$('close-navigation').focus();else if(mobileNav.matches&&sidebar.contains(document.activeElement))menuBtn.focus();}
function showPanel(id){
 activePanel=id;const info=panels[id];if(info.team==='suspensao')lastSuspension=id;
 for(const k of Object.keys(panels))$('panel-'+k).hidden=k!==id;
 for(const t of teams)$('group-'+t).classList.toggle('active',t===info.team);
 $('sensor-curso').toggleAttribute('aria-current',id==='curso');$('sensor-celula').toggleAttribute('aria-current',id==='celula');
 if($('sensor-curso').hasAttribute('aria-current'))$('sensor-curso').setAttribute('aria-current','page');
 if($('sensor-celula').hasAttribute('aria-current'))$('sensor-celula').setAttribute('aria-current','page');
 $('crumb-team').textContent=info.teamName;$('crumb-sensor').textContent=info.sensor;
 document.title=`${info.team==='suspensao'?info.sensor:info.teamName} · Cheetah Racing`;
 renderActive();   // os gráficos dependem da largura visível
}
menuBtn.addEventListener('click',()=>setNav(true));$('close-navigation').addEventListener('click',()=>setNav(false));scrim.addEventListener('click',()=>setNav(false));
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&document.body.classList.contains('nav-open'))setNav(false);});
mobileNav.addEventListener('change',()=>setNav(false));
for(const key of teams){const group=$('group-'+key);
 group.addEventListener('toggle',()=>{if(group.open)for(const other of teams)if(other!==key)$('group-'+other).open=false;});
 group.querySelector('summary').addEventListener('click',()=>{showPanel(key==='suspensao'?lastSuspension:key);scrollTo({top:0});});}
for(const id of ['curso','celula'])$('sensor-'+id).addEventListener('click',()=>{showPanel(id);setNav(false);$(panels[id].title).focus({preventScroll:true});scrollTo({top:0});});
let resizeTimer;addEventListener('resize',()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(renderActive,150);});

showPanel('curso');
applyZero();
